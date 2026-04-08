import { z } from 'zod';

const cronScheduleSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('at'),
    time: z.string().min(1),
  }),
  z.object({
    type: z.literal('every'),
    interval: z.string().min(1),
  }),
  z.object({
    type: z.literal('cron'),
    expression: z.string().min(1),
    tz: z.string().min(1).optional(),
  }),
]);

export const createTaskSchema = z.object({
  agentDefinitionId: z.string().cuid(),
  name: z.string().min(1).max(255),
  schedule: cronScheduleSchema,
  prompt: z.string().min(1).max(10000),
  channelId: z.string().cuid().nullable().optional(),
  enabled: z.boolean().default(true),
  timeoutMs: z.number().int().positive().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  schedule: cronScheduleSchema.optional(),
  prompt: z.string().min(1).max(10000).optional(),
  channelId: z.string().cuid().nullable().optional(),
  enabled: z.boolean().optional(),
  timeoutMs: z.number().int().positive().nullable().optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
