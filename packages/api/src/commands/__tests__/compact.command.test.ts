import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../prisma/prisma.service.js', () => ({ PrismaService: class {} }));
vi.mock('../../db/agent-run.repository.js', () => ({ AgentRunRepository: class {} }));
vi.mock('../../engine/memory-consolidation.service.js', () => ({
  MemoryConsolidationService: class {},
}));

import { CompactCommand } from '../compact.command.js';
import type { SessionCommandContext } from '../session-command.js';

function makeContext(overrides?: Partial<SessionCommandContext>): SessionCommandContext {
  return {
    userId: 'user-1',
    sessionId: 'session-1',
    channelId: 'channel-1',
    senderId: 'sender-1',
    agentDefinitionId: 'agent-def-1',
    ...overrides,
  };
}

describe('CompactCommand', () => {
  const mockPrisma = {
    sessionMessage: {
      count: vi.fn().mockResolvedValue(10),
    },
  };
  const mockAgentRunRepo = {
    create: vi.fn().mockResolvedValue({ id: 'run-1' }),
    update: vi.fn().mockResolvedValue({ id: 'run-1' }),
  };
  const mockConsolidation = {
    consolidateIfNeeded: vi.fn().mockResolvedValue({
      consolidated: true,
      preTokens: 32000,
      postTokens: 14000,
      roundsUsed: 2,
      archivedCount: 45,
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.sessionMessage.count.mockResolvedValue(10);
    mockAgentRunRepo.create.mockResolvedValue({ id: 'run-1' });
  });

  function createCommand(): CompactCommand {
    return new CompactCommand(
      mockPrisma as never,
      mockAgentRunRepo as never,
      mockConsolidation as never,
    );
  }

  it('has the correct name and description', () => {
    const cmd = createCommand();
    expect(cmd.name).toBe('compact');
    expect(cmd.description).toBeDefined();
  });

  it('returns early when session has fewer than 4 non-system messages', async () => {
    mockPrisma.sessionMessage.count.mockResolvedValue(3);
    const cmd = createCommand();
    const result = await cmd.execute(makeContext());

    expect(result.text).toContain('too short');
    expect(mockAgentRunRepo.create).not.toHaveBeenCalled();
    expect(mockConsolidation.consolidateIfNeeded).not.toHaveBeenCalled();
  });

  it('creates an agent run, calls consolidation, and marks completed on success', async () => {
    const cmd = createCommand();
    const result = await cmd.execute(makeContext());

    expect(mockAgentRunRepo.create).toHaveBeenCalledWith({
      agentDefinitionId: 'agent-def-1',
      sessionId: 'session-1',
      input: '[system] /compact',
      status: 'running',
    });
    expect(mockConsolidation.consolidateIfNeeded).toHaveBeenCalledWith('session-1', {
      agentRunId: 'run-1',
      userId: 'user-1',
      force: true,
    });
    expect(mockAgentRunRepo.update).toHaveBeenCalledWith('run-1', {
      status: 'completed',
      completedAt: expect.any(Date),
    });
    expect(result.text).toContain('compacted');
    expect(result.text).toContain('~32K');
    expect(result.text).toContain('~14K');
    expect(result.text).toContain('45 messages archived');
  });

  it('returns already-within-limits message when consolidation reports no-op', async () => {
    mockConsolidation.consolidateIfNeeded.mockResolvedValueOnce({ consolidated: false });
    const cmd = createCommand();
    const result = await cmd.execute(makeContext());

    expect(result.text).toContain('already within context limits');
  });

  it('marks agent run as failed when consolidation throws', async () => {
    mockConsolidation.consolidateIfNeeded.mockRejectedValue(new Error('LLM failure'));
    const cmd = createCommand();
    const result = await cmd.execute(makeContext());

    expect(mockAgentRunRepo.update).toHaveBeenCalledWith('run-1', {
      status: 'failed',
      error: 'LLM failure',
      completedAt: expect.any(Date),
    });
    expect(result.text).toContain('failed');
  });

  it('passes ctx.args as customInstructions to consolidation', async () => {
    const cmd = createCommand();
    const ctx = makeContext({ args: 'focus on action items and decisions' });
    await cmd.execute(ctx);

    expect(mockConsolidation.consolidateIfNeeded).toHaveBeenCalledWith('session-1', {
      agentRunId: 'run-1',
      userId: 'user-1',
      force: true,
      customInstructions: 'focus on action items and decisions',
    });
  });

  it('passes undefined customInstructions when ctx.args is not set', async () => {
    const cmd = createCommand();
    const ctx = makeContext(); // no args field
    await cmd.execute(ctx);

    expect(mockConsolidation.consolidateIfNeeded).toHaveBeenCalledWith('session-1', {
      agentRunId: 'run-1',
      userId: 'user-1',
      force: true,
      customInstructions: undefined,
    });
  });
});
