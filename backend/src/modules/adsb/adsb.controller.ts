import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdsbService } from './adsb.service';

@ApiTags('ADS-B')
@ApiBearerAuth()
@Controller('adsb')
export class AdsbController {
  constructor(private readonly adsbService: AdsbService) {}

  @Get('aircraft')
  @ApiOperation({ summary: 'Live manned-aircraft positions (ADS-B) over Greece' })
  async getAircraft() {
    const aircraft = await this.adsbService.getAircraft();
    return {
      count: aircraft.length,
      updatedAt: new Date().toISOString(),
      source: 'adsb.lol (ODbL)',
      attribution: 'Data: adsb.lol contributors (ODbL 1.0)',
      aircraft,
    };
  }
}
