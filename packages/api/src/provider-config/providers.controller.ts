import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { listProviders } from '@clawix/shared';

import { ProviderConfigService } from './provider-config.service.js';

@ApiTags('providers')
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providerConfigService: ProviderConfigService) {}

  @Get()
  async listEnabled() {
    const configs = await this.providerConfigService.findAll();
    const enabledConfigs = configs.filter((c) => c.isEnabled);
    const registrySpecs = listProviders();

    return enabledConfigs.map((c) => {
      const spec = registrySpecs.find((s) => s.name === c.provider);
      return {
        provider: c.provider,
        displayName: c.displayName,
        isDefault: c.isDefault,
        supportsTools: spec?.supportsTools ?? false,
        supportsThinking: spec?.supportsThinking ?? false,
        defaultModel: spec?.defaultModel ?? null,
      };
    });
  }
}
