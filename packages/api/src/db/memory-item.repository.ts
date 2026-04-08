import { Injectable } from '@nestjs/common';

import type { MemoryItem } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { extractText } from '../engine/memory-utils.js';

/**
 * Repository for querying MemoryItem records visible to a user.
 *
 * Visibility rules:
 *  - Private: owned by the user
 *  - Group-shared: shared to a group the user belongs to (not revoked)
 *  - Org-shared: shared to the entire org (not revoked)
 */
@Injectable()
export class MemoryItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all memory items visible to the given user, ordered by most recent first.
   */
  async findVisibleToUser(userId: string): Promise<readonly MemoryItem[]> {
    const groupRows = await this.prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    });
    const groupIds = groupRows.map((r) => r.groupId);

    return this.prisma.memoryItem.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            shares: {
              some: {
                targetType: 'GROUP',
                groupId: { in: groupIds },
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
  }

  /**
   * Search visible memory items by text content and/or tags.
   *
   * Two-pass approach: fetches all visible items via findVisibleToUser,
   * then filters in-app by query (case-insensitive substring on content.text)
   * and tags (AND — all specified tags must be present).
   */
  async search(
    userId: string,
    options: {
      readonly query?: string;
      readonly tags?: readonly string[];
      readonly maxResults?: number;
    },
  ): Promise<readonly MemoryItem[]> {
    const allVisible = await this.findVisibleToUser(userId);
    const maxResults = options.maxResults ?? 20;

    let filtered = allVisible as MemoryItem[];

    if (options.query) {
      const lowerQuery = options.query.toLowerCase();
      filtered = filtered.filter((item) => {
        const text = extractText(item.content);
        return text.toLowerCase().includes(lowerQuery);
      });
    }

    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter((item) => options.tags!.every((tag) => item.tags.includes(tag)));
    }

    return filtered.slice(0, maxResults);
  }
}
