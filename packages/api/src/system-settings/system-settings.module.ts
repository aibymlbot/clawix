import { Module } from '@nestjs/common';

import { DbModule } from '../db/db.module.js';
import { SystemSettingsRepository } from '../db/system-settings.repository.js';
import { SystemSettingsController } from './system-settings.controller.js';
import { SystemSettingsService } from './system-settings.service.js';

@Module({
  imports: [DbModule],
  controllers: [SystemSettingsController],
  providers: [SystemSettingsService, SystemSettingsRepository],
  exports: [SystemSettingsService],
})
export class SystemSettingsModule {}
