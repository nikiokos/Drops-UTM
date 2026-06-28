import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DagrService } from './dagr.service';

@ApiTags('DAGR')
@ApiBearerAuth()
@Controller('dagr')
export class DagrController {
  constructor(private readonly dagrService: DagrService) {}

  @Get('config')
  @ApiOperation({ summary: 'DAGR WMS endpoint + layer config for the map overlay' })
  getConfig() {
    return this.dagrService.getConfig();
  }

  @Get('feature-info')
  @ApiOperation({ summary: 'Proxy DAGR WMS GetFeatureInfo (click-to-query a zone)' })
  getFeatureInfo(@Query() query: Record<string, string>) {
    return this.dagrService.getFeatureInfo(query);
  }

  @Post('check-points')
  @ApiOperation({ summary: 'On-demand check of waypoints against Greek DAGR drone zones (advisory)' })
  checkPoints(@Body() body: { points: { lat: number; lon: number }[] }) {
    return this.dagrService.checkPoints(body.points ?? []);
  }
}
