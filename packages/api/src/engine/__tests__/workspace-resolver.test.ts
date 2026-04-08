import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';

import { resolveWorkspacePaths } from '../workspace-resolver.js';

describe('resolveWorkspacePaths', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env['WORKSPACE_BASE_PATH'];
    delete process.env['WORKSPACE_HOST_BASE_PATH'];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses ./data as default base when no env vars set', () => {
    const result = resolveWorkspacePaths('users/u1/workspace');
    const expected = path.resolve('./data', 'users/u1/workspace');
    expect(result.localPath).toBe(expected);
    expect(result.hostPath).toBe(expected);
  });

  it('uses WORKSPACE_BASE_PATH for both paths when HOST var is not set', () => {
    process.env['WORKSPACE_BASE_PATH'] = '/data';
    const result = resolveWorkspacePaths('users/u1/workspace');
    expect(result.localPath).toBe('/data/users/u1/workspace');
    expect(result.hostPath).toBe('/data/users/u1/workspace');
  });

  it('uses different local and host paths when both vars are set', () => {
    process.env['WORKSPACE_BASE_PATH'] = '/data';
    process.env['WORKSPACE_HOST_BASE_PATH'] = '/home/user/clawix/data';
    const result = resolveWorkspacePaths('users/u1/workspace');
    expect(result.localPath).toBe('/data/users/u1/workspace');
    expect(result.hostPath).toBe('/home/user/clawix/data/users/u1/workspace');
  });

  it('resolves relative base paths to absolute', () => {
    process.env['WORKSPACE_BASE_PATH'] = './data';
    const result = resolveWorkspacePaths('users/u1/workspace');
    expect(path.isAbsolute(result.localPath)).toBe(true);
    expect(path.isAbsolute(result.hostPath)).toBe(true);
  });
});
