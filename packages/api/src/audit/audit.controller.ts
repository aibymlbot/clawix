import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { paginationSchema } from '@clawix/shared';
import type { PaginationInput } from '@clawix/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuditService } from './audit.service.js';

interface AuthRequest {
  user: { sub: string; email: string; role: string };
}

@ApiTags('audit')
@Controller('api/v1/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput,
    @Req() req: AuthRequest,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { user } = req;
    return this.auditService.findAll(
      query,
      { userId, action, resource, from, to },
      user.role,
      user.sub,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthRequest) {
    const { user } = req;
    return this.auditService.findById(id, user.role, user.sub);
  }
}
