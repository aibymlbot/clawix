/**
 * SSRF protection — validates URLs before making HTTP requests.
 *
 * Resolves hostnames to IPs and checks against blocked ranges
 * (private, loopback, link-local, metadata, carrier-grade NAT).
 * Returns the resolved IP to prevent DNS rebinding attacks.
 */
import * as dns from 'dns';
import * as net from 'net';

import { createLogger } from '@clawix/shared';

const logger = createLogger('engine:tools:web:ssrf');

/** Result of a successful URL validation. */
export interface ValidatedUrl {
  readonly hostname: string;
  readonly resolvedIp: string;
  readonly port: number;
  readonly pathname: string;
  readonly protocol: string;
}

/**
 * Validate a URL for SSRF safety.
 *
 * 1. Rejects non-http/https schemes.
 * 2. Resolves hostname to IP via DNS.
 * 3. Checks resolved IP against blocked ranges.
 * 4. Returns resolved IP for use in the actual request (prevents DNS rebinding).
 *
 * @throws Error if the URL is invalid, uses a blocked scheme, or resolves to a blocked IP.
 */
export async function validateUrl(url: string): Promise<ValidatedUrl> {
  // Step 1: Parse and validate scheme
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Blocked scheme "${parsed.protocol}" — only http: and https: are allowed`);
  }

  if (!parsed.hostname) {
    throw new Error('URL has no hostname');
  }

  // Step 2: Resolve hostname to IP
  const { address, family } = await dns.promises.lookup(parsed.hostname);

  // Step 3: Check resolved IP against blocked ranges
  if (isBlockedIp(address, family)) {
    logger.warn({ url, resolvedIp: address }, 'SSRF blocked: resolved to private/reserved IP');
    throw new Error(`URL resolves to blocked IP range (${address})`);
  }

  const defaultPort = parsed.protocol === 'https:' ? 443 : 80;
  const port = parsed.port ? Number(parsed.port) : defaultPort;

  return {
    hostname: parsed.hostname,
    resolvedIp: address,
    port,
    pathname: parsed.pathname + parsed.search,
    protocol: parsed.protocol,
  };
}

// ------------------------------------------------------------------ //
//  IP range checking                                                   //
// ------------------------------------------------------------------ //

/** Check if an IP address falls within any blocked range. */
function isBlockedIp(ip: string, family: number): boolean {
  if (family === 6) {
    return isBlockedIpv6(ip);
  }
  return isBlockedIpv4(ip);
}

/** Parse an IPv4 address to a 32-bit number for range checks. */
function ipv4ToNumber(ip: string): number {
  const [a = 0, b = 0, c = 0, d = 0] = ip.split('.').map(Number);
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

/** Check if an IPv4 number falls in a CIDR range. */
function inRange(ip: number, network: number, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;

  return (ip & mask) === (network & mask);
}

/** IPv4 blocked ranges. */
function isBlockedIpv4(ip: string): boolean {
  const num = ipv4ToNumber(ip);

  return (
    inRange(num, ipv4ToNumber('0.0.0.0'), 8) || // "This" network
    inRange(num, ipv4ToNumber('10.0.0.0'), 8) || // RFC 1918
    inRange(num, ipv4ToNumber('100.64.0.0'), 10) || // Carrier-grade NAT
    inRange(num, ipv4ToNumber('127.0.0.0'), 8) || // Loopback
    inRange(num, ipv4ToNumber('169.254.0.0'), 16) || // Link-local (cloud metadata)
    inRange(num, ipv4ToNumber('172.16.0.0'), 12) || // RFC 1918
    inRange(num, ipv4ToNumber('192.168.0.0'), 16) // RFC 1918
  );
}

/** IPv6 blocked ranges. */
function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();

  // Loopback
  if (lower === '::1') return true;

  // Unique-local (fc00::/7)
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;

  // Link-local (fe80::/10) — covers fe80:: through febf::
  // String prefix check is equivalent: fe8x, fe9x, feax, febx map to
  // binary 1111 1110 10xx xxxx, which is exactly the /10 mask.
  if (
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb')
  )
    return true;

  // IPv4-mapped IPv6 (::ffff:0:0/96)
  // Handles both dotted-decimal (::ffff:127.0.0.1) and hex (::ffff:7f00:1) forms.
  if (lower.startsWith('::ffff:')) {
    const suffix = lower.slice(7);
    if (net.isIPv4(suffix)) {
      return isBlockedIpv4(suffix);
    }
    // Hex form: ::ffff:HHHH:HHHH — convert to dotted-decimal IPv4
    const hexParts = suffix.split(':');
    if (hexParts.length === 2 && hexParts[0] !== undefined && hexParts[1] !== undefined) {
      const high = parseInt(hexParts[0], 16);
      const low = parseInt(hexParts[1], 16);
      if (!isNaN(high) && !isNaN(low)) {
        const ipv4 = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
        return isBlockedIpv4(ipv4);
      }
    }
  }

  return false;
}
