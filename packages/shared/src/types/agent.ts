import type { AgentMount } from './container.js';

export type AgentStatus = 'pending' | 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export type AgentRole = 'primary' | 'worker';

export interface AgentDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly systemPrompt: string;
  readonly role: AgentRole;
  readonly provider: string;
  readonly model: string;
  readonly apiBaseUrl: string | null;
  readonly skillIds: readonly string[];
  readonly maxTokensPerRun: number;
  readonly containerConfig: ContainerConfig;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ContainerConfig {
  readonly image: string;
  readonly cpuLimit: string;
  readonly memoryLimit: string;
  readonly timeoutSeconds: number;
  readonly readOnlyRootfs: boolean;
  readonly allowedMounts: readonly AgentMount[];
  readonly idleTimeoutSeconds?: number; // optional; defaults to 300 via Zod
}

export interface AgentRun {
  readonly id: string;
  readonly agentDefinitionId: string;
  readonly sessionId: string;
  readonly status: AgentStatus;
  readonly input: string;
  readonly output: string | null;
  readonly error: string | null;
  readonly tokenUsage: TokenUsageRecord;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
}

export interface TokenUsageRecord {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly model: string;
  readonly estimatedCostUsd: number;
}
