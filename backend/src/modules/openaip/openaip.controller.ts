import { Controller, Get, Param, Res, Header } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { OpenaipService } from './openaip.service';

@ApiTags('openAIP')
@Controller('openaip')
export class OpenaipController {
  constructor(private readonly openaipService: OpenaipService) {}

  @Get('airspaces')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Greek airspace structure from openAIP' })
  async getAirspaces() {
    const airspaces = await this.openaipService.getAirspaces();
    return {
      count: airspaces.length,
      enabled: this.openaipService.hasKey(),
      source: 'openAIP (CC BY-NC-SA)',
      attribution: 'Airspace data © openAIP contributors (CC BY-NC-SA)',
      airspaces,
    };
  }

  // Public so Leaflet <img> tile requests work without an auth header.
  @Get('tiles/:z/:x/:y')
  @Public()
  @Header('Cache-Control', 'public, max-age=86400')
  @ApiOperation({ summary: 'Proxied openAIP raster map tile' })
  async getTile(
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Res() res: Response,
  ) {
    const buf = await this.openaipService.getTile(z, x, y);
    if (!buf) {
      res.status(204).end();
      return;
    }
    res.set('Content-Type', 'image/png');
    res.send(buf);
  }
}
