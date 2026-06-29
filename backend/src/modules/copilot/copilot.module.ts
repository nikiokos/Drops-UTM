import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CopilotService } from './copilot.service';
import { CopilotController } from './copilot.controller';
import { AiModule } from '../ai/ai.module';
import { FlightsModule } from '../flights/flights.module';
import { DronesModule } from '../drones/drones.module';
import { HubsModule } from '../hubs/hubs.module';
import { FleetModule } from '../fleet/fleet.module';
import { ConflictsModule } from '../conflicts/conflicts.module';
import { WeatherModule } from '../weather/weather.module';
import { NotamModule } from '../notam/notam.module';
import { AdsbModule } from '../adsb/adsb.module';
import { BriefingModule } from '../briefing/briefing.module';
import { EmergencyIncident } from '../emergency/incident.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmergencyIncident]),
    AiModule,
    FlightsModule,
    DronesModule,
    HubsModule,
    FleetModule,
    ConflictsModule,
    WeatherModule,
    NotamModule,
    AdsbModule,
    BriefingModule,
  ],
  providers: [CopilotService],
  controllers: [CopilotController],
})
export class CopilotModule {}
