import { describe, it, expect, vi } from 'vitest';

// ------------------------------------------------------------------ //
//  Module mocks — must be hoisted before imports                      //
// ------------------------------------------------------------------ //

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

vi.mock('../../engine/cron-next-run.js', () => ({
  computeNextRun: vi.fn().mockReturnValue(new Date('2026-04-01T00:00:00Z')),
}));

// ------------------------------------------------------------------ //
//  Imports after mocks                                                //
// ------------------------------------------------------------------ //

import { TasksService } from '../tasks.service.js';
import { computeNextRun } from '../../engine/cron-next-run.js';
import type { CreateTaskInput, UpdateTaskInput } from '@clawix/shared';

// ------------------------------------------------------------------ //
//  Helpers                                                            //
// ------------------------------------------------------------------ //

const userId = 'user-cuid-001';
const taskId = 'task-cuid-001';

const baseTask = {
  id: taskId,
  name: 'My Task',
  agentDefinitionId: 'agent-cuid-001',
  schedule: { type: 'every', interval: '10m' },
  prompt: 'Do something',
  channelId: null,
  enabled: true,
  consecutiveFailures: 0,
  createdByUserId: userId,
  nextRunAt: null,
  lastRunAt: null,
  lastStatus: null,
  disabledReason: null,
  timeoutMs: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const basePolicy = {
  id: 'policy-cuid-001',
  cronEnabled: true,
  maxScheduledTasks: 5,
  minCronIntervalSecs: 60,
  maxTokensPerCronRun: null,
};

const baseUser = {
  id: userId,
  policyId: basePolicy.id,
};

const createInput: CreateTaskInput = {
  agentDefinitionId: 'agent-cuid-001',
  name: 'My Task',
  schedule: { type: 'every', interval: '10m' },
  prompt: 'Do something',
  enabled: true,
};

function makeTaskRepo(
  overrides: Partial<{
    task: typeof baseTask;
    activeCount: number;
  }> = {},
) {
  const task = overrides.task ?? baseTask;
  return {
    findAll: vi
      .fn()
      .mockResolvedValue({ data: [task], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } }),
    findById: vi.fn().mockResolvedValue(task),
    create: vi.fn().mockResolvedValue(task),
    update: vi.fn().mockResolvedValue({ ...task, name: 'Updated' }),
    delete: vi.fn().mockResolvedValue(task),
    updateNextRunAt: vi
      .fn()
      .mockResolvedValue({ ...task, nextRunAt: new Date('2026-04-01T00:00:00Z') }),
    resetFailures: vi.fn().mockResolvedValue({ ...task, consecutiveFailures: 0 }),
    findActiveCountByUser: vi.fn().mockResolvedValue(overrides.activeCount ?? 0),
  };
}

function makeCronGuard(allowed = true, reason?: string) {
  return {
    canCreate: vi.fn().mockResolvedValue({ allowed, reason }),
  };
}

function makePolicyRepo(policy = basePolicy) {
  return {
    findById: vi.fn().mockResolvedValue(policy),
  };
}

function makeUserRepo(user = baseUser) {
  return {
    findById: vi.fn().mockResolvedValue(user),
  };
}

function makeService(
  options: {
    taskRepoOverrides?: Parameters<typeof makeTaskRepo>[0];
    guardAllowed?: boolean;
    guardReason?: string;
    policy?: typeof basePolicy;
    user?: typeof baseUser;
  } = {},
) {
  const taskRepo = makeTaskRepo(options.taskRepoOverrides);
  const cronGuard = makeCronGuard(options.guardAllowed ?? true, options.guardReason);
  const policyRepo = makePolicyRepo(options.policy);
  const userRepo = makeUserRepo(options.user);

  const service = new TasksService(
    taskRepo as never,
    cronGuard as never,
    policyRepo as never,
    userRepo as never,
  );

  return { service, taskRepo, cronGuard, policyRepo, userRepo };
}

// ------------------------------------------------------------------ //
//  findAll                                                            //
// ------------------------------------------------------------------ //

describe('TasksService.findAll', () => {
  it('returns paginated results from the repository', async () => {
    const { service, taskRepo } = makeService();

    const result = await service.findAll(userId, { page: 1, limit: 20 });

    expect(taskRepo.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe(taskId);
  });
});

// ------------------------------------------------------------------ //
//  findById                                                           //
// ------------------------------------------------------------------ //

describe('TasksService.findById', () => {
  it('returns the task by id', async () => {
    const { service, taskRepo } = makeService();

    const result = await service.findById(taskId);

    expect(taskRepo.findById).toHaveBeenCalledWith(taskId);
    expect(result.id).toBe(taskId);
  });
});

// ------------------------------------------------------------------ //
//  create                                                             //
// ------------------------------------------------------------------ //

describe('TasksService.create', () => {
  it('creates a task and sets nextRunAt when guard allows', async () => {
    const { service, taskRepo, cronGuard } = makeService();

    const result = await service.create(userId, createInput);

    expect(cronGuard.canCreate).toHaveBeenCalledWith(
      userId,
      createInput.schedule,
      { isInCronExecution: false },
      expect.objectContaining({
        cronEnabled: basePolicy.cronEnabled,
        maxScheduledTasks: basePolicy.maxScheduledTasks,
        minCronIntervalSecs: basePolicy.minCronIntervalSecs,
        maxTokensPerCronRun: basePolicy.maxTokensPerCronRun,
      }),
    );
    expect(taskRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ createdByUserId: userId }),
    );
    expect(computeNextRun).toHaveBeenCalledWith(createInput.schedule);
    expect(taskRepo.updateNextRunAt).toHaveBeenCalledWith(taskId, new Date('2026-04-01T00:00:00Z'));
    expect(result.id).toBe(taskId);
  });

  it('throws when guard rejects', async () => {
    const { service } = makeService({
      guardAllowed: false,
      guardReason: 'Cron is not available on your policy',
    });

    await expect(service.create(userId, createInput)).rejects.toThrow(
      'Cron is not available on your policy',
    );
  });

  it('throws with default message when guard rejects without reason', async () => {
    const { service } = makeService({ guardAllowed: false, guardReason: undefined });

    await expect(service.create(userId, createInput)).rejects.toThrow('Task creation denied');
  });

  it('does not call updateNextRunAt when computeNextRun returns null', async () => {
    vi.mocked(computeNextRun).mockReturnValueOnce(null);
    const { service, taskRepo } = makeService();

    await service.create(userId, createInput);

    expect(taskRepo.updateNextRunAt).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------ //
//  update                                                             //
// ------------------------------------------------------------------ //

describe('TasksService.update', () => {
  const updateInput: UpdateTaskInput = { name: 'Updated' };

  it('updates the task when user owns it', async () => {
    const { service, taskRepo } = makeService();

    const result = await service.update(taskId, userId, updateInput);

    expect(taskRepo.update).toHaveBeenCalledWith(taskId, updateInput);
    expect(result.name).toBe('Updated');
  });

  it('resets consecutive failures when they are > 0', async () => {
    const taskWithFailures = { ...baseTask, consecutiveFailures: 3 };
    const { service, taskRepo } = makeService({ taskRepoOverrides: { task: taskWithFailures } });

    await service.update(taskId, userId, updateInput);

    expect(taskRepo.resetFailures).toHaveBeenCalledWith(taskId);
  });

  it('does not reset failures when consecutiveFailures is 0', async () => {
    const { service, taskRepo } = makeService();

    await service.update(taskId, userId, updateInput);

    expect(taskRepo.resetFailures).not.toHaveBeenCalled();
  });

  it('throws when user does not own the task', async () => {
    const { service } = makeService();

    await expect(service.update(taskId, 'other-user-id', updateInput)).rejects.toThrow(
      'Not authorized to update this task',
    );
  });
});

// ------------------------------------------------------------------ //
//  remove                                                             //
// ------------------------------------------------------------------ //

describe('TasksService.remove', () => {
  it('removes the task when user owns it', async () => {
    const { service, taskRepo } = makeService();

    const result = await service.remove(taskId, userId);

    expect(taskRepo.delete).toHaveBeenCalledWith(taskId);
    expect(result.id).toBe(taskId);
  });

  it('throws when user does not own the task', async () => {
    const { service } = makeService();

    await expect(service.remove(taskId, 'other-user-id')).rejects.toThrow(
      'Not authorized to remove this task',
    );
  });
});
