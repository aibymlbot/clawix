import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { TokenUsageRepository } from '../db/token-usage.repository.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenUsageRepo: TokenUsageRepository,
  ) {}

  async getStats(userId: string, userRole: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const isAdmin = userRole === 'admin';

    // Admin sees org-wide stats; non-admin sees only their own
    const runFilter = isAdmin ? {} : { session: { userId } };
    const tokenUserId = userId; // always scoped to requesting user for budget context

    const [totalRuns, activeAgents, tokenUsage, scheduledTasks] = await Promise.all([
      this.prisma.agentRun.count({ where: runFilter }),
      this.prisma.agentDefinition.count({ where: { isActive: true } }),
      this.tokenUsageRepo.sumByUserId(tokenUserId, startOfMonth, endOfMonth),
      this.prisma.task.count({ where: { enabled: true } }),
    ]);

    return {
      totalRuns,
      activeAgents,
      tokenUsage: {
        totalTokens: tokenUsage.totalTokens,
        totalEstimatedCostUsd: tokenUsage.totalEstimatedCostUsd,
      },
      scheduledTasks,
    };
  }

  async getRecentRuns(userId: string, userRole: string, limit = 10) {
    const isAdmin = userRole === 'admin';
    const where = isAdmin ? {} : { session: { userId } };

    const runs = await this.prisma.agentRun.findMany({
      where,
      take: limit,
      orderBy: { startedAt: 'desc' },
      include: {
        agentDefinition: { select: { name: true } },
      },
    });

    return runs.map((run) => ({
      id: run.id,
      agentName: run.agentDefinition.name,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      durationMs:
        run.completedAt && run.startedAt
          ? run.completedAt.getTime() - run.startedAt.getTime()
          : null,
    }));
  }

  async getRecentActivity(userId: string, userRole: string, limit = 5) {
    const isAdmin = userRole === 'admin';
    const where = isAdmin ? {} : { userId };

    const logs = await this.prisma.auditLog.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true } },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      userName: log.user.name,
      action: log.action,
      resource: log.resource,
      createdAt: log.createdAt.toISOString(),
    }));
  }
}
