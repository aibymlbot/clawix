import { describe, it, expect, beforeEach } from 'vitest';

import { SystemSettingsRepository } from '../system-settings.repository.js';
import { createMockPrismaService, type MockPrismaService } from './mock-prisma.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

describe('SystemSettingsRepository', () => {
  let repo: SystemSettingsRepository;
  let mockPrisma: MockPrismaService;

  const mockSystemSettings = {
    id: 'default',
    name: 'Clawix',
    slug: 'clawix',
    settings: { cronDefaultTokenBudget: 10000 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = createMockPrismaService();
    repo = new SystemSettingsRepository(mockPrisma as unknown as PrismaService);
  });

  describe('get', () => {
    it('should return existing settings when found', async () => {
      mockPrisma.systemSettings.findUnique.mockResolvedValue(mockSystemSettings);

      const result = await repo.get();

      expect(result).toEqual(mockSystemSettings);
      expect(mockPrisma.systemSettings.findUnique).toHaveBeenCalledWith({
        where: { id: 'default' },
      });
      expect(mockPrisma.systemSettings.upsert).not.toHaveBeenCalled();
    });

    it('should create default row via upsert when none exists', async () => {
      const defaultRow = {
        id: 'default',
        name: 'Clawix',
        slug: 'clawix',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.systemSettings.findUnique.mockResolvedValue(null);
      mockPrisma.systemSettings.upsert.mockResolvedValue(defaultRow);

      const result = await repo.get();

      expect(result).toEqual(defaultRow);
      expect(mockPrisma.systemSettings.upsert).toHaveBeenCalledWith({
        where: { id: 'default' },
        create: { id: 'default', settings: {} },
        update: {},
      });
    });
  });

  describe('update', () => {
    it('should merge new settings into existing ones', async () => {
      const existingSettings = { cronDefaultTokenBudget: 10000 };
      const existing = { ...mockSystemSettings, settings: existingSettings };
      const newSettings = { defaultTimezone: 'America/New_York' };
      const merged = { ...existingSettings, ...newSettings };
      const updated = { ...mockSystemSettings, settings: merged };

      mockPrisma.systemSettings.findUnique.mockResolvedValue(existing);
      mockPrisma.systemSettings.upsert.mockResolvedValue(updated);

      const result = await repo.update(newSettings);

      expect(result).toEqual(updated);
      expect(mockPrisma.systemSettings.upsert).toHaveBeenCalledWith({
        where: { id: 'default' },
        create: { id: 'default', settings: merged },
        update: { settings: merged },
      });
    });

    it('should handle empty existing settings gracefully', async () => {
      const existing = { ...mockSystemSettings, settings: null };
      const newSettings = { cronExecutionTimeoutMs: 60000 };
      const updated = { ...mockSystemSettings, settings: newSettings };

      mockPrisma.systemSettings.findUnique.mockResolvedValue(existing);
      mockPrisma.systemSettings.upsert.mockResolvedValue(updated);

      const result = await repo.update(newSettings);

      expect(result).toEqual(updated);
      expect(mockPrisma.systemSettings.upsert).toHaveBeenCalledWith({
        where: { id: 'default' },
        create: { id: 'default', settings: newSettings },
        update: { settings: newSettings },
      });
    });
  });

  describe('updateIdentity', () => {
    it('should update name and slug', async () => {
      const updated = { ...mockSystemSettings, name: 'New Name', slug: 'new-name' };
      mockPrisma.systemSettings.upsert.mockResolvedValue(updated);

      const result = await repo.updateIdentity({ name: 'New Name', slug: 'new-name' });

      expect(result).toEqual(updated);
      expect(mockPrisma.systemSettings.upsert).toHaveBeenCalledWith({
        where: { id: 'default' },
        create: { id: 'default', name: 'New Name', slug: 'new-name', settings: {} },
        update: { name: 'New Name', slug: 'new-name' },
      });
    });

    it('should allow partial identity updates', async () => {
      const updated = { ...mockSystemSettings, name: 'Updated' };
      mockPrisma.systemSettings.upsert.mockResolvedValue(updated);

      const result = await repo.updateIdentity({ name: 'Updated' });

      expect(result).toEqual(updated);
      expect(mockPrisma.systemSettings.upsert).toHaveBeenCalledWith({
        where: { id: 'default' },
        create: { id: 'default', name: 'Updated', slug: 'clawix', settings: {} },
        update: { name: 'Updated' },
      });
    });
  });
});
