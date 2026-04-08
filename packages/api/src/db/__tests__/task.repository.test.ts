import { describe, it, expect, beforeEach } from 'vitest';

import { NotFoundError } from '@clawix/shared';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { TaskRepository } from '../task.repository.js';
import { createMockPrismaService, type MockPrismaService } from './mock-prisma.js';

describe('TaskRepository', () => {
  let repository: TaskRepository;
  let mockPrisma: MockPrismaService;

  const mockTask = {
    id: 'task-1',
    agentDefinitionId: 'agent-1',
    name: 'Daily Report',
    schedule: { type: 'cron', expression: '0 9 * * *' },
    prompt: 'Generate daily report',
    channelId: null,
    enabled: true,
    lastRunAt: null,
    lastStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const pagination = { page: 1, limit: 10 };

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    repository = new TaskRepository(mockPrisma as unknown as PrismaService);
  });

  describe('findById', () => {
    it('should return a task when found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(mockTask);

      const result = await repository.findById('task-1');

      expect(result).toEqual(mockTask);
      expect(mockPrisma.task.findUnique).toHaveBeenCalledWith({ where: { id: 'task-1' } });
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect(repository.findById('missing')).rejects.toThrow(NotFoundError);
    });
  });

  describe('findAll', () => {
    it('should return paginated tasks', async () => {
      mockPrisma.task.findMany.mockResolvedValue([mockTask]);
      mockPrisma.task.count.mockResolvedValue(1);

      const result = await repository.findAll(pagination);

      expect(result.data).toEqual([mockTask]);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
    });
  });

  describe('findEnabled', () => {
    it('should return only enabled tasks', async () => {
      mockPrisma.task.findMany.mockResolvedValue([mockTask]);

      const result = await repository.findEnabled();

      expect(result).toEqual([mockTask]);
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith({ where: { enabled: true } });
    });
  });

  describe('create', () => {
    it('should create a task with defaults', async () => {
      mockPrisma.task.create.mockResolvedValue(mockTask);

      const result = await repository.create({
        agentDefinitionId: 'agent-1',
        name: 'Daily Report',
        schedule: { type: 'cron', expression: '0 9 * * *' },
        prompt: 'Generate daily report',
      });

      expect(result).toEqual(mockTask);
      expect(mockPrisma.task.create).toHaveBeenCalledWith({
        data: {
          agentDefinitionId: 'agent-1',
          name: 'Daily Report',
          schedule: { type: 'cron', expression: '0 9 * * *' },
          prompt: 'Generate daily report',
          channelId: null,
          enabled: true,
        },
      });
    });

    it('should create a task with explicit channelId and enabled', async () => {
      mockPrisma.task.create.mockResolvedValue({ ...mockTask, channelId: 'ch-1', enabled: false });

      await repository.create({
        agentDefinitionId: 'agent-1',
        name: 'Daily Report',
        schedule: { type: 'cron', expression: '0 9 * * *' },
        prompt: 'Generate daily report',
        channelId: 'ch-1',
        enabled: false,
      });

      expect(mockPrisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ channelId: 'ch-1', enabled: false }) as unknown,
        }),
      );
    });
  });

  describe('update', () => {
    it('should update a task', async () => {
      const updated = { ...mockTask, name: 'Weekly Report' };
      mockPrisma.task.update.mockResolvedValue(updated);

      const result = await repository.update('task-1', { name: 'Weekly Report' });

      expect(result).toEqual(updated);
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { name: 'Weekly Report' },
      });
    });

    it('should update with minimal data and omit all other fields from data', async () => {
      mockPrisma.task.update.mockResolvedValue(mockTask);

      await repository.update('task-1', { enabled: false });

      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { enabled: false },
      });
    });

    it('should throw NotFoundError when updating non-existent task', async () => {
      mockPrisma.task.update.mockRejectedValue({ code: 'P2025' });

      await expect(repository.update('missing', { name: 'X' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateLastRun', () => {
    it('should update lastRunAt and lastStatus', async () => {
      const timestamp = new Date('2025-06-01T09:00:00Z');
      const updated = { ...mockTask, lastRunAt: timestamp, lastStatus: 'completed' };
      mockPrisma.task.update.mockResolvedValue(updated);

      const result = await repository.updateLastRun('task-1', 'completed', timestamp);

      expect(result).toEqual(updated);
      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: { lastRunAt: timestamp, lastStatus: 'completed' },
      });
    });
  });

  describe('delete', () => {
    it('should delete a task', async () => {
      mockPrisma.task.delete.mockResolvedValue(mockTask);

      const result = await repository.delete('task-1');

      expect(result).toEqual(mockTask);
      expect(mockPrisma.task.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } });
    });

    it('should throw NotFoundError when deleting non-existent task', async () => {
      mockPrisma.task.delete.mockRejectedValue({ code: 'P2025' });

      await expect(repository.delete('missing')).rejects.toThrow(NotFoundError);
    });
  });
});
