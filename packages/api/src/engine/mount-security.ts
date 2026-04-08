/**
 * Mount security module — dual-layer allowlist validation for Docker volume mounts.
 *
 * Layer 1: Host-level allowlist read from a JSON config file (allowed roots + blocked patterns).
 * Layer 2: Per-agent allowlist stored in the agent's DB record.
 *
 * Security goal: ensure no agent can escape its intended filesystem scope.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { createLogger } from '@clawix/shared';
import type {
  AgentMount,
  MountAllowlist,
  MountValidationResult,
  ValidatedMount,
} from '@clawix/shared';

const logger = createLogger('engine:mount-security');

/* ------------------------------------------------------------------ */
/*  Default blocked patterns (ported from nanoClaw)                    */
/* ------------------------------------------------------------------ */

/**
 * Patterns that are always blocked regardless of allowlist configuration.
 * Matches against path.basename of the resolved host path.
 */
export const DEFAULT_BLOCKED_PATTERNS: readonly string[] = [
  '.ssh',
  '.gnupg',
  '.gpg',
  '.aws',
  '.azure',
  '.gcloud',
  '.config/gcloud',
  '.docker',
  '.kube',
  '.helm',
  '.npmrc',
  '.pypirc',
  '.gem/credentials',
  '.nuget',
  '.env',
  'credentials',
  'credentials.json',
  '.secret',
  '.secrets',
  '.netrc',
  '.pgpass',
  '.my.cnf',
  '*.pem',
  '*.key',
  '*.p12',
  '*.pfx',
  '*.jks',
  '*.keystore',
  '/etc/passwd',
  '/etc/shadow',
  '/etc/sudoers',
  '/proc',
  '/sys',
  '/dev',
  '.git-credentials',
  '.gitconfig',
  '.bash_history',
  '.zsh_history',
  '.node_repl_history',
  '.vscode/settings.json',
  '.idea',
  '.terraform',
  'terraform.tfstate',
  '.password-store',
  '.vault-token',
  'id_rsa',
  'id_ed25519',
  'id_ecdsa',
  'id_dsa',
  'private_key',
  'authorized_keys',
  'known_hosts',
];

/* ------------------------------------------------------------------ */
/*  Internal extended result type                                       */
/* ------------------------------------------------------------------ */

/** Extended result including resolved path, so validateMounts avoids double resolution. */
interface InternalValidationResult extends MountValidationResult {
  readonly resolvedPath?: string;
}

/* ------------------------------------------------------------------ */
/*  loadAllowlist                                                       */
/* ------------------------------------------------------------------ */

/**
 * Load and parse the host-level mount allowlist from a JSON file.
 *
 * @param filePath - Absolute path to the allowlist JSON file.
 * @returns Parsed allowlist with default blocked patterns merged in, or null on error.
 */
export function loadAllowlist(filePath: string): MountAllowlist | null {
  if (!fs.existsSync(filePath)) {
    logger.debug({ filePath }, 'Mount allowlist file not found');
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray((parsed as Record<string, unknown>)['allowedRoots'])
    ) {
      logger.error({ filePath }, 'Mount allowlist has invalid structure');
      return null;
    }

    const data = parsed as { allowedRoots: unknown[]; blockedPatterns?: unknown[] };
    const userPatterns = Array.isArray(data.blockedPatterns)
      ? (data.blockedPatterns as string[])
      : [];

    // Merge default patterns with user-provided ones, deduplicated
    const merged = Array.from(new Set([...DEFAULT_BLOCKED_PATTERNS, ...userPatterns]));

    const allowlist: MountAllowlist = {
      allowedRoots: data.allowedRoots as MountAllowlist['allowedRoots'],
      blockedPatterns: merged,
    };

    logger.info({ filePath, rootCount: allowlist.allowedRoots.length }, 'Loaded mount allowlist');
    return allowlist;
  } catch (err) {
    logger.error({ filePath, err }, 'Failed to load mount allowlist');
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Pattern matching helpers                                            */
/* ------------------------------------------------------------------ */

/**
 * Match a glob-style pattern with a single wildcard (*).
 * Only handles simple cases like *.pem, *.key.
 */
function matchesGlob(pattern: string, name: string): boolean {
  if (!pattern.includes('*')) {
    return pattern === name;
  }
  const [prefix, suffix] = pattern.split('*') as [string, string];
  return name.startsWith(prefix) && name.endsWith(suffix);
}

/**
 * Check whether a resolved path matches any blocked pattern.
 * Patterns are matched against path.basename and the full path.
 */
function isBlocked(resolvedPath: string, patterns: readonly string[]): boolean {
  const baseName = path.basename(resolvedPath);
  for (const pattern of patterns) {
    // Full-path exact match (e.g., /etc/passwd, /proc, /sys)
    if (resolvedPath === pattern || resolvedPath.startsWith(pattern + '/')) {
      return true;
    }
    // Glob match against basename (e.g., *.pem, *.key)
    if (matchesGlob(pattern, baseName)) {
      return true;
    }
    // Basename exact match (e.g., .ssh, .aws, credentials)
    if (baseName === pattern) {
      return true;
    }
    // Check if any path segment matches the pattern (e.g., path contains .ssh)
    const segments = resolvedPath.split('/');
    for (const segment of segments) {
      if (matchesGlob(pattern, segment)) {
        return true;
      }
    }
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Path expansion                                                      */
/* ------------------------------------------------------------------ */

/** Expand a leading ~ to the current user's home directory. */
function expandTilde(hostPath: string): string {
  if (hostPath === '~') {
    return os.homedir();
  }
  if (hostPath.startsWith('~/')) {
    return path.join(os.homedir(), hostPath.slice(2));
  }
  return hostPath;
}

/* ------------------------------------------------------------------ */
/*  Agent allowedMounts check                                           */
/* ------------------------------------------------------------------ */

/**
 * Check whether the resolved host path is covered by any of the agent's
 * permitted mounts. Both paths are resolved to handle symlinks.
 */
function isInAgentMounts(resolvedPath: string, agentMounts: readonly AgentMount[]): boolean {
  for (const agentMount of agentMounts) {
    const expanded = expandTilde(agentMount.hostPath);
    let resolvedAgentMount: string;
    try {
      resolvedAgentMount = fs.realpathSync(expanded);
    } catch {
      // If the agent mount path can't be resolved, skip it
      continue;
    }

    // The requested path must be equal to or nested under the agent mount
    if (resolvedPath === resolvedAgentMount || resolvedPath.startsWith(resolvedAgentMount + '/')) {
      return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  validateMount                                                       */
/* ------------------------------------------------------------------ */

/**
 * Validate a single mount request against the allowlist and agent's permitted mounts.
 *
 * @param mount - The requested mount from the agent definition.
 * @param allowlist - The host-level allowlist (null means validation always fails).
 * @param agentMounts - The agent's permitted mount list from the DB.
 * @returns Validation result with effectiveReadonly flag and internal resolvedPath.
 */
export function validateMount(
  mount: AgentMount,
  allowlist: MountAllowlist | null,
  agentMounts: readonly AgentMount[],
): InternalValidationResult {
  if (allowlist === null) {
    return {
      valid: false,
      reason: 'No allowlist configured — mount validation denied',
      effectiveReadonly: true,
    };
  }

  // Step 1: expand tilde
  const expanded = expandTilde(mount.hostPath);

  // Step 2: resolve symlinks
  let resolved: string;
  try {
    resolved = fs.realpathSync(expanded);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ hostPath: mount.hostPath, err }, 'Failed to resolve mount path');
    return {
      valid: false,
      reason: `Cannot resolve host path — ${message}`,
      effectiveReadonly: true,
    };
  }

  // Step 3: check blocked patterns (always check defaults + allowlist patterns)
  const allBlockedPatterns = [...DEFAULT_BLOCKED_PATTERNS, ...allowlist.blockedPatterns];
  if (isBlocked(resolved, allBlockedPatterns)) {
    logger.warn({ resolved }, 'Mount blocked by pattern');
    return {
      valid: false,
      reason: `Mount path matches a blocked pattern: ${resolved}`,
      effectiveReadonly: true,
    };
  }

  // Step 4: find matching allowed root
  const matchingRoot = allowlist.allowedRoots.find(
    (root) => resolved === root.path || resolved.startsWith(root.path + '/'),
  );

  if (matchingRoot === undefined) {
    logger.warn({ resolved }, 'Mount not under any allowed root');
    return {
      valid: false,
      reason: `Mount path is not under any allowed root: ${resolved}`,
      effectiveReadonly: true,
    };
  }

  // Step 5: check against agent's permitted mounts
  if (!isInAgentMounts(resolved, agentMounts)) {
    logger.warn({ resolved }, 'Mount not in agent allowed mounts');
    return {
      valid: false,
      reason: `Mount path is not in agent allowed mounts: ${resolved}`,
      effectiveReadonly: true,
    };
  }

  // Step 6: compute effective readonly flag
  // Mount is readonly if: the root disallows read-write OR the mount requested readonly
  const effectiveReadonly = !matchingRoot.allowReadWrite || (mount.readonly ?? false);

  logger.debug({ resolved, effectiveReadonly }, 'Mount validated successfully');

  return {
    valid: true,
    effectiveReadonly,
    resolvedPath: resolved,
  };
}

/* ------------------------------------------------------------------ */
/*  validateMounts                                                      */
/* ------------------------------------------------------------------ */

/**
 * Validate all mounts for an agent. Throws if any mount fails validation.
 *
 * @param mounts - All mounts requested by the agent.
 * @param allowlist - Host-level allowlist.
 * @param agentMounts - Per-agent permitted mount list from the DB.
 * @returns Array of validated mounts ready for docker run -v.
 * @throws Error if any mount fails validation.
 */
export function validateMounts(
  mounts: readonly AgentMount[],
  allowlist: MountAllowlist | null,
  agentMounts: readonly AgentMount[],
): ValidatedMount[] {
  const validated: ValidatedMount[] = [];

  for (const mount of mounts) {
    const result = validateMount(mount, allowlist, agentMounts);

    if (!result.valid) {
      throw new Error(
        `Mount validation failed for ${mount.hostPath}: ${result.reason ?? 'unknown reason'}`,
      );
    }

    // Derive container path name: use provided containerPath or path.basename of host path
    const containerName = mount.containerPath ?? path.basename(expandTilde(mount.hostPath));

    const validatedMount: ValidatedMount = {
      hostPath: result.resolvedPath ?? expandTilde(mount.hostPath),
      containerPath: `/workspace/extra/${containerName}`,
      readonly: result.effectiveReadonly,
    };

    validated.push(validatedMount);
  }

  return validated;
}
