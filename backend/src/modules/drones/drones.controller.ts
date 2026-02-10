import { Controller, Get, Post, Put, Delete, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DronesService } from './drones.service';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Drones')
@ApiBearerAuth()
@Controller('drones')
export class DronesController {
  constructor(private readonly dronesService: DronesService) {}

  @Get()
  @ApiOperation({ summary: 'List all drones' })
  findAll() {
    return this.dronesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get drone details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.dronesService.findById(id);
  }

  @Post()
  @Roles('admin', 'hub_operator')
  @ApiOperation({ summary: 'Register new drone' })
  create(@Body() data: Record<string, unknown>) {
    return this.dronesService.create(data);
  }

  @Put(':id')
  @Roles('admin', 'hub_operator')
  @ApiOperation({ summary: 'Update drone' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() data: Record<string, unknown>) {
    return this.dronesService.update(id, data);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Retire drone' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.dronesService.remove(id);
  }
}
