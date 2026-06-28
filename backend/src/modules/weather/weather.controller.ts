import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WeatherService } from './weather.service';

@ApiTags('Weather')
@ApiBearerAuth()
@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  @Get('metar')
  @ApiOperation({ summary: 'Live METAR for Greek aerodromes (NOAA)' })
  getMetar(@Query('ids') ids?: string) {
    return this.weatherService.getMetar(ids);
  }

  @Get('taf')
  @ApiOperation({ summary: 'Live TAF for Greek aerodromes (NOAA)' })
  getTaf(@Query('ids') ids?: string) {
    return this.weatherService.getTaf(ids);
  }

  @Get('sigmet')
  @ApiOperation({ summary: 'Active SIGMETs for the Athinai FIR (NOAA)' })
  getSigmet() {
    return this.weatherService.getSigmet();
  }

  @Get('go-no-go/:hubId')
  @ApiOperation({ summary: 'GO / CAUTION / NO_GO flight recommendation for a hub' })
  getGoNoGo(@Param('hubId') hubId: string) {
    return this.weatherService.getGoNoGo(hubId);
  }

  @Get('current/:hubId')
  @ApiOperation({ summary: 'Get current weather at hub' })
  getCurrentWeather(@Param('hubId') hubId: string) {
    return this.weatherService.getCurrentWeather(hubId);
  }

  @Get('forecast/:hubId')
  @ApiOperation({ summary: 'Get weather forecast' })
  getForecast(@Param('hubId') hubId: string) {
    return this.weatherService.getForecast(hubId);
  }

  @Get('alerts/:hubId')
  @ApiOperation({ summary: 'Get weather alerts' })
  getAlerts(@Param('hubId') hubId: string) {
    return this.weatherService.getAlerts(hubId);
  }
}
