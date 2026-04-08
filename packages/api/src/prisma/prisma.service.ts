import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { createLogger } from '@clawix/shared';

const logger = createLogger('prisma');

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(ConfigService) configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>('DATABASE_URL');

    super({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  async onModuleInit() {
    logger.info('Connecting to database...');
    await this.$connect();
    logger.info('Database connected');
  }

  async onModuleDestroy() {
    logger.info('Disconnecting from database...');
    await this.$disconnect();
    logger.info('Database disconnected');
  }
}
