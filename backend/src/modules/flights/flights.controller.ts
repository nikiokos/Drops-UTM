import { Controller, Get, Post, Put, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FlightsService } from './flights.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Flights')
@ApiBearerAuth()
@Controller('flights')
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Get()
  @ApiOperation({ summary: 'List flights' })
  findAll(@Query() filters: Record<string, unknown>) {
    return this.flightsService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get flight details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.flightsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create flight plan' })
  create(@Body() data: Record<string, unknown>, @CurrentUser('id') userId: string) {
    return this.flightsService.create({ ...data, pilotId: userId } as any);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update flight plan' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() data: Record<string, unknown>) {
    return this.flightsService.update(id, data);
  }

  @Post(':id/authorize')
  @ApiOperation({ summary: 'Request flight authorization' })
  authorize(@Param('id', ParseUUIDPipe) id: string) {
    return this.flightsService.updateStatus(id, 'authorized');
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start flight' })
  start(@Param('id', ParseUUIDPipe) id: string) {
    return this.flightsService.update(id, { status: 'active', actualDeparture: new Date() } as any);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete flight' })
  complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.flightsService.update(id, {
      status: 'completed',
      actualArrival: new Date(),
    } as any);
  }

  @Post(':id/abort')
  @Roles('admin', 'hub_operator', 'pilot')
  @ApiOperation({ summary: 'Abort flight' })
  abort(@Param('id', ParseUUIDPipe) id: string) {
    return this.flightsService.updateStatus(id, 'cancelled');
  }
}
