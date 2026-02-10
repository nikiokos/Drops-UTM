import { Controller, Get, Post, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TelemetryService } from './telemetry.service';

@ApiTags('Telemetry')
@ApiBearerAuth()
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post()
  @ApiOperation({ summary: 'Ingest telemetry data' })
  ingest(@Body() data: Record<string, unknown>) {
    return this.telemetryService.ingest(data as any);
  }

  @Get('flight/:flightId')
  @ApiOperation({ summary: 'Get flight telemetry' })
  getByFlight(
    @Param('flightId', ParseUUIDPipe) flightId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.telemetryService.getByFlight(
      flightId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('flight/:flightId/latest')
  @ApiOperation({ summary: 'Get latest flight telemetry' })
  getLatest(@Param('flightId', ParseUUIDPipe) flightId: string) {
    return this.telemetryService.getLatest(flightId);
  }

  @Get('drone/:droneId/latest')
  @ApiOperation({ summary: 'Get latest drone telemetry' })
  getByDrone(@Param('droneId', ParseUUIDPipe) droneId: string) {
    return this.telemetryService.getByDrone(droneId);
  }
}
