import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('messages')
@Controller('api/v1/messages')
export class MessagesController {
  @Get()
  findAll(@Query('channelId') _channelId?: string, @Query('sessionId') _sessionId?: string) {
    return { message: 'Not implemented' };
  }

  @Get(':id')
  findOne(@Param('id') _id: string) {
    return { message: 'Not implemented' };
  }
}
