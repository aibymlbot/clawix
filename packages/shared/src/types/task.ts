export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type CronSchedule =
  | { readonly type: 'at'; readonly time: string }
  | { readonly type: 'every'; readonly interval: string }
  | { readonly type: 'cron'; readonly expression: string; readonly tz?: string };

export interface Task {
  readonly id: string;
  readonly agentDefinitionId: string;
  readonly createdByUserId: string;
  readonly name: string;
  readonly schedule: CronSchedule;
  readonly prompt: string;
  readonly channelId: string | null;
  readonly enabled: boolean;
  readonly nextRunAt: Date | null;
  readonly consecutiveFailures: number;
  readonly disabledReason: string | null;
  readonly timeoutMs: number | null;
  readonly lastRunAt: Date | null;
  readonly lastStatus: TaskStatus | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TaskRun {
  readonly id: string;
  readonly taskId: string;
  readonly status: TaskStatus;
  readonly output: string | null;
  readonly error: string | null;
  readonly tokenUsage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
  readonly durationMs: number | null;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
}
