import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('skills')
@Controller('api/v1/skills')
export class SkillsController {
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

  @Post(':id/approve')
  approve(@Param('id') _id: string, @Body() _body: unknown) {
    return { message: 'Not implemented' };
  }

  @Post(':id/reject')
  reject(@Param('id') _id: string, @Body() _body: unknown) {
    return { message: 'Not implemented' };
  }
}
