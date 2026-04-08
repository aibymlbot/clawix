import { Injectable } from '@nestjs/common';

import { systemSettingsSchema, type SystemSettingsInput } from '@clawix/shared';
import { SystemSettingsRepository } from '../db/system-settings.repository.js';

@Injectable()
export class SystemSettingsService {
  constructor(private readonly repo: SystemSettingsRepository) {}

  async get(): Promise<SystemSettingsInput> {
    const row = await this.repo.get();
    return systemSettingsSchema.parse(row.settings);
  }

  async update(data: Record<string, unknown>): Promise<SystemSettingsInput> {
    const row = await this.repo.update(data);
    return systemSettingsSchema.parse(row.settings);
  }
}
