/**
 * Tests for mount-security module.
 * Uses vi.mock for fs and os to isolate filesystem operations.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock BOTH fs and os BEFORE any imports of the module under test.
vi.mock('fs');
vi.mock('os');

// Dynamic import after mocking so the mocks are in place.
const { loadAllowlist, validateMount, validateMounts } = await import('../mount-security.js');

import * as fs from 'fs';
import * as os from 'os';
import type { AgentMount, AllowedRoot, MountAllowlist } from '@clawix/shared';

/* ------------------------------------------------------------------ */
/*  Shared test fixtures                                               */
/* ------------------------------------------------------------------ */

const ALLOWED_ROOT: AllowedRoot = {
  path: '/home/user/projects',
  allowReadWrite: true,
  description: 'Project files',
};

const ALLOWED_ROOT_READONLY: AllowedRoot = {
  path: '/home/user/data',
  allowReadWrite: false,
  description: 'Read-only data',
};

const ALLOWLIST: MountAllowlist = {
  allowedRoots: [ALLOWED_ROOT, ALLOWED_ROOT_READONLY],
  blockedPatterns: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  // Default: os.homedir returns a predictable value.
  vi.mocked(os.homedir).mockReturnValue('/home/user');
  // Default: realpathSync returns the input unchanged (no symlinks).
  vi.mocked(fs.realpathSync).mockImplementation((p) => p as string);
});

/* ------------------------------------------------------------------ */
/*  loadAllowlist                                                       */
/* ------------------------------------------------------------------ */

describe('loadAllowlist', () => {
  it('returns null when file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = loadAllowlist('/nonexistent/path.json');

    expect(result).toBeNull();
  });

  it('returns parsed allowlist when file contains valid JSON', () => {
    const fileContent: MountAllowlist = {
      allowedRoots: [
        { path: '/home/user/projects', allowReadWrite: true, description: 'Projects' },
      ],
      blockedPatterns: ['custom-blocked'],
    };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(fileContent));

    const result = loadAllowlist('/valid/path.json');

    if (result === null) throw new Error('Expected loadAllowlist to return a non-null value');
    expect(result.allowedRoots).toHaveLength(1);
    const firstRoot = result.allowedRoots[0];
    if (firstRoot === undefined) throw new Error('Expected at least one allowed root');
    expect(firstRoot.path).toBe('/home/user/projects');
    // Custom pattern should be present
    expect(result.blockedPatterns).toContain('custom-blocked');
  });

  it('merges default blocked patterns with user-provided ones', () => {
    const fileContent: MountAllowlist = {
      allowedRoots: [],
      blockedPatterns: ['my-custom-secret'],
    };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(fileContent));

    const result = loadAllowlist('/path.json');

    if (result === null) throw new Error('Expected loadAllowlist to return a non-null value');
    // Default patterns should be merged in
    expect(result.blockedPatterns).toContain('.ssh');
    expect(result.blockedPatterns).toContain('.aws');
    expect(result.blockedPatterns).toContain('.env');
    // User pattern should still be present
    expect(result.blockedPatterns).toContain('my-custom-secret');
  });

  it('returns null for invalid JSON', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{ this is: not valid json }');

    const result = loadAllowlist('/bad/path.json');

    expect(result).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  validateMount                                                       */
/* ------------------------------------------------------------------ */

describe('validateMount', () => {
  it('rejects when allowlist is null', () => {
    const mount: AgentMount = { hostPath: '/home/user/projects' };

    const result = validateMount(mount, null, []);

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/allowlist/i);
  });

  it('accepts a mount that is under an allowed root', () => {
    const mount: AgentMount = { hostPath: '/home/user/projects/myapp' };

    const result = validateMount(mount, ALLOWLIST, [{ hostPath: '/home/user/projects/myapp' }]);

    expect(result.valid).toBe(true);
  });

  it('rejects a mount not under any allowed root', () => {
    const mount: AgentMount = { hostPath: '/tmp/random-dir' };

    const result = validateMount(mount, ALLOWLIST, [{ hostPath: '/tmp/random-dir' }]);

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not under any allowed root/i);
  });

  it('rejects a mount path matching a blocked pattern (.ssh)', () => {
    const mount: AgentMount = { hostPath: '/home/user/projects/.ssh' };

    const result = validateMount(mount, ALLOWLIST, [{ hostPath: '/home/user/projects/.ssh' }]);

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/blocked/i);
  });

  it('rejects a mount not present in agent allowedMounts', () => {
    const mount: AgentMount = { hostPath: '/home/user/projects/secret-dir' };
    // agentMounts list does NOT include the requested path
    const agentMounts: AgentMount[] = [{ hostPath: '/home/user/projects/other-dir' }];

    const result = validateMount(mount, ALLOWLIST, agentMounts);

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not in agent/i);
  });

  it('enforces readonly when the matching root disallows read-write', () => {
    const mount: AgentMount = {
      hostPath: '/home/user/data/reports',
      readonly: false,
    };

    const result = validateMount(mount, ALLOWLIST, [{ hostPath: '/home/user/data/reports' }]);

    expect(result.valid).toBe(true);
    // Even though mount requested read-write, root enforces readonly
    expect(result.effectiveReadonly).toBe(true);
  });

  it('expands a leading tilde in the host path before validation', () => {
    // The mount uses ~ which should expand to /home/user
    const mount: AgentMount = { hostPath: '~/projects/myapp' };

    const result = validateMount(mount, ALLOWLIST, [{ hostPath: '~/projects/myapp' }]);

    // After expansion ~/projects/myapp → /home/user/projects/myapp which IS under allowed root
    expect(result.valid).toBe(true);
  });

  it('rejects when realpathSync throws (broken symlink)', () => {
    vi.mocked(fs.realpathSync).mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const mount: AgentMount = { hostPath: '/home/user/projects/broken-link' };

    const result = validateMount(mount, ALLOWLIST, [
      { hostPath: '/home/user/projects/broken-link' },
    ]);

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/resolve/i);
  });
});

/* ------------------------------------------------------------------ */
/*  validateMounts                                                      */
/* ------------------------------------------------------------------ */

describe('validateMounts', () => {
  it('returns ValidatedMount array with correct container paths', () => {
    const mounts: AgentMount[] = [
      { hostPath: '/home/user/projects/app', containerPath: 'app' },
      { hostPath: '/home/user/projects/data', containerPath: 'data' },
    ];
    const agentMounts: AgentMount[] = [
      { hostPath: '/home/user/projects/app' },
      { hostPath: '/home/user/projects/data' },
    ];

    const result = validateMounts(mounts, ALLOWLIST, agentMounts);

    expect(result).toHaveLength(2);
    const [mount0, mount1] = result;
    if (mount0 === undefined || mount1 === undefined)
      throw new Error('Expected 2 validated mounts');
    expect(mount0.containerPath).toBe('/workspace/extra/app');
    expect(mount1.containerPath).toBe('/workspace/extra/data');
    expect(mount0.hostPath).toBe('/home/user/projects/app');
    expect(mount1.hostPath).toBe('/home/user/projects/data');
  });

  it('throws when any mount is invalid', () => {
    const mounts: AgentMount[] = [
      { hostPath: '/home/user/projects/valid', containerPath: 'valid' },
      { hostPath: '/tmp/forbidden', containerPath: 'bad' },
    ];
    const agentMounts: AgentMount[] = [
      { hostPath: '/home/user/projects/valid' },
      { hostPath: '/tmp/forbidden' },
    ];

    expect(() => validateMounts(mounts, ALLOWLIST, agentMounts)).toThrow();
  });
});
