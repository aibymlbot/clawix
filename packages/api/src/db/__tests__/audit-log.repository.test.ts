import { describe, it, expect, beforeEach } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogRepository } from '../audit-log.repository.js';
import { createMockPrismaService, type MockPrismaService } from './mock-prisma.js';

describe('AuditLogRepository', () => {
  let repository: AuditLogRepository;
  let mockPrisma: MockPrismaService;

  const mockAuditLog = {
    id: 'audit-1',
    userId: 'user-1',
    action: 'agent.run',
    resource: 'AgentRun',
    resourceId: 'run-1',
    details: { model: 'claude-sonnet-4-20250514' },
    ipAddress: '192.168.1.1',
    createdAt: new Date('2026-01-15'),
  };

  const defaultPagination = { page: 1, limit: 10 };

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    repository = new AuditLogRepository(mockPrisma as unknown as PrismaService);
  });

  describe('findById', () => {
    it('should return audit log when found', async () => {
      mockPrisma.auditLog.findUnique.mockResolvedValue(mockAuditLog);

      const result = await repository.findById('audit-1');

      expect(result).toEqual(mockAuditLog);
      expect(mockPrisma.auditLog.findUnique).toHaveBeenCalledWith({
        where: { id: 'audit-1' },
      });
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.auditLog.findUnique.mockResolvedValue(null);

      await expect(repository.findById('missing')).rejects.toThrow('AuditLog');
    });
  });

  describe('findByAction', () => {
    it('should return paginated audit logs by action', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await repository.findByAction('agent.run', defaultPagination);

      expect(result.data).toEqual([mockAuditLog]);
      expect(result.meta.total).toBe(1);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { action: 'agent.run' },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findByResource', () => {
    it('should return paginated audit logs by resource', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await repository.findByResource('AgentRun', 'run-1', defaultPagination);

      expect(result.data).toEqual([mockAuditLog]);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { resource: 'AgentRun', resourceId: 'run-1' },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith({
        where: { resource: 'AgentRun', resourceId: 'run-1' },
      });
    });
  });

  describe('findByUserId', () => {
    it('should return paginated audit logs by user', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await repository.findByUserId('user-1', defaultPagination);

      expect(result.data).toEqual([mockAuditLog]);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle pagination offset', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(25);

      const result = await repository.findByUserId('user-1', {
        page: 3,
        limit: 10,
      });

      expect(result.meta.totalPages).toBe(3);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  describe('findByDateRange', () => {
    it('should return paginated audit logs within date range', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await repository.findByDateRange(startDate, endDate, defaultPagination);

      expect(result.data).toEqual([mockAuditLog]);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      });
    });
  });

  describe('create', () => {
    it('should create an audit log with required fields', async () => {
      mockPrisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await repository.create({
        userId: 'user-1',
        action: 'agent.run',
        resource: 'AgentRun',
        resourceId: 'run-1',
      });

      expect(result).toEqual(mockAuditLog);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          action: 'agent.run',
          resource: 'AgentRun',
          resourceId: 'run-1',
        },
      });
    });

    it('should create an audit log with optional fields', async () => {
      mockPrisma.auditLog.create.mockResolvedValue(mockAuditLog);

      await repository.create({
        userId: 'user-1',
        action: 'memory.share',
        resource: 'MemoryItem',
        resourceId: 'mem-1',
        details: { groupId: 'grp-1' },
        ipAddress: '10.0.0.1',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          action: 'memory.share',
          resource: 'MemoryItem',
          resourceId: 'mem-1',
          details: { groupId: 'grp-1' },
          ipAddress: '10.0.0.1',
        },
      });
    });

    it('should call handlePrismaError on failure', async () => {
      mockPrisma.auditLog.create.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['id'] },
      });

      await expect(
        repository.create({
          userId: 'user-1',
          action: 'test',
          resource: 'Test',
          resourceId: 'test-1',
        }),
      ).rejects.toThrow();
    });
  });

  describe('immutability', () => {
    it('should not expose an update method', () => {
      expect((repository as unknown as Record<string, unknown>)['update']).toBeUndefined();
    });

    it('should not expose a delete method', () => {
      expect((repository as unknown as Record<string, unknown>)['delete']).toBeUndefined();
    });
  });
});
