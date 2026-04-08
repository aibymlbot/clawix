import { z } from 'zod';

const groupMemberRoleSchema = z.enum(['OWNER', 'MEMBER']);

export const createGroupSchema = z.object({
  name: z.string().min(1, 'name is required').max(128),
  description: z.string().max(500).optional(),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(500).nullable().optional(),
});

export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const addGroupMemberSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  role: groupMemberRoleSchema.optional().default('MEMBER'),
});

export type AddGroupMemberInput = z.infer<typeof addGroupMemberSchema>;

export const updateGroupMemberSchema = z.object({
  role: groupMemberRoleSchema,
});

export type UpdateGroupMemberInput = z.infer<typeof updateGroupMemberSchema>;
