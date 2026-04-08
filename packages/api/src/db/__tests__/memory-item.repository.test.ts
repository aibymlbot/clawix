import { describe, it, expect, beforeEach } from 'vitest';

import { MemoryItemRepository } from '../memory-item.repository.js';
import { createMockPrismaService, type MockPrismaService } from './mock-prisma.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

describe('MemoryItemRepository', () => {
  let repo: MemoryItemRepository;
  let mockPrisma: MockPrismaService;

  const mockMemoryItem = {
    id: 'mem-1',
    ownerId: 'user-1',
    content: { text: 'User prefers concise answers' },
    tags: ['preference'],
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-15'),
  };

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    repo = new MemoryItemRepository(mockPrisma as unknown as PrismaService);
  });

  describe('findVisibleToUser', () => {
    it('should query with OR conditions for private, group-shared, and org-shared items', async () => {
      mockPrisma.groupMember.findMany.mockResolvedValue([{ groupId: 'group-1', userId: 'user-1' }]);
      mockPrisma.memoryItem.findMany.mockResolvedValue([mockMemoryItem]);

      const result = await repo.findVisibleToUser('user-1');

      expect(mockPrisma.groupMember.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { groupId: true },
      });

      expect(mockPrisma.memoryItem.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { ownerId: 'user-1' },
            {
              shares: {
                some: {
                  targetType: 'GROUP',
                  groupId: { in: ['group-1'] },
                  isRevoked: false,
                },
              },
            },
            {
              shares: {
                some: {
                  targetType: 'ORG',
                  isRevoked: false,
                },
              },
            },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });

      expect(result).toEqual([mockMemoryItem]);
    });

    it('should handle user with no group memberships', async () => {
      mockPrisma.groupMember.findMany.mockResolvedValue([]);
      mockPrisma.memoryItem.findMany.mockResolvedValue([mockMemoryItem]);

      await repo.findVisibleToUser('user-1');

      const call = mockPrisma.memoryItem.findMany.mock.calls[0]![0]!;
      const orClauses = (call as Record<string, unknown>)['where'] as Record<string, unknown[]>;
      const groupClause = orClauses['OR']![1] as Record<string, unknown>;
      const shares = groupClause['shares'] as Record<string, Record<string, unknown>>;
      expect(shares['some']!['groupId']).toEqual({ in: [] });
    });

    it('should return empty array when no memory items exist', async () => {
      mockPrisma.groupMember.findMany.mockResolvedValue([]);
      mockPrisma.memoryItem.findMany.mockResolvedValue([]);

      const result = await repo.findVisibleToUser('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('search', () => {
    const mockItems = [
      {
        id: 'mem-1',
        ownerId: 'user-1',
        content: { text: 'User prefers dark mode' },
        tags: ['preference', 'ui'],
        createdAt: new Date('2026-03-01'),
        updatedAt: new Date('2026-03-15'),
      },
      {
        id: 'mem-2',
        ownerId: 'user-2',
        content: { text: 'API uses OAuth2' },
        tags: ['project', 'decision'],
        createdAt: new Date('2026-03-02'),
        updatedAt: new Date('2026-03-14'),
      },
      {
        id: 'mem-3',
        ownerId: 'user-1',
        content: { text: 'Dark theme is preferred for all dashboards' },
        tags: ['preference'],
        createdAt: new Date('2026-03-03'),
        updatedAt: new Date('2026-03-13'),
      },
    ];

    beforeEach(() => {
      mockPrisma.groupMember.findMany.mockResolvedValue([]);
      mockPrisma.memoryItem.findMany.mockResolvedValue(mockItems);
    });

    it('filters by query (case-insensitive substring on content.text)', async () => {
      const result = await repo.search('user-1', { query: 'dark' });

      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('mem-1');
      expect(result[1]!.id).toBe('mem-3');
    });

    it('filters by tags (AND logic — all tags must be present)', async () => {
      const result = await repo.search('user-1', { tags: ['preference', 'ui'] });

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('mem-1');
    });

    it('filters by query + tags combined (AND)', async () => {
      const result = await repo.search('user-1', { query: 'dark', tags: ['preference', 'ui'] });

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('mem-1');
    });

    it('returns empty array when no matches', async () => {
      const result = await repo.search('user-1', { query: 'nonexistent' });

      expect(result).toEqual([]);
    });

    it('limits results to maxResults (default 20)', async () => {
      const manyItems = Array.from({ length: 25 }, (_, i) => ({
        ...mockItems[0]!,
        id: `mem-${i}`,
        updatedAt: new Date(2026, 2, i + 1),
      }));
      mockPrisma.memoryItem.findMany.mockResolvedValue(manyItems);

      const result = await repo.search('user-1', { query: 'dark' });

      expect(result).toHaveLength(20);
    });

    it('accepts a custom maxResults', async () => {
      const result = await repo.search('user-1', { query: 'dark', maxResults: 1 });

      expect(result).toHaveLength(1);
    });
  });
});
