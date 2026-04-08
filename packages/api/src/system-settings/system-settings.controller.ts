import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { updateSystemSettingsSchema } from '@clawix/shared';
import { SystemSettingsService } from './system-settings.service.js';

@ApiTags('system-settings')
@Controller('api/v1/system-settings')
export class SystemSettingsController {
  constructor(private readonly service: SystemSettingsService) {}

  @Get()
  async get() {
    return { success: true, data: await this.service.get() };
  }

  @Patch()
  async update(@Body() body: unknown) {
    const data = updateSystemSettingsSchema.parse(body);
    return { success: true, data: await this.service.update(data) };
  }
}
