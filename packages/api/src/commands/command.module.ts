import { Module } from '@nestjs/common';

import { DbModule } from '../db/index.js';
import { EngineModule } from '../engine/engine.module.js';
import { PrismaModule } from '../prisma/index.js';
import { CommandService } from './command.service.js';
import { ResetCommand } from './reset.command.js';
import { CompactCommand } from './compact.command.js';
import { HelpCommand } from './help.command.js';

@Module({
  imports: [DbModule, EngineModule, PrismaModule],
  providers: [
    ResetCommand,
    CompactCommand,
    HelpCommand,
    {
      provide: CommandService,
      useFactory: (
        resetCommand: ResetCommand,
        compactCommand: CompactCommand,
        helpCommand: HelpCommand,
      ) => {
        const service = new CommandService([resetCommand, compactCommand, helpCommand]);
        helpCommand.setCommandListGetter(() => service.getAll());
        return service;
      },
      inject: [ResetCommand, CompactCommand, HelpCommand],
    },
  ],
  exports: [CommandService],
})
export class CommandModule {}
