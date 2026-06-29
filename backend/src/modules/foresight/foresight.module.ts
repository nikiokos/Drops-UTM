import { Module } from '@nestjs/common';
import { ForesightController } from './foresight.controller';
import { PredictionService } from './prediction.service';
import { DemoScenarioService } from './demo-scenario.service';
import { AirTrafficDirectorService } from './air-traffic-director.service';
import { AiModule } from '../ai/ai.module';
import { FlightsModule } from '../flights/flights.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { AdsbModule } from '../adsb/adsb.module';

@Module({
  imports: [AiModule, FlightsModule, TelemetryModule, AdsbModule],
  providers: [
    PredictionService,
    AirTrafficDirectorService,
    { provide: DemoScenarioService, useFactory: () => new DemoScenarioService(() => Date.now()) },
  ],
  controllers: [ForesightController],
})
export class ForesightModule {}
