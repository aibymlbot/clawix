/**
 * Spawn tool — queues a new agent run as a child task of the current session.
 *
 * Supports two modes:
 *   1. Named spawn: agent_name is provided → look up a worker AgentDefinition by name.
 *   2. Anonymous spawn: agent_name omitted → use the default-worker definition
 *      (created on first use from SUBAGENT_PROVIDER / SUBAGENT_MODEL env vars).
 */
import { createLogger } from '@clawix/shared';

import type { Tool, ToolResult } from '../tool.js';
import type { AgentDefinitionRepository } from '../../db/agent-definition.repository.js';
import type { AgentRunRepository } from '../../db/agent-run.repository.js';

const logger = createLogger('engine:tools:spawn');

/** Default provider for anonymous sub-agents, configurable via env. */
const DEFAULT_SUBAGENT_PROVIDER = process.env['SUBAGENT_PROVIDER'] ?? 'anthropic';

/** Default model for anonymous sub-agents, configurable via env. */
const DEFAULT_SUBAGENT_MODEL = process.env['SUBAGENT_MODEL'] ?? 'claude-haiku-4-5-20251001';

/** Minimal interface for TaskExecutorService (avoids circular import). */
interface TaskSubmitter {
  submit(
    agentRunId: string,
    options: {
      readonly agentDefinitionId: string;
      readonly input: string;
      readonly userId: string;
      readonly sessionId: string;
    },
  ): void;
}

/**
 * Create a spawn tool that queues a new agent run as a pending task.
 *
 * @param agentDefRepo      - Repository for looking up agent definitions.
 * @param agentRunRepo      - Repository for creating agent run records.
 * @param taskExecutor      - Optional task executor to submit runs immediately; pass null for stub mode.
 * @param parentSessionId   - The session ID of the calling agent.
 * @param parentAgentRunId  - The AgentRun ID of the parent agent (used to deliver results back).
 * @param userId            - The ID of the user initiating the spawn.
 */
export function createSpawnTool(
  agentDefRepo: AgentDefinitionRepository,
  agentRunRepo: AgentRunRepository,
  taskExecutor: TaskSubmitter | null,
  parentSessionId: string,
  parentAgentRunId: string,
  userId: string,
): Tool {
  return {
    name: 'spawn',
    description:
      'Spawn a sub-agent to handle a task. Provide agent_name to use a specific worker agent, ' +
      'or omit it to spawn an anonymous agent. Returns the new task ID.',
    parameters: {
      type: 'object',
      properties: {
        agent_name: {
          type: 'string',
          description:
            'Optional name of a worker agent to spawn. If omitted, an anonymous default worker is used.',
        },
        prompt: {
          type: 'string',
          description: 'The input prompt to pass to the spawned agent.',
        },
      },
      required: ['prompt'],
    },

    async execute(params: Record<string, unknown>): Promise<ToolResult> {
      const agentName = params['agent_name'] as string | undefined;
      const prompt = params['prompt'] as string;

      logger.debug(
        { agentName: agentName ?? '(anonymous)', parentSessionId },
        'Spawning sub-agent',
      );

      let agentDefId: string;
      let displayName: string;

      if (agentName) {
        // Named spawn: look up the worker by name
        const agentDef = await agentDefRepo.findByName(agentName);

        if (!agentDef) {
          logger.warn({ agentName }, 'Agent definition not found');
          return {
            output: `Agent not found: "${agentName}". Verify the agent name and try again.`,
            isError: true,
          };
        }

        if (agentDef.role !== 'worker') {
          logger.warn({ agentName, role: agentDef.role }, 'Cannot spawn non-worker agent');
          return {
            output: `Agent "${agentName}" is not a worker agent and cannot be spawned as a sub-agent.`,
            isError: true,
          };
        }

        agentDefId = agentDef.id;
        displayName = agentName;
      } else {
        // Anonymous spawn: use the default worker
        const defaultWorker = await agentDefRepo.findOrCreateDefaultWorker(
          DEFAULT_SUBAGENT_PROVIDER,
          DEFAULT_SUBAGENT_MODEL,
        );
        agentDefId = defaultWorker.id;
        displayName = 'default-worker';
      }

      const agentRun = await agentRunRepo.create({
        agentDefinitionId: agentDefId,
        sessionId: parentSessionId,
        parentAgentRunId,
        input: prompt,
        status: 'pending',
      });

      logger.info({ agentName: displayName, agentRunId: agentRun.id }, 'Spawned pending AgentRun');

      if (taskExecutor) {
        taskExecutor.submit(agentRun.id, {
          agentDefinitionId: agentDefId,
          input: prompt,
          userId,
          sessionId: parentSessionId,
        });
      }

      return {
        output: `Spawned agent "${displayName}" as task ${agentRun.id}. It will be processed asynchronously.`,
        isError: false,
      };
    },
  };
}
