import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WeatherService } from './weather.service';

@ApiTags('Weather')
@ApiBearerAuth()
@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

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
