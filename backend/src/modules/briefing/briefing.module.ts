import { Module } from '@nestjs/common';
import { BriefingService } from './briefing.service';
import { BriefingController } from './briefing.controller';
import { FlightsModule } from '../flights/flights.module';
import { WeatherModule } from '../weather/weather.module';
import { AirspaceModule } from '../airspace/airspace.module';
import { AdsbModule } from '../adsb/adsb.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [FlightsModule, WeatherModule, AirspaceModule, AdsbModule, AiModule],
  providers: [BriefingService],
  controllers: [BriefingController],
})
export class BriefingModule {}
