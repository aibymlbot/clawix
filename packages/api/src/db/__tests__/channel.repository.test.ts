import { describe, it, expect, beforeEach } from 'vitest';

import { ConflictError, NotFoundError } from '@clawix/shared';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { ChannelRepository } from '../channel.repository.js';
import { createMockPrismaService, type MockPrismaService } from './mock-prisma.js';

describe('ChannelRepository', () => {
  let repository: ChannelRepository;
  let mockPrisma: MockPrismaService;

  const mockChannel = {
    id: 'ch-1',
    type: 'slack',
    name: 'General',
    config: {},
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    repository = new ChannelRepository(mockPrisma as unknown as PrismaService);
  });

  describe('findById', () => {
    it('should return a channel when found', async () => {
      mockPrisma.channel.findUnique.mockResolvedValue(mockChannel);

      const result = await repository.findById('ch-1');

      expect(result).toEqual(mockChannel);
      expect(mockPrisma.channel.findUnique).toHaveBeenCalledWith({ where: { id: 'ch-1' } });
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.channel.findUnique.mockResolvedValue(null);

      await expect(repository.findById('missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('findAll', () => {
    it('should return paginated channels', async () => {
      mockPrisma.channel.findMany.mockResolvedValue([mockChannel]);
      mockPrisma.channel.count.mockResolvedValue(1);

      const result = await repository.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual([mockChannel]);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
    });
  });

  describe('findActive', () => {
    it('should return only active channels', async () => {
      mockPrisma.channel.findMany.mockResolvedValue([mockChannel]);

      const result = await repository.findActive();

      expect(result).toEqual([mockChannel]);
      expect(mockPrisma.channel.findMany).toHaveBeenCalledWith({ where: { isActive: true } });
    });
  });

  describe('findByType', () => {
    it('should return channels of the given type', async () => {
      mockPrisma.channel.findMany.mockResolvedValue([mockChannel]);

      const result = await repository.findByType('slack');

      expect(result).toEqual([mockChannel]);
      expect(mockPrisma.channel.findMany).toHaveBeenCalledWith({ where: { type: 'slack' } });
    });
  });

  describe('create', () => {
    it('should create a channel', async () => {
      mockPrisma.channel.create.mockResolvedValue(mockChannel);

      const result = await repository.create({ type: 'slack', name: 'General' });

      expect(result).toEqual(mockChannel);
      expect(mockPrisma.channel.create).toHaveBeenCalledWith({
        data: { type: 'slack', name: 'General', config: {} },
      });
    });

    it('should pass config when provided', async () => {
      mockPrisma.channel.create.mockResolvedValue(mockChannel);

      await repository.create({ type: 'slack', name: 'General', config: { token: 'abc' } });

      expect(mockPrisma.channel.create).toHaveBeenCalledWith({
        data: { type: 'slack', name: 'General', config: { token: 'abc' } },
      });
    });

    it('should throw ConflictError on duplicate constraint', async () => {
      mockPrisma.channel.create.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['name'] },
      });

      await expect(repository.create({ type: 'slack', name: 'General' })).rejects.toThrow(
        ConflictError,
      );
    });
  });

  describe('update', () => {
    it('should update a channel', async () => {
      const updated = { ...mockChannel, name: 'Updated' };
      mockPrisma.channel.update.mockResolvedValue(updated);

      const result = await repository.update('ch-1', { name: 'Updated' });

      expect(result).toEqual(updated);
      expect(mockPrisma.channel.update).toHaveBeenCalledWith({
        where: { id: 'ch-1' },
        data: { name: 'Updated' },
      });
    });

    it('should throw NotFoundError when updating non-existent channel', async () => {
      mockPrisma.channel.update.mockRejectedValue({ code: 'P2025' });

      await expect(repository.update('missing', { name: 'X' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('should delete a channel', async () => {
      mockPrisma.channel.delete.mockResolvedValue(mockChannel);

      const result = await repository.delete('ch-1');

      expect(result).toEqual(mockChannel);
      expect(mockPrisma.channel.delete).toHaveBeenCalledWith({ where: { id: 'ch-1' } });
    });

    it('should throw NotFoundError when deleting non-existent channel', async () => {
      mockPrisma.channel.delete.mockRejectedValue({ code: 'P2025' });

      await expect(repository.delete('missing')).rejects.toThrow(NotFoundError);
    });
  });
});
