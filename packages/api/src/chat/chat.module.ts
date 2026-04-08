import { Module } from '@nestjs/common';

import { DbModule } from '../db/db.module.js';
import { ChatController } from './chat.controller.js';

@Module({
  imports: [DbModule],
  controllers: [ChatController],
})
export class ChatModule {}
