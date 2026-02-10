import { Controller, Get, Post, Put, Delete, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HubsService } from './hubs.service';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Hubs')
@ApiBearerAuth()
@Controller('hubs')
export class HubsController {
  constructor(private readonly hubsService: HubsService) {}

  @Get()
  @ApiOperation({ summary: 'List all hubs' })
  findAll() {
    return this.hubsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get hub details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.hubsService.findById(id);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create new hub' })
  create(@Body() data: Record<string, unknown>) {
    return this.hubsService.create(data);
  }

  @Put(':id')
  @Roles('admin', 'hub_operator')
  @ApiOperation({ summary: 'Update hub' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() data: Record<string, unknown>) {
    return this.hubsService.update(id, data);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Deactivate hub' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.hubsService.remove(id);
  }
}
