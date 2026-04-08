import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@clawix/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@clawix/shared')>();
  return {
    ...actual,
    createLogger: vi.fn().mockReturnValue({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  };
});

vi.mock('fs/promises');

import * as fs from 'fs/promises';

import { BootstrapFileService } from '../bootstrap-file.service.js';

const mockReadFile = vi.mocked(fs.readFile);

describe('BootstrapFileService', () => {
  let service: BootstrapFileService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BootstrapFileService();
  });

  it('should return SOUL.md and USER.md in order when both exist', async () => {
    mockReadFile
      .mockResolvedValueOnce('# Soul\nHelpful' as never)
      .mockResolvedValueOnce('# User Profile\nAlice' as never);

    const sections = await service.loadBootstrapFiles('/workspace');

    expect(sections).toHaveLength(2);
    expect(sections[0]).toEqual({ filename: 'SOUL.md', content: '# Soul\nHelpful' });
    expect(sections[1]).toEqual({ filename: 'USER.md', content: '# User Profile\nAlice' });
    expect(mockReadFile).toHaveBeenCalledWith('/workspace/SOUL.md', 'utf-8');
    expect(mockReadFile).toHaveBeenCalledWith('/workspace/USER.md', 'utf-8');
  });

  it('should skip missing files', async () => {
    const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockReadFile
      .mockRejectedValueOnce(enoent)
      .mockResolvedValueOnce('# User Profile\nAlice' as never);

    const sections = await service.loadBootstrapFiles('/workspace');

    expect(sections).toHaveLength(1);
    expect(sections[0]!.filename).toBe('USER.md');
  });

  it('should skip empty files', async () => {
    mockReadFile
      .mockResolvedValueOnce('' as never)
      .mockResolvedValueOnce('# User Profile\nAlice' as never);

    const sections = await service.loadBootstrapFiles('/workspace');

    expect(sections).toHaveLength(1);
    expect(sections[0]!.filename).toBe('USER.md');
  });

  it('should skip whitespace-only files', async () => {
    mockReadFile
      .mockResolvedValueOnce('  \n  ' as never)
      .mockResolvedValueOnce('# User Profile\nAlice' as never);

    const sections = await service.loadBootstrapFiles('/workspace');

    expect(sections).toHaveLength(1);
    expect(sections[0]!.filename).toBe('USER.md');
  });

  it('should trim trailing whitespace from file content', async () => {
    mockReadFile
      .mockResolvedValueOnce('# Soul\nHelpful\n\n\n' as never)
      .mockResolvedValueOnce('# User\n' as never);

    const sections = await service.loadBootstrapFiles('/workspace');

    expect(sections[0]!.content).toBe('# Soul\nHelpful');
    expect(sections[1]!.content).toBe('# User');
  });

  it('should skip files with read errors (non-ENOENT) and log warning', async () => {
    mockReadFile
      .mockRejectedValueOnce(new Error('EPERM'))
      .mockResolvedValueOnce('# User Profile\nAlice' as never);

    const sections = await service.loadBootstrapFiles('/workspace');

    expect(sections).toHaveLength(1);
    expect(sections[0]!.filename).toBe('USER.md');
  });

  it('should return empty array when no files exist', async () => {
    const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockReadFile.mockRejectedValue(enoent);

    const sections = await service.loadBootstrapFiles('/workspace');

    expect(sections).toHaveLength(0);
  });
});
