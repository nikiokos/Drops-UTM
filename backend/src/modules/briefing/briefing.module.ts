import { Module } from '@nestjs/common';
import { BriefingService } from './briefing.service';
import { BriefingController } from './briefing.controller';
import { FlightsModule } from '../flights/flights.module';
import { WeatherModule } from '../weather/weather.module';
import { AirspaceModule } from '../airspace/airspace.module';
import { AdsbModule } from '../adsb/adsb.module';
import { AiModule } from '../ai/ai.module';
import { NotamModule } from '../notam/notam.module';

@Module({
  imports: [FlightsModule, WeatherModule, AirspaceModule, AdsbModule, AiModule, NotamModule],
  providers: [BriefingService],
  controllers: [BriefingController],
  exports: [BriefingService],
})
export class BriefingModule {}
