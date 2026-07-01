import { Module } from '@nestjs/common';
import { FeasibilityController } from './feasibility.controller';
import { FeasibilityService } from './feasibility.service';
import { EnergyModelService } from './energy-model.service';
import { AiModule } from '../ai/ai.module';
import { DronesModule } from '../drones/drones.module';
import { MissionsModule } from '../missions/missions.module';
import { WeatherModule } from '../weather/weather.module';

@Module({
  imports: [AiModule, DronesModule, MissionsModule, WeatherModule],
  providers: [EnergyModelService, FeasibilityService],
  controllers: [FeasibilityController],
})
export class FeasibilityModule {}
