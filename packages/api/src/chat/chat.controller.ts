import { Controller, Get, NotFoundException, Param, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { SessionRepository } from '../db/session.repository.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JwtPayload } from '../auth/auth.types.js';

@ApiTags('chat')
@Controller('api/v1/chat')
export class ChatController {
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly prisma: PrismaService,
  ) {}

  @Get('sessions')
  async listSessions(
    @Req() req: { user: JwtPayload },
    @Query() query: { page?: number; limit?: number; channelId?: string },
  ) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);

    const result = await this.sessionRepo.findByUserId(req.user.sub, { page, limit }, query.channelId);

    return {
      success: true,
      data: result.data,
      meta: { total: result.meta.total, page, limit },
    };
  }

  @Get('sessions/:id/messages')
  async listMessages(
    @Req() req: { user: JwtPayload },
    @Param('id') sessionId: string,
    @Query() query: { page?: number; limit?: number },
  ) {
    const session = await this.sessionRepo.findById(sessionId);
    if (session.userId !== req.user.sub) {
      throw new NotFoundException('Session not found');
    }

    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 50, 100);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.sessionMessage.findMany({
        where: { sessionId, archivedAt: null },
        orderBy: { ordering: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.sessionMessage.count({ where: { sessionId, archivedAt: null } }),
    ]);

    return {
      success: true,
      data: data.reverse(), // Return in chronological order (oldest first)
      meta: { total, page, limit },
    };
  }
}
