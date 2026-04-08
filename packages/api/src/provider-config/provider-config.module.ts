import { Module, type OnModuleInit } from '@nestjs/common';
import { ProviderConfigController } from './provider-config.controller.js';
import { ProvidersController } from './providers.controller.js';
import { ProviderConfigService } from './provider-config.service.js';

@Module({
  controllers: [ProviderConfigController, ProvidersController],
  providers: [ProviderConfigService],
  exports: [ProviderConfigService],
})
export class ProviderConfigModule implements OnModuleInit {
  constructor(private readonly providerConfigService: ProviderConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.providerConfigService.seedFromEnv();
  }
}
