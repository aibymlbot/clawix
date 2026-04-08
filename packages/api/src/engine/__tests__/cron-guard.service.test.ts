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

// ------------------------------------------------------------------ //
//  Imports after mocks                                                //
// ------------------------------------------------------------------ //

import { CronGuardService } from '../cron-guard.service.js';
import type { PolicyLimits, CronContext } from '../cron-guard.service.js';
import type { CronSchedule } from '@clawix/shared';

// ------------------------------------------------------------------ //
//  Helpers                                                            //
// ------------------------------------------------------------------ //

const basePolicy: PolicyLimits = {
  cronEnabled: true,
  maxScheduledTasks: 5,
  minCronIntervalSecs: 300,
  maxTokensPerCronRun: null,
};

const notInCron: CronContext = { isInCronExecution: false };
const inCron: CronContext = { isInCronExecution: true };

function makeTaskRepo(overrides: Partial<{ activeCount: number; runningCount: number }> = {}) {
  return {
    findActiveCountByUser: vi.fn().mockResolvedValue(overrides.activeCount ?? 0),
    findRunningCountByUser: vi.fn().mockResolvedValue(overrides.runningCount ?? 0),
  };
}

function makeService(taskRepoOverrides: Parameters<typeof makeTaskRepo>[0] = {}) {
  const taskRepo = makeTaskRepo(taskRepoOverrides);
  const service = new CronGuardService(taskRepo as never);
  return { service, taskRepo };
}

// ------------------------------------------------------------------ //
//  canCreate                                                          //
// ------------------------------------------------------------------ //

describe('CronGuardService.canCreate', () => {
  it('allows valid creation with every schedule above min interval', async () => {
    const { service } = makeService();
    const schedule: CronSchedule = { type: 'every', interval: '10m' };

    const result = await service.canCreate('user-1', schedule, notInCron, basePolicy);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects when cronEnabled is false', async () => {
    const { service } = makeService();
    const schedule: CronSchedule = { type: 'every', interval: '10m' };
    const policy: PolicyLimits = { ...basePolicy, cronEnabled: false };

    const result = await service.canCreate('user-1', schedule, notInCron, policy);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not available on your policy');
  });

  it('rejects when isInCronExecution is true', async () => {
    const { service } = makeService();
    const schedule: CronSchedule = { type: 'every', interval: '10m' };

    const result = await service.canCreate('user-1', schedule, inCron, basePolicy);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('during scheduled execution');
  });

  it('rejects when user has reached max scheduled tasks', async () => {
    const { service } = makeService({ activeCount: 5 });
    const schedule: CronSchedule = { type: 'every', interval: '10m' };

    const result = await service.canCreate('user-1', schedule, notInCron, basePolicy);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('5 scheduled tasks');
  });

  it('rejects at-type schedule with time in the past', async () => {
    const { service } = makeService();
    const schedule: CronSchedule = { type: 'at', time: '2020-01-01T00:00:00Z' };

    const result = await service.canCreate('user-1', schedule, notInCron, basePolicy);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('in the past');
  });

  it('rejects at-type schedule with invalid date', async () => {
    const { service } = makeService();
    const schedule: CronSchedule = { type: 'at', time: 'not-a-date' };

    const result = await service.canCreate('user-1', schedule, notInCron, basePolicy);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Invalid date/time');
  });

  it('allows at-type schedule with future time', async () => {
    const { service } = makeService();
    const futureTime = new Date(Date.now() + 3600000).toISOString();
    const schedule: CronSchedule = { type: 'at', time: futureTime };

    const result = await service.canCreate('user-1', schedule, notInCron, basePolicy);

    expect(result.allowed).toBe(true);
  });

  it('rejects interval below minimum (30s when min is 300s)', async () => {
    const { service } = makeService();
    const schedule: CronSchedule = { type: 'every', interval: '30s' };

    const result = await service.canCreate('user-1', schedule, notInCron, basePolicy);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('300 seconds');
  });

  it('rejects invalid interval format', async () => {
    const { service } = makeService();
    const schedule: CronSchedule = { type: 'every', interval: 'bad-interval' };

    const result = await service.canCreate('user-1', schedule, notInCron, basePolicy);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Invalid interval format');
    expect(result.reason).toContain('bad-interval');
  });

  it('rejects invalid cron expression', async () => {
    const { service } = makeService();
    const schedule: CronSchedule = { type: 'cron', expression: 'not-a-cron' };

    const result = await service.canCreate('user-1', schedule, notInCron, basePolicy);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Invalid cron expression');
  });

  it('rejects invalid timezone', async () => {
    const { service } = makeService();
    const schedule: CronSchedule = { type: 'cron', expression: '0 */6 * * *', tz: 'Not/ATimezone' };

    const result = await service.canCreate('user-1', schedule, notInCron, basePolicy);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Unknown timezone');
    expect(result.reason).toContain('Not/ATimezone');
  });

  it('allows valid cron expression with timezone', async () => {
    const { service } = makeService();
    // every 6 hours — well above 300s minimum
    const schedule: CronSchedule = {
      type: 'cron',
      expression: '0 */6 * * *',
      tz: 'America/New_York',
    };

    const result = await service.canCreate('user-1', schedule, notInCron, basePolicy);

    expect(result.allowed).toBe(true);
  });

  it('rejects cron expression that fires too frequently (every second via minute-level)', async () => {
    const { service } = makeService();
    // "* * * * *" fires every 60 seconds, which is below minCronIntervalSecs=300
    const schedule: CronSchedule = { type: 'cron', expression: '* * * * *' };

    const result = await service.canCreate('user-1', schedule, notInCron, basePolicy);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('300 seconds');
  });
});

// ------------------------------------------------------------------ //
//  canDispatch                                                        //
// ------------------------------------------------------------------ //

describe('CronGuardService.canDispatch', () => {
  const baseTask = {
    id: 'task-1',
    createdByUserId: 'user-1',
    consecutiveFailures: 0,
  };

  it('allows dispatch when all checks pass', async () => {
    const { service } = makeService({ runningCount: 0 });

    const result = await service.canDispatch(baseTask, basePolicy, 3, 2);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('rejects when cronEnabled is false', async () => {
    const { service } = makeService();
    const policy: PolicyLimits = { ...basePolicy, cronEnabled: false };

    const result = await service.canDispatch(baseTask, policy, 3, 2);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('disabled');
  });

  it('rejects when consecutive failures exceeded', async () => {
    const { service } = makeService();
    const task = { ...baseTask, consecutiveFailures: 3 };

    const result = await service.canDispatch(task, basePolicy, 3, 2);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Max consecutive failures');
    expect(result.reason).toContain('3');
  });

  it('rejects when concurrent limit reached', async () => {
    const { service } = makeService({ runningCount: 2 });

    const result = await service.canDispatch(baseTask, basePolicy, 3, 2);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Concurrent cron run limit');
  });
});
