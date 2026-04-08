import { z } from 'zod';

export const createProviderConfigSchema = z.object({
  provider: z
    .string()
    .min(1, 'provider is required')
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'provider must be lowercase alphanumeric with hyphens'),
  displayName: z.string().min(1, 'displayName is required').max(128),
  apiKey: z.string().min(1, 'apiKey is required'),
  apiBaseUrl: z.string().url('apiBaseUrl must be a valid URL').optional(),
  isEnabled: z.boolean().optional().default(true),
  isDefault: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export type CreateProviderConfigInput = z.infer<typeof createProviderConfigSchema>;

export const updateProviderConfigSchema = z.object({
  displayName: z.string().min(1).max(128).optional(),
  apiKey: z.string().min(1).optional(),
  apiBaseUrl: z.string().url('apiBaseUrl must be a valid URL').nullable().optional(),
  isEnabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type UpdateProviderConfigInput = z.infer<typeof updateProviderConfigSchema>;
