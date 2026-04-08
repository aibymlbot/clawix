import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { ChannelsModule } from '../channels/index.js';

@Module({
  imports: [ChannelsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
