import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@clawix/shared';

import type { PaginatedResponse, PaginationInput } from '@clawix/shared';
import { type AuditLog, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildPaginatedResponse, buildPaginationArgs, handlePrismaError } from './utils.js';

interface CreateAuditLogData {
  readonly userId: string;
  readonly action: string;
  readonly resource: string;
  readonly resourceId: string;
  readonly details?: Prisma.InputJsonValue;
  readonly ipAddress?: string;
}

@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<AuditLog> {
    const result = await this.prisma.auditLog.findUnique({ where: { id } });

    if (!result) {
      throw new NotFoundError('AuditLog', id);
    }

    return result;
  }

  async findByAction(
    action: string,
    pagination: PaginationInput,
  ): Promise<PaginatedResponse<AuditLog>> {
    const { skip, take } = buildPaginationArgs(pagination);
    const where = { action };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, pagination);
  }

  async findByResource(
    resource: string,
    resourceId: string,
    pagination: PaginationInput,
  ): Promise<PaginatedResponse<AuditLog>> {
    const { skip, take } = buildPaginationArgs(pagination);
    const where = { resource, resourceId };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, pagination);
  }

  async findByUserId(
    userId: string,
    pagination: PaginationInput,
  ): Promise<PaginatedResponse<AuditLog>> {
    const { skip, take } = buildPaginationArgs(pagination);
    const where = { userId };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, pagination);
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    pagination: PaginationInput,
  ): Promise<PaginatedResponse<AuditLog>> {
    const { skip, take } = buildPaginationArgs(pagination);
    const where = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, pagination);
  }

  async findFiltered(
    pagination: PaginationInput,
    filters?: {
      readonly userId?: string;
      readonly action?: string;
      readonly resource?: string;
      readonly from?: Date;
      readonly to?: Date;
    },
  ): Promise<PaginatedResponse<AuditLog>> {
    const { skip, take } = buildPaginationArgs(pagination);
    const where: Prisma.AuditLogWhereInput = {};

    if (filters?.userId) where.userId = filters.userId;
    if (filters?.action) where.action = filters.action;
    if (filters?.resource) where.resource = filters.resource;
    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, pagination);
  }

  async create(data: CreateAuditLogData): Promise<AuditLog> {
    try {
      return await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          ...(data.details !== undefined ? { details: data.details } : {}),
          ...(data.ipAddress !== undefined ? { ipAddress: data.ipAddress } : {}),
        },
      });
    } catch (error: unknown) {
      handlePrismaError(error, 'AuditLog');
    }
  }
}
