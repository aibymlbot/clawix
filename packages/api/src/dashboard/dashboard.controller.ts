import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service.js';

interface AuthRequest {
  user: { sub: string; role: string };
}

@ApiTags('dashboard')
@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getStats(@Req() req: AuthRequest) {
    const { user } = req;
    return this.dashboardService.getStats(user.sub, user.role);
  }

  @Get('recent-runs')
  getRecentRuns(@Req() req: AuthRequest) {
    const { user } = req;
    return this.dashboardService.getRecentRuns(user.sub, user.role);
  }

  @Get('recent-activity')
  getRecentActivity(@Req() req: AuthRequest) {
    const { user } = req;
    return this.dashboardService.getRecentActivity(user.sub, user.role);
  }
}
