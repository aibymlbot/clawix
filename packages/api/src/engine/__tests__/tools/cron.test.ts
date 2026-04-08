vi.mock('@clawix/shared', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { describe, expect, it, vi } from 'vitest';

import { createCronTool } from '../../tools/cron.js';
import type { CronGuardService } from '../../cron-guard.service.js';
import type { ChannelRepository } from '../../../db/channel.repository.js';
import type { TaskRepository } from '../../../db/task.repository.js';
import type { CronPolicy } from '../../tools/cron.js';

// ------------------------------------------------------------------ //
//  Helpers                                                            //
// ------------------------------------------------------------------ //

const USER_ID = 'user-abc';
const AGENT_DEFINITION_ID = 'agent-def-1';

const POLICY_ENABLED: CronPolicy = {
  cronEnabled: true,
  maxScheduledTasks: 10,
  minCronIntervalSecs: 60,
  maxTokensPerCronRun: null,
};

function makeTask(
  overrides: Partial<{
    id: string;
    name: string;
    agentDefinitionId: string;
    createdByUserId: string;
    schedule: unknown;
    prompt: string;
    channelId: string | null;
    enabled: boolean;
    nextRunAt: Date | null;
    lastRunAt: Date | null;
    lastStatus: string | null;
    consecutiveFailures: number;
  }> = {},
) {
  return {
    id: overrides.id ?? 'task-1',
    name: overrides.name ?? 'Test Job',
    agentDefinitionId: overrides.agentDefinitionId ?? AGENT_DEFINITION_ID,
    createdByUserId: overrides.createdByUserId ?? USER_ID,
    schedule: overrides.schedule ?? { type: 'every', interval: '1h' },
    prompt: overrides.prompt ?? 'Do the thing',
    channelId: overrides.channelId ?? null,
    enabled: overrides.enabled ?? true,
    nextRunAt: overrides.nextRunAt ?? null,
    lastRunAt: overrides.lastRunAt ?? null,
    lastStatus: overrides.lastStatus ?? null,
    consecutiveFailures: overrides.consecutiveFailures ?? 0,
    disabledReason: null,
    timeoutMs: null,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
  };
}

function makeTaskRepo(
  overrides: {
    findByUser?: ReturnType<typeof vi.fn>;
    findById?: ReturnType<typeof vi.fn>;
    create?: ReturnType<typeof vi.fn>;
    delete?: ReturnType<typeof vi.fn>;
  } = {},
): TaskRepository {
  return {
    findByUser: overrides.findByUser ?? vi.fn().mockResolvedValue([]),
    findById: overrides.findById ?? vi.fn().mockResolvedValue(makeTask()),
    create: overrides.create ?? vi.fn().mockResolvedValue(makeTask()),
    delete: overrides.delete ?? vi.fn().mockResolvedValue(makeTask()),
    // Stub remaining methods so TypeScript is satisfied
    findAll: vi.fn(),
    findEnabled: vi.fn(),
    update: vi.fn(),
    updateLastRun: vi.fn(),
    findDue: vi.fn(),
    findActiveCountByUser: vi.fn(),
    findRunningCountByUser: vi.fn(),
    incrementFailures: vi.fn(),
    resetFailures: vi.fn(),
    autoDisable: vi.fn(),
    updateNextRunAt: vi.fn(),
  } as unknown as TaskRepository;
}

function makeChannelRepo(
  overrides: {
    findByType?: ReturnType<typeof vi.fn>;
  } = {},
): ChannelRepository {
  return {
    findByType: overrides.findByType ?? vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    findAll: vi.fn(),
    findActive: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as ChannelRepository;
}

function makeCronGuard(allowed = true, reason?: string): CronGuardService {
  return {
    canCreate: vi.fn().mockResolvedValue({ allowed, reason }),
    canDispatch: vi.fn(),
  } as unknown as CronGuardService;
}

// ------------------------------------------------------------------ //
//  Tool identity                                                      //
// ------------------------------------------------------------------ //

describe('cron tool', () => {
  it('has the correct name', () => {
    const tool = createCronTool(
      makeCronGuard(),
      makeTaskRepo(),
      makeChannelRepo(),
      USER_ID,
      AGENT_DEFINITION_ID,
      POLICY_ENABLED,
      false,
      null,
    );
    expect(tool.name).toBe('cron');
  });

  // ---------------------------------------------------------------- //
  //  list action                                                      //
  // ---------------------------------------------------------------- //

  describe('list action', () => {
    it("returns the user's cron jobs as JSON", async () => {
      const tasks = [
        makeTask({ id: 'task-1', name: 'Daily Digest' }),
        makeTask({ id: 'task-2', name: 'Weekly Report' }),
      ];
      const taskRepo = makeTaskRepo({ findByUser: vi.fn().mockResolvedValue(tasks) });
      const tool = createCronTool(
        makeCronGuard(),
        taskRepo,
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        null,
      );

      const result = await tool.execute({ action: 'list' });

      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.output);
      expect(parsed.jobs).toHaveLength(2);
      expect(parsed.jobs[0].jobId).toBe('task-1');
      expect(parsed.jobs[0].name).toBe('Daily Digest');
      expect(parsed.jobs[1].jobId).toBe('task-2');
    });

    it('returns empty jobs array when user has no tasks', async () => {
      const taskRepo = makeTaskRepo({ findByUser: vi.fn().mockResolvedValue([]) });
      const tool = createCronTool(
        makeCronGuard(),
        taskRepo,
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        null,
      );

      const result = await tool.execute({ action: 'list' });

      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.output);
      expect(parsed.jobs).toHaveLength(0);
    });

    it('list still works during cron execution', async () => {
      const tasks = [makeTask()];
      const taskRepo = makeTaskRepo({ findByUser: vi.fn().mockResolvedValue(tasks) });
      const tool = createCronTool(
        makeCronGuard(),
        taskRepo,
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        true,
        null,
      );

      const result = await tool.execute({ action: 'list' });

      expect(result.isError).toBe(false);
    });

    it('includes expected fields in each job', async () => {
      const nextRun = new Date('2026-04-01T09:00:00Z');
      const lastRun = new Date('2026-03-28T09:00:00Z');
      const tasks = [
        makeTask({
          id: 'task-x',
          name: 'Morning Standup',
          schedule: { type: 'cron', expression: '0 9 * * MON-FRI' },
          prompt: 'Summarize yesterday',
          channelId: 'chan-1',
          enabled: true,
          nextRunAt: nextRun,
          lastRunAt: lastRun,
          lastStatus: 'completed',
          consecutiveFailures: 0,
        }),
      ];
      const taskRepo = makeTaskRepo({ findByUser: vi.fn().mockResolvedValue(tasks) });
      const tool = createCronTool(
        makeCronGuard(),
        taskRepo,
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        null,
      );

      const result = await tool.execute({ action: 'list' });

      const parsed = JSON.parse(result.output);
      const job = parsed.jobs[0];
      expect(job.jobId).toBe('task-x');
      expect(job.name).toBe('Morning Standup');
      expect(job.channelId).toBe('chan-1');
      expect(job.enabled).toBe(true);
      expect(job.nextRunAt).toBe(nextRun.toISOString());
      expect(job.lastRunAt).toBe(lastRun.toISOString());
      expect(job.lastStatus).toBe('completed');
      expect(job.consecutiveFailures).toBe(0);
    });
  });

  // ---------------------------------------------------------------- //
  //  create action                                                    //
  // ---------------------------------------------------------------- //

  describe('create action', () => {
    it('creates a task when guard allows', async () => {
      const created = makeTask({ id: 'task-new', name: 'New Job' });
      const taskRepo = makeTaskRepo({ create: vi.fn().mockResolvedValue(created) });
      const cronGuard = makeCronGuard(true);
      const tool = createCronTool(
        cronGuard,
        taskRepo,
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        null,
      );

      const result = await tool.execute({
        action: 'create',
        name: 'New Job',
        prompt: 'Do something useful',
        schedule: JSON.stringify({ type: 'every', interval: '1h' }),
      });

      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.output);
      expect(parsed.jobId).toBe('task-new');
      expect(parsed.name).toBe('New Job');
    });

    it('passes correct data to taskRepo.create with session channel', async () => {
      const createFn = vi.fn().mockResolvedValue(makeTask({ id: 'task-created' }));
      const taskRepo = makeTaskRepo({ create: createFn });
      const cronGuard = makeCronGuard(true);
      const tool = createCronTool(
        cronGuard,
        taskRepo,
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        'chan-42',
      );

      await tool.execute({
        action: 'create',
        name: 'My Job',
        prompt: 'Check emails',
        schedule: JSON.stringify({ type: 'every', interval: '30m' }),
      });

      expect(createFn).toHaveBeenCalledWith({
        agentDefinitionId: AGENT_DEFINITION_ID,
        name: 'My Job',
        schedule: { type: 'every', interval: '30m' },
        prompt: 'Check emails',
        channelId: 'chan-42',
        enabled: true,
        createdByUserId: USER_ID,
      });
    });

    it('falls back to session channelId when not provided by agent', async () => {
      const createFn = vi.fn().mockResolvedValue(makeTask({ id: 'task-fallback' }));
      const taskRepo = makeTaskRepo({ create: createFn });
      const cronGuard = makeCronGuard(true);
      const tool = createCronTool(
        cronGuard,
        taskRepo,
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        'session-channel-uuid',
      );

      await tool.execute({
        action: 'create',
        name: 'Fallback Job',
        prompt: 'Remind me',
        schedule: JSON.stringify({ type: 'every', interval: '5m' }),
      });

      expect(createFn).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'session-channel-uuid' }),
      );
    });

    it('uses null channelId when agent passes channel="none"', async () => {
      const createFn = vi.fn().mockResolvedValue(makeTask({ id: 'task-none' }));
      const taskRepo = makeTaskRepo({ create: createFn });
      const cronGuard = makeCronGuard(true);
      const tool = createCronTool(
        cronGuard,
        taskRepo,
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        'session-channel-uuid',
      );

      await tool.execute({
        action: 'create',
        name: 'Silent Job',
        prompt: 'Do quietly',
        schedule: JSON.stringify({ type: 'every', interval: '1h' }),
        channel: 'none',
      });

      expect(createFn).toHaveBeenCalledWith(expect.objectContaining({ channelId: null }));
    });

    it('resolves channel type to DB channel ID for cross-channel delivery', async () => {
      const createFn = vi.fn().mockResolvedValue(makeTask({ id: 'task-cross' }));
      const taskRepo = makeTaskRepo({ create: createFn });
      const cronGuard = makeCronGuard(true);
      const channelRepo = makeChannelRepo({
        findByType: vi
          .fn()
          .mockResolvedValue([
            { id: 'chan-tg-id', type: 'telegram', name: 'Telegram', isActive: true },
          ]),
      });
      const tool = createCronTool(
        cronGuard,
        taskRepo,
        channelRepo,
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        'web-session-chan',
      );

      await tool.execute({
        action: 'create',
        name: 'Cross Channel Job',
        prompt: 'Send to Telegram',
        schedule: JSON.stringify({ type: 'every', interval: '1h' }),
        channel: 'telegram',
      });

      expect(createFn).toHaveBeenCalledWith(expect.objectContaining({ channelId: 'chan-tg-id' }));
    });

    it('returns error for channel type with no active channels', async () => {
      const cronGuard = makeCronGuard(true);
      const channelRepo = makeChannelRepo({
        findByType: vi.fn().mockResolvedValue([]),
      });
      const tool = createCronTool(
        cronGuard,
        makeTaskRepo(),
        channelRepo,
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        null,
      );

      const result = await tool.execute({
        action: 'create',
        name: 'No Channel Job',
        prompt: 'Send somewhere',
        schedule: JSON.stringify({ type: 'every', interval: '1h' }),
        channel: 'slack',
      });

      expect(result.isError).toBe(true);
      expect(result.output).toContain('No active slack channel');
    });

    it('returns error for invalid channel value', async () => {
      const cronGuard = makeCronGuard(true);
      const tool = createCronTool(
        cronGuard,
        makeTaskRepo(),
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        null,
      );

      const result = await tool.execute({
        action: 'create',
        name: 'Bad Channel Job',
        prompt: 'Send somewhere',
        schedule: JSON.stringify({ type: 'every', interval: '1h' }),
        channel: '11111111',
      });

      expect(result.isError).toBe(true);
      expect(result.output).toContain('Invalid channel');
    });

    it('rejects when guard denies', async () => {
      const cronGuard = makeCronGuard(false, 'Limit reached');
      const taskRepo = makeTaskRepo();
      const tool = createCronTool(
        cronGuard,
        taskRepo,
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        null,
      );

      const result = await tool.execute({
        action: 'create',
        name: 'Blocked Job',
        prompt: 'Do something',
        schedule: JSON.stringify({ type: 'every', interval: '1h' }),
      });

      expect(result.isError).toBe(true);
      expect(result.output).toContain('Limit reached');
    });

    it('rejects with missing name', async () => {
      const tool = createCronTool(
        makeCronGuard(),
        makeTaskRepo(),
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        null,
      );

      const result = await tool.execute({
        action: 'create',
        prompt: 'Do something',
        schedule: JSON.stringify({ type: 'every', interval: '1h' }),
      });

      expect(result.isError).toBe(true);
      expect(result.output).toContain('name');
    });

    it('rejects with missing prompt', async () => {
      const tool = createCronTool(
        makeCronGuard(),
        makeTaskRepo(),
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        null,
      );

      const result = await tool.execute({
        action: 'create',
        name: 'Some Job',
        schedule: JSON.stringify({ type: 'every', interval: '1h' }),
      });

      expect(result.isError).toBe(true);
      expect(result.output).toContain('prompt');
    });

    it('rejects with missing schedule', async () => {
      const tool = createCronTool(
        makeCronGuard(),
        makeTaskRepo(),
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        null,
      );

      const result = await tool.execute({
        action: 'create',
        name: 'Some Job',
        prompt: 'Do something',
      });

      expect(result.isError).toBe(true);
      expect(result.output).toContain('schedule');
    });

    it('rejects with invalid schedule JSON', async () => {
      const tool = createCronTool(
        makeCronGuard(),
        makeTaskRepo(),
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        null,
      );

      const result = await tool.execute({
        action: 'create',
        name: 'Bad Job',
        prompt: 'Do something',
        schedule: 'not-valid-json{{{',
      });

      expect(result.isError).toBe(true);
      expect(result.output).toContain('Invalid schedule');
    });

    it('is blocked during cron execution', async () => {
      const tool = createCronTool(
        makeCronGuard(),
        makeTaskRepo(),
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        true,
        null,
      );

      const result = await tool.execute({
        action: 'create',
        name: 'Recursive Job',
        prompt: 'Trigger myself',
        schedule: JSON.stringify({ type: 'every', interval: '5m' }),
      });

      expect(result.isError).toBe(true);
      expect(result.output).toContain('scheduled execution');
    });
  });

  // ---------------------------------------------------------------- //
  //  remove action                                                    //
  // ---------------------------------------------------------------- //

  describe('remove action', () => {
    it('removes an owned task', async () => {
      const task = makeTask({ id: 'task-to-delete', createdByUserId: USER_ID });
      const deleteFn = vi.fn().mockResolvedValue(task);
      const taskRepo = makeTaskRepo({
        findById: vi.fn().mockResolvedValue(task),
        delete: deleteFn,
      });
      const tool = createCronTool(
        makeCronGuard(),
        taskRepo,
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        null,
      );

      const result = await tool.execute({ action: 'remove', jobId: 'task-to-delete' });

      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.output);
      expect(parsed.jobId).toBe('task-to-delete');
      expect(parsed.removed).toBe(true);
      expect(deleteFn).toHaveBeenCalledWith('task-to-delete');
    });

    it('rejects removing a task owned by another user', async () => {
      const task = makeTask({ id: 'task-other', createdByUserId: 'other-user' });
      const deleteFn = vi.fn();
      const taskRepo = makeTaskRepo({
        findById: vi.fn().mockResolvedValue(task),
        delete: deleteFn,
      });
      const tool = createCronTool(
        makeCronGuard(),
        taskRepo,
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        null,
      );

      const result = await tool.execute({ action: 'remove', jobId: 'task-other' });

      expect(result.isError).toBe(true);
      expect(result.output).toContain('only remove your own');
      expect(deleteFn).not.toHaveBeenCalled();
    });

    it('returns error when task not found', async () => {
      const taskRepo = makeTaskRepo({
        findById: vi.fn().mockRejectedValue(new Error('Not found')),
      });
      const tool = createCronTool(
        makeCronGuard(),
        taskRepo,
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        null,
      );

      const result = await tool.execute({ action: 'remove', jobId: 'missing-task' });

      expect(result.isError).toBe(true);
      expect(result.output).toContain('not found');
    });

    it('rejects with missing jobId', async () => {
      const tool = createCronTool(
        makeCronGuard(),
        makeTaskRepo(),
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        false,
        null,
      );

      const result = await tool.execute({ action: 'remove' });

      expect(result.isError).toBe(true);
      expect(result.output).toContain('jobId');
    });

    it('is blocked during cron execution', async () => {
      const tool = createCronTool(
        makeCronGuard(),
        makeTaskRepo(),
        makeChannelRepo(),
        USER_ID,
        AGENT_DEFINITION_ID,
        POLICY_ENABLED,
        true,
        null,
      );

      const result = await tool.execute({ action: 'remove', jobId: 'task-1' });

      expect(result.isError).toBe(true);
      expect(result.output).toContain('scheduled execution');
    });
  });
});
