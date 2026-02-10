import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AirspaceService } from './airspace.service';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Airspace')
@ApiBearerAuth()
@Controller('airspace')
export class AirspaceController {
  constructor(private readonly airspaceService: AirspaceService) {}

  @Get('zones')
  @ApiOperation({ summary: 'List airspace zones' })
  findAll(@Query('hubId') hubId?: string) {
    if (hubId) return this.airspaceService.findByHub(hubId);
    return this.airspaceService.findAll();
  }

  @Get('zones/:id')
  @ApiOperation({ summary: 'Get zone details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.airspaceService.findById(id);
  }

  @Post('zones')
  @Roles('admin', 'hub_operator')
  @ApiOperation({ summary: 'Create airspace zone' })
  create(@Body() data: Record<string, unknown>) {
    return this.airspaceService.create(data);
  }

  @Put('zones/:id')
  @Roles('admin', 'hub_operator')
  @ApiOperation({ summary: 'Update airspace zone' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() data: Record<string, unknown>) {
    return this.airspaceService.update(id, data);
  }

  @Delete('zones/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete airspace zone' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.airspaceService.remove(id);
  }
}
