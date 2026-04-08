import { Injectable } from '@nestjs/common';
import { NotFoundError } from '@clawix/shared';

import type { PaginatedResponse, PaginationInput } from '@clawix/shared';
import type { ProviderConfigModel } from '../generated/prisma/models.js';

import { PrismaService } from '../prisma/prisma.service.js';
import { buildPaginatedResponse, buildPaginationArgs, handlePrismaError } from './utils.js';

type ProviderConfig = ProviderConfigModel;

interface CreateProviderConfigInput {
  readonly provider: string;
  readonly displayName: string;
  readonly apiKey: string;
  readonly apiBaseUrl?: string | null;
  readonly isDefault?: boolean;
}

interface UpdateProviderConfigInput {
  readonly apiKey?: string;
  readonly apiBaseUrl?: string | null;
  readonly isDefault?: boolean;
}

@Injectable()
export class ProviderConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ProviderConfig> {
    const config = await this.prisma.providerConfig.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundError('ProviderConfig', id);
    }

    return config;
  }

  async findAll(pagination: PaginationInput): Promise<PaginatedResponse<ProviderConfig>> {
    const paginationArgs = buildPaginationArgs(pagination);

    const [data, total] = await Promise.all([
      this.prisma.providerConfig.findMany({
        ...paginationArgs,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.providerConfig.count(),
    ]);

    return buildPaginatedResponse(data, total, pagination);
  }

  async findByProvider(provider: string): Promise<ProviderConfig | null> {
    return this.prisma.providerConfig.findUnique({ where: { provider } });
  }

  async findDefault(): Promise<ProviderConfig | null> {
    return this.prisma.providerConfig.findFirst({
      where: { isDefault: true },
    });
  }

  async create(data: CreateProviderConfigInput): Promise<ProviderConfig> {
    try {
      return await this.prisma.providerConfig.create({
        data: {
          provider: data.provider,
          displayName: data.displayName,
          apiKey: data.apiKey,
          ...(data.apiBaseUrl !== undefined ? { apiBaseUrl: data.apiBaseUrl } : {}),
          ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        },
      });
    } catch (error: unknown) {
      handlePrismaError(error, 'ProviderConfig');
    }
  }

  async update(id: string, data: UpdateProviderConfigInput): Promise<ProviderConfig> {
    try {
      return await this.prisma.providerConfig.update({
        where: { id },
        data: {
          ...(data.apiKey !== undefined ? { apiKey: data.apiKey } : {}),
          ...(data.apiBaseUrl !== undefined ? { apiBaseUrl: data.apiBaseUrl } : {}),
          ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        },
      });
    } catch (error: unknown) {
      handlePrismaError(error, 'ProviderConfig');
    }
  }

  async delete(id: string): Promise<ProviderConfig> {
    try {
      return await this.prisma.providerConfig.delete({ where: { id } });
    } catch (error: unknown) {
      handlePrismaError(error, 'ProviderConfig');
    }
  }
}
