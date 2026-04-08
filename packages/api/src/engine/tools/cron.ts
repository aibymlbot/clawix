/**
 * Cron tool — list/create/remove scheduled tasks for agent use.
 *
 * - list: always allowed, returns user's cron jobs
 * - create: blocked during cron execution, gated by CronGuardService.canCreate()
 * - remove: blocked during cron execution, verifies ownership before deleting
 */
import { createLogger } from '@clawix/shared';
import type { CronSchedule } from '@clawix/shared';

import type { CronGuardService } from '../cron-guard.service.js';
import { computeNextRun } from '../cron-next-run.js';
import type { ChannelRepository } from '../../db/channel.repository.js';
import type { TaskRepository } from '../../db/task.repository.js';
import type { Tool, ToolResult } from '../tool.js';
import type { ToolRegistry } from '../tool-registry.js';

const logger = createLogger('engine:tools:cron');

const VALID_CHANNEL_TYPES = new Set(['telegram', 'slack', 'whatsapp', 'web']);

// ------------------------------------------------------------------ //
//  Helpers                                                            //
// ------------------------------------------------------------------ //

function ok(output: string): ToolResult {
  return { output, isError: false };
}

function err(output: string): ToolResult {
  return { output, isError: true };
}

// ------------------------------------------------------------------ //
//  Policy type                                                        //
// ------------------------------------------------------------------ //

export interface CronPolicy {
  readonly cronEnabled: boolean;
  readonly maxScheduledTasks: number;
  readonly minCronIntervalSecs: number;
  readonly maxTokensPerCronRun: number | null;
}

// ------------------------------------------------------------------ //
//  createCronTool                                                     //
// ------------------------------------------------------------------ //

/**
 * Creates a cron tool bound to a user, agent definition, and policy.
 *
 * The tool provides list/create/remove actions for managing scheduled tasks.
 * Mutating actions (create/remove) are blocked during cron execution to
 * prevent recursive scheduling loops.
 */
export function createCronTool(
  cronGuard: CronGuardService,
  taskRepo: TaskRepository,
  channelRepo: ChannelRepository,
  userId: string,
  agentDefinitionId: string,
  policy: CronPolicy,
  isInCronExecution: boolean,
  sessionChannelId: string | null,
): Tool {
  return {
    name: 'cron',
    description:
      'Manage scheduled tasks (cron jobs). Use list to see existing jobs, ' +
      'create to schedule a recurring prompt, and remove to delete a job. ' +
      'Scheduled tasks run automatically and trigger the agent with the given prompt.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'create', 'remove'],
          description: 'The action to perform.',
        },
        name: {
          type: 'string',
          description: 'Job name (for create).',
        },
        prompt: {
          type: 'string',
          description: 'What to tell the agent on each trigger (for create).',
        },
        schedule: {
          type: 'string',
          description:
            'JSON schedule object. Examples: {"type":"every","interval":"1h"}, ' +
            '{"type":"cron","expression":"0 9 * * MON-FRI","tz":"America/New_York"}',
        },
        channel: {
          type: 'string',
          enum: ['telegram', 'slack', 'whatsapp', 'web', 'none'],
          description:
            'Where to deliver results. Use a channel type (telegram, slack, whatsapp, web) ' +
            'or "none" to suppress delivery. Omit to use the current conversation channel.',
        },
        jobId: {
          type: 'string',
          description: 'Job ID (for remove).',
        },
      },
      required: ['action'],
    },

    async execute(params: Record<string, unknown>): Promise<ToolResult> {
      const action = params['action'] as string;

      // ---------------------------------------------------------------- //
      //  list                                                             //
      // ---------------------------------------------------------------- //
      if (action === 'list') {
        const tasks = await taskRepo.findByUser(userId);
        const jobs = tasks.map((task) => ({
          jobId: task.id,
          name: task.name,
          schedule: task.schedule,
          prompt: task.prompt,
          channelId: task.channelId ?? null,
          enabled: task.enabled,
          nextRunAt: task.nextRunAt?.toISOString() ?? null,
          lastRunAt: task.lastRunAt?.toISOString() ?? null,
          lastStatus: task.lastStatus ?? null,
          consecutiveFailures: task.consecutiveFailures,
        }));

        logger.debug({ userId, count: jobs.length }, 'Cron list completed');
        return ok(JSON.stringify({ jobs }));
      }

      // ---------------------------------------------------------------- //
      //  create                                                           //
      // ---------------------------------------------------------------- //
      if (action === 'create') {
        if (isInCronExecution) {
          return err('Cannot create cron jobs during scheduled execution.');
        }

        const name = params['name'] as string | undefined;
        const prompt = params['prompt'] as string | undefined;
        const scheduleRaw = params['schedule'] as string | undefined;
        const channelParam = params['channel'] as string | undefined;

        // Resolve channelId:
        //   omitted        → current session channel
        //   "none"         → null (no delivery)
        //   channel type   → look up first active channel of that type
        let channelId: string | null;
        if (channelParam === undefined) {
          channelId = sessionChannelId;
        } else if (channelParam === 'none') {
          channelId = null;
        } else if (VALID_CHANNEL_TYPES.has(channelParam)) {
          const channels = await channelRepo.findByType(
            channelParam as 'telegram' | 'slack' | 'whatsapp' | 'web',
          );
          const active = channels.find((ch) => ch.isActive);
          if (!active) {
            return err(`No active ${channelParam} channel configured.`);
          }
          channelId = active.id;
        } else {
          return err(
            `Invalid channel: "${channelParam}". Use telegram, slack, whatsapp, web, or none.`,
          );
        }

        if (!name) {
          return err('Missing required field: name.');
        }
        if (!prompt) {
          return err('Missing required field: prompt.');
        }
        if (!scheduleRaw) {
          return err('Missing required field: schedule.');
        }

        let schedule: CronSchedule;
        try {
          schedule = JSON.parse(scheduleRaw) as CronSchedule;
        } catch {
          return err('Invalid schedule: must be a valid JSON string.');
        }

        const guardResult = await cronGuard.canCreate(
          userId,
          schedule,
          { isInCronExecution },
          policy,
        );

        if (!guardResult.allowed) {
          return err(guardResult.reason ?? 'Cron creation denied.');
        }

        const task = await taskRepo.create({
          agentDefinitionId,
          name,
          schedule,
          prompt,
          channelId: channelId ?? null,
          enabled: true,
          createdByUserId: userId,
        });

        // Compute and persist initial nextRunAt so the scheduler picks it up
        const nextRunAt = computeNextRun(schedule);
        if (nextRunAt) {
          await taskRepo.updateNextRunAt(task.id, nextRunAt);
        }

        logger.info({ taskId: task.id, userId, agentDefinitionId }, 'Cron job created');
        return ok(
          JSON.stringify({
            jobId: task.id,
            name: task.name,
            schedule: task.schedule,
            nextRunAt: nextRunAt?.toISOString() ?? null,
          }),
        );
      }

      // ---------------------------------------------------------------- //
      //  remove                                                           //
      // ---------------------------------------------------------------- //
      if (action === 'remove') {
        if (isInCronExecution) {
          return err('Cannot remove cron jobs during scheduled execution.');
        }

        const jobId = params['jobId'] as string | undefined;

        if (!jobId) {
          return err('Missing required field: jobId.');
        }

        let task: Awaited<ReturnType<typeof taskRepo.findById>>;
        try {
          task = await taskRepo.findById(jobId);
        } catch {
          return err('Cron job not found.');
        }

        if (task.createdByUserId !== userId) {
          return err('You can only remove your own cron jobs.');
        }

        await taskRepo.delete(jobId);

        logger.info({ jobId, userId }, 'Cron job removed');
        return ok(JSON.stringify({ jobId, removed: true }));
      }

      return err(`Unknown action: ${action}`);
    },
  };
}

// ------------------------------------------------------------------ //
//  registerCronTools                                                  //
// ------------------------------------------------------------------ //

/**
 * Register the cron tool into the given registry if the policy allows it.
 */
export function registerCronTools(
  registry: ToolRegistry,
  cronGuard: CronGuardService,
  taskRepo: TaskRepository,
  channelRepo: ChannelRepository,
  userId: string,
  agentDefinitionId: string,
  policy: CronPolicy,
  isInCronExecution: boolean,
  sessionChannelId: string | null,
): void {
  if (policy.cronEnabled) {
    registry.register(
      createCronTool(
        cronGuard,
        taskRepo,
        channelRepo,
        userId,
        agentDefinitionId,
        policy,
        isInCronExecution,
        sessionChannelId,
      ),
    );
  }
}
