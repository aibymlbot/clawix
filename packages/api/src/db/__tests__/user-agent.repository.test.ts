import { describe, it, expect, beforeEach } from 'vitest';
import { NotFoundError, ConflictError } from '@clawix/shared';

import type { PrismaService } from '../../prisma/prisma.service.js';

import { UserAgentRepository } from '../user-agent.repository.js';
import { createMockPrismaService, type MockPrismaService } from './mock-prisma.js';

describe('UserAgentRepository', () => {
  let repository: UserAgentRepository;
  let mockPrisma: MockPrismaService;

  const mockUserAgent = {
    id: 'ua-1',
    userId: 'user-1',
    agentDefinitionId: 'agent-1',
    workspacePath: 'users/user-1/workspace',
    lastSessionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    repository = new UserAgentRepository(mockPrisma as unknown as PrismaService);
  });

  describe('findById', () => {
    it('should return a user agent when found', async () => {
      mockPrisma.userAgent.findUnique.mockResolvedValue(mockUserAgent);

      const result = await repository.findById('ua-1');

      expect(result).toEqual(mockUserAgent);
      expect(mockPrisma.userAgent.findUnique).toHaveBeenCalledWith({ where: { id: 'ua-1' } });
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.userAgent.findUnique.mockResolvedValue(null);

      await expect(repository.findById('missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      mockPrisma.userAgent.findMany.mockResolvedValue([mockUserAgent]);
      mockPrisma.userAgent.count.mockResolvedValue(1);

      const result = await repository.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });
  });

  describe('findByUserId', () => {
    it('should return primary user agent when found', async () => {
      mockPrisma.userAgent.findFirst.mockResolvedValue(mockUserAgent);

      const result = await repository.findByUserId('user-1');

      expect(result).toEqual(mockUserAgent);
      expect(mockPrisma.userAgent.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', agentDefinition: { role: 'primary' } },
      });
    });

    it('should return null when not found', async () => {
      mockPrisma.userAgent.findFirst.mockResolvedValue(null);

      const result = await repository.findByUserId('missing');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a user agent', async () => {
      mockPrisma.userAgent.create.mockResolvedValue(mockUserAgent);

      const result = await repository.create({
        userId: 'user-1',
        agentDefinitionId: 'agent-1',
        workspacePath: 'users/user-1/workspace',
      });

      expect(result).toEqual(mockUserAgent);
    });

    it('should throw ConflictError on duplicate userId + agentDefinitionId', async () => {
      mockPrisma.userAgent.create.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['userId', 'agentDefinitionId'] },
      });

      await expect(
        repository.create({
          userId: 'user-1',
          agentDefinitionId: 'agent-1',
          workspacePath: 'users/user-1/workspace',
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('update', () => {
    it('should update a user agent', async () => {
      const updated = { ...mockUserAgent, lastSessionId: 'session-2' };
      mockPrisma.userAgent.update.mockResolvedValue(updated);

      const result = await repository.update('ua-1', { lastSessionId: 'session-2' });

      expect(result.lastSessionId).toBe('session-2');
    });

    it('should throw NotFoundError when updating non-existent record', async () => {
      mockPrisma.userAgent.update.mockRejectedValue({ code: 'P2025' });

      await expect(repository.update('missing', { workspacePath: '/new/path' })).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('delete', () => {
    it('should delete a user agent', async () => {
      mockPrisma.userAgent.delete.mockResolvedValue(mockUserAgent);

      const result = await repository.delete('ua-1');

      expect(result).toEqual(mockUserAgent);
    });

    it('should throw NotFoundError when deleting non-existent record', async () => {
      mockPrisma.userAgent.delete.mockRejectedValue({ code: 'P2025' });

      await expect(repository.delete('missing')).rejects.toThrow(NotFoundError);
    });
  });
});
