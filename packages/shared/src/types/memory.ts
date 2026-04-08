export type MemoryScope = 'private' | 'group' | 'org';
export type ShareTarget = 'GROUP' | 'ORG';
export type GroupMemberRole = 'OWNER' | 'MEMBER';
export type NotificationType = 'MEMORY_SHARED' | 'MEMORY_REVOKED' | 'GROUP_INVITE';

export interface Group {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly createdById: string;
  readonly createdAt: Date;
}

export interface GroupMember {
  readonly groupId: string;
  readonly userId: string;
  readonly role: GroupMemberRole;
  readonly joinedAt: Date;
}

export interface MemoryItem {
  readonly id: string;
  readonly ownerId: string;
  readonly content: Record<string, unknown>;
  readonly tags: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface MemoryShare {
  readonly id: string;
  readonly memoryItemId: string;
  readonly sharedBy: string;
  readonly targetType: ShareTarget;
  readonly groupId: string | null;
  readonly sharedAt: Date;
  readonly revokedAt: Date | null;
  readonly isRevoked: boolean;
}

export interface Notification {
  readonly id: string;
  readonly recipientId: string;
  readonly type: NotificationType;
  readonly payload: Record<string, unknown>;
  readonly isRead: boolean;
  readonly createdAt: Date;
}
