import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { FlightsModule } from '../modules/flights/flights.module';
import { TelemetryModule } from '../modules/telemetry/telemetry.module';

@Module({
  imports: [FlightsModule, TelemetryModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class GatewayModule {}
