import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('channels')
@Controller('api/v1/channels')
export class ChannelsController {
  @Get()
  findAll() {
    return { message: 'Not implemented' };
  }

  @Get(':id')
  findOne(@Param('id') _id: string) {
    return { message: 'Not implemented' };
  }

  @Post()
  create(@Body() _body: unknown) {
    return { message: 'Not implemented' };
  }

  @Patch(':id')
  update(@Param('id') _id: string, @Body() _body: unknown) {
    return { message: 'Not implemented' };
  }

  @Delete(':id')
  remove(@Param('id') _id: string) {
    return { message: 'Not implemented' };
  }
}
