import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as dns from 'dns';

import { validateUrl } from '../tools/web/ssrf-protection.js';

// Mock dns.promises.lookup to control resolved IPs
vi.mock('dns', async () => {
  const actual = await vi.importActual<typeof dns>('dns');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      lookup: vi.fn(),
    },
  };
});

const mockLookup = dns.promises.lookup as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockLookup.mockReset();
});

describe('validateUrl', () => {
  describe('scheme validation', () => {
    it('accepts http URLs', async () => {
      mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });
      const result = await validateUrl('http://example.com');
      expect(result.hostname).toBe('example.com');
      expect(result.resolvedIp).toBe('93.184.216.34');
    });

    it('accepts https URLs', async () => {
      mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });
      const result = await validateUrl('https://example.com');
      expect(result.hostname).toBe('example.com');
    });

    it('rejects ftp scheme', async () => {
      await expect(validateUrl('ftp://example.com')).rejects.toThrow('scheme');
    });

    it('rejects file scheme', async () => {
      await expect(validateUrl('file:///etc/passwd')).rejects.toThrow('scheme');
    });

    it('rejects javascript scheme', async () => {
      await expect(validateUrl('javascript:alert(1)')).rejects.toThrow();
    });
  });

  describe('IPv4 blocked ranges', () => {
    it('blocks loopback 127.0.0.1', async () => {
      mockLookup.mockResolvedValue({ address: '127.0.0.1', family: 4 });
      await expect(validateUrl('http://localhost')).rejects.toThrow('blocked');
    });

    it('blocks loopback 127.0.0.2', async () => {
      mockLookup.mockResolvedValue({ address: '127.0.0.2', family: 4 });
      await expect(validateUrl('http://example.com')).rejects.toThrow('blocked');
    });

    it('blocks private 10.x.x.x', async () => {
      mockLookup.mockResolvedValue({ address: '10.0.0.1', family: 4 });
      await expect(validateUrl('http://internal.corp')).rejects.toThrow('blocked');
    });

    it('blocks private 172.16.x.x', async () => {
      mockLookup.mockResolvedValue({ address: '172.16.0.1', family: 4 });
      await expect(validateUrl('http://internal.corp')).rejects.toThrow('blocked');
    });

    it('allows 172.15.x.x (just below private range)', async () => {
      mockLookup.mockResolvedValue({ address: '172.15.255.255', family: 4 });
      const result = await validateUrl('http://example.com');
      expect(result.resolvedIp).toBe('172.15.255.255');
    });

    it('blocks 172.31.255.255 (upper boundary of /12 range)', async () => {
      mockLookup.mockResolvedValue({ address: '172.31.255.255', family: 4 });
      await expect(validateUrl('http://example.com')).rejects.toThrow('blocked');
    });

    it('allows 172.32.0.0 (just above private range)', async () => {
      mockLookup.mockResolvedValue({ address: '172.32.0.0', family: 4 });
      const result = await validateUrl('http://example.com');
      expect(result.resolvedIp).toBe('172.32.0.0');
    });

    it('blocks private 192.168.x.x', async () => {
      mockLookup.mockResolvedValue({ address: '192.168.1.1', family: 4 });
      await expect(validateUrl('http://router.local')).rejects.toThrow('blocked');
    });

    it('blocks link-local 169.254.x.x (cloud metadata)', async () => {
      mockLookup.mockResolvedValue({ address: '169.254.169.254', family: 4 });
      await expect(validateUrl('http://metadata.google.internal')).rejects.toThrow('blocked');
    });

    it('blocks carrier-grade NAT 100.64.x.x', async () => {
      mockLookup.mockResolvedValue({ address: '100.64.0.1', family: 4 });
      await expect(validateUrl('http://example.com')).rejects.toThrow('blocked');
    });

    it('blocks 100.127.255.255 (upper boundary of CGN /10 range)', async () => {
      mockLookup.mockResolvedValue({ address: '100.127.255.255', family: 4 });
      await expect(validateUrl('http://example.com')).rejects.toThrow('blocked');
    });

    it('allows 100.128.0.0 (just above CGN range)', async () => {
      mockLookup.mockResolvedValue({ address: '100.128.0.0', family: 4 });
      const result = await validateUrl('http://example.com');
      expect(result.resolvedIp).toBe('100.128.0.0');
    });

    it('blocks 0.0.0.0', async () => {
      mockLookup.mockResolvedValue({ address: '0.0.0.0', family: 4 });
      await expect(validateUrl('http://example.com')).rejects.toThrow('blocked');
    });

    it('allows public IP 8.8.8.8', async () => {
      mockLookup.mockResolvedValue({ address: '8.8.8.8', family: 4 });
      const result = await validateUrl('http://dns.google');
      expect(result.resolvedIp).toBe('8.8.8.8');
    });
  });

  describe('IPv6 blocked ranges', () => {
    it('blocks loopback ::1', async () => {
      mockLookup.mockResolvedValue({ address: '::1', family: 6 });
      await expect(validateUrl('http://localhost')).rejects.toThrow('blocked');
    });

    it('blocks unique-local fc00::', async () => {
      mockLookup.mockResolvedValue({ address: 'fc00::1', family: 6 });
      await expect(validateUrl('http://example.com')).rejects.toThrow('blocked');
    });

    it('blocks unique-local fd00:: (upper half of fc00::/7)', async () => {
      mockLookup.mockResolvedValue({ address: 'fd00::1', family: 6 });
      await expect(validateUrl('http://example.com')).rejects.toThrow('blocked');
    });

    it('blocks link-local fe80::', async () => {
      mockLookup.mockResolvedValue({ address: 'fe80::1', family: 6 });
      await expect(validateUrl('http://example.com')).rejects.toThrow('blocked');
    });

    it('blocks IPv4-mapped IPv6 ::ffff:127.0.0.1', async () => {
      mockLookup.mockResolvedValue({ address: '::ffff:127.0.0.1', family: 6 });
      await expect(validateUrl('http://example.com')).rejects.toThrow('blocked');
    });

    it('blocks IPv4-mapped IPv6 ::ffff:10.0.0.1', async () => {
      mockLookup.mockResolvedValue({ address: '::ffff:10.0.0.1', family: 6 });
      await expect(validateUrl('http://example.com')).rejects.toThrow('blocked');
    });

    it('blocks IPv4-mapped IPv6 hex form ::ffff:7f00:1 (127.0.0.1)', async () => {
      mockLookup.mockResolvedValue({ address: '::ffff:7f00:1', family: 6 });
      await expect(validateUrl('http://example.com')).rejects.toThrow('blocked');
    });

    it('blocks IPv4-mapped IPv6 hex form ::ffff:a00:1 (10.0.0.1)', async () => {
      mockLookup.mockResolvedValue({ address: '::ffff:a00:1', family: 6 });
      await expect(validateUrl('http://example.com')).rejects.toThrow('blocked');
    });
  });

  describe('edge cases', () => {
    it('rejects empty URL', async () => {
      await expect(validateUrl('')).rejects.toThrow();
    });

    it('rejects URL without host', async () => {
      await expect(validateUrl('http://')).rejects.toThrow();
    });

    it('handles DNS resolution failure', async () => {
      mockLookup.mockRejectedValue(new Error('ENOTFOUND'));
      await expect(validateUrl('http://nonexistent.invalid')).rejects.toThrow('ENOTFOUND');
    });
  });
});
