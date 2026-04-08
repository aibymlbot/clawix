import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module.js';
import { EngineModule } from '../engine/engine.module.js';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

@Module({
  imports: [DbModule, EngineModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
