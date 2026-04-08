export interface AuditLog {
  readonly id: string;
  readonly userId: string;
  readonly action: string;
  readonly resource: string;
  readonly resourceId: string;
  readonly details: Record<string, unknown>;
  readonly ipAddress: string | null;
  readonly createdAt: Date;
}

export interface TokenBudget {
  readonly userId: string;
  readonly policyId: string;
  readonly monthlyLimitUsd: number;
  readonly currentUsageUsd: number;
  readonly alertThresholdPercent: number;
}

export interface Session {
  readonly id: string;
  readonly userId: string;
  readonly agentDefinitionId: string;
  readonly channelId: string | null;
  readonly lastConsolidatedAt: Date | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
