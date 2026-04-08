import { Injectable } from '@nestjs/common';
import { createLogger } from '@clawix/shared';
import type { ChannelAdapter, ChannelAdapterConfig, ChannelAdapterFactory } from '@clawix/shared';

const logger = createLogger('channels:registry');

@Injectable()
export class ChannelRegistry {
  private readonly factories = new Map<string, ChannelAdapterFactory>();

  register(type: string, factory: ChannelAdapterFactory): void {
    if (this.factories.has(type)) {
      throw new Error(`Channel adapter already registered for type: ${type}`);
    }

    logger.info({ type }, 'Registered channel adapter');
    this.factories.set(type, factory);
  }

  create(type: string, config: ChannelAdapterConfig): ChannelAdapter {
    const factory = this.factories.get(type);

    if (!factory) {
      throw new Error(`No channel adapter registered for type: ${type}`);
    }

    logger.info({ type, channelId: config.id, name: config.name }, 'Creating channel adapter');
    return factory(config);
  }

  getRegistered(): readonly string[] {
    return [...this.factories.keys()];
  }
}
