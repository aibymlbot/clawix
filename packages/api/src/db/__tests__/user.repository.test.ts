import { describe, it, expect, beforeEach } from 'vitest';
import { NotFoundError, ConflictError } from '@clawix/shared';

import { UserRepository } from '../user.repository.js';
import { createMockPrismaService, type MockPrismaService } from './mock-prisma.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

describe('UserRepository', () => {
  let repo: UserRepository;
  let mockPrisma: MockPrismaService;

  const mockUser = {
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice',
    role: 'developer',
    policyId: 'policy-1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const pagination = { page: 1, limit: 20 };

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    repo = new UserRepository(mockPrisma as unknown as PrismaService);
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.findById('user-1');

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(repo.findById('missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await repo.findAll(pagination);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await repo.findByEmail('alice@example.com');

      expect(result).toEqual(mockUser);
    });

    it('should return null when email not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await repo.findByEmail('nobody@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByPolicyId', () => {
    it('should return users for a specific policy', async () => {
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await repo.findByPolicyId('policy-1', pagination);

      expect(result.data).toHaveLength(1);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { policyId: 'policy-1' } }),
      );
    });
  });

  describe('create', () => {
    it('should create a user', async () => {
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await repo.create({
        email: 'alice@example.com',
        name: 'Alice',
        passwordHash: '$2b$10$hash',
        policyId: 'policy-1',
      });

      expect(result).toEqual(mockUser);
    });

    it('should throw ConflictError on duplicate email', async () => {
      mockPrisma.user.create.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['email'] },
      });

      await expect(
        repo.create({
          email: 'alice@example.com',
          name: 'Alice',
          passwordHash: '$2b$10$hash',
          policyId: 'policy-1',
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updated = { ...mockUser, name: 'Alice Updated' };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await repo.update('user-1', { name: 'Alice Updated' });

      expect(result.name).toBe('Alice Updated');
    });

    it('should throw NotFoundError when updating non-existent user', async () => {
      mockPrisma.user.update.mockRejectedValue({ code: 'P2025' });

      await expect(repo.update('missing', { name: 'X' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('should delete a user', async () => {
      mockPrisma.user.delete.mockResolvedValue(mockUser);

      const result = await repo.delete('user-1');

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundError when deleting non-existent user', async () => {
      mockPrisma.user.delete.mockRejectedValue({ code: 'P2025' });

      await expect(repo.delete('missing')).rejects.toThrow(NotFoundError);
    });
  });
});
