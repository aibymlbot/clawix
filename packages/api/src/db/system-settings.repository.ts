import { Injectable } from '@nestjs/common';

import type { SystemSettings } from '../generated/prisma/client.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DEFAULT_ID = 'default';

interface UpdateIdentityData {
  readonly name?: string;
  readonly slug?: string;
  readonly settings?: Prisma.InputJsonValue;
}

@Injectable()
export class SystemSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<SystemSettings> {
    const existing = await this.prisma.systemSettings.findUnique({
      where: { id: DEFAULT_ID },
    });
    if (existing) return existing;

    return this.prisma.systemSettings.upsert({
      where: { id: DEFAULT_ID },
      create: { id: DEFAULT_ID, settings: {} },
      update: {},
    });
  }

  async update(settings: Record<string, unknown>): Promise<SystemSettings> {
    const current = await this.get();
    const raw = current.settings as Record<string, unknown> | null;
    const currentSettings = raw ?? {};
    const merged = { ...currentSettings, ...settings } as Prisma.InputJsonValue;

    return this.prisma.systemSettings.upsert({
      where: { id: DEFAULT_ID },
      create: { id: DEFAULT_ID, settings: merged },
      update: { settings: merged },
    });
  }

  async updateIdentity(data: UpdateIdentityData): Promise<SystemSettings> {
    return this.prisma.systemSettings.upsert({
      where: { id: DEFAULT_ID },
      create: {
        id: DEFAULT_ID,
        name: data.name ?? 'Clawix',
        slug: data.slug ?? 'clawix',
        settings: data.settings ?? {},
      },
      update: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.settings !== undefined ? { settings: data.settings } : {}),
      },
    });
  }
}
