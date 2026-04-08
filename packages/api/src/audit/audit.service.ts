import { ForbiddenException, Injectable } from '@nestjs/common';

import type { PaginationInput } from '@clawix/shared';
import { AuditLogRepository } from '../db/audit-log.repository.js';

@Injectable()
export class AuditService {
  constructor(private readonly auditLogRepo: AuditLogRepository) {}

  async findAll(
    pagination: PaginationInput,
    filters?: {
      readonly userId?: string;
      readonly action?: string;
      readonly resource?: string;
      readonly from?: string;
      readonly to?: string;
    },
    userRole?: string,
    currentUserId?: string,
  ) {
    // Non-admin can only see their own logs
    const effectiveUserId = userRole === 'admin' ? filters?.userId : currentUserId;

    return this.auditLogRepo.findFiltered(pagination, {
      userId: effectiveUserId,
      action: filters?.action,
      resource: filters?.resource,
      from: filters?.from ? new Date(filters.from) : undefined,
      to: filters?.to ? new Date(filters.to) : undefined,
    });
  }

  async findById(id: string, userRole?: string, currentUserId?: string) {
    const log = await this.auditLogRepo.findById(id);
    if (userRole !== 'admin' && log.userId !== currentUserId) {
      throw new ForbiddenException('You can only view your own audit logs');
    }
    return log;
  }
}
