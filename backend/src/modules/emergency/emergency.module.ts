import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmergencyIncident } from './incident.entity';
import { BlackboxEntry } from './blackbox.entity';
import { EmergencyProtocol, EmergencyConfig } from './protocol.entity';
import { Hub } from '../hubs/hub.entity';
import { Flight } from '../flights/flight.entity';
import { DetectionService } from './detection.service';
import { DecisionEngineService } from './decision-engine.service';
import { ResponseExecutorService } from './response-executor.service';
import { EmergencyController } from './emergency.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmergencyIncident,
      BlackboxEntry,
      EmergencyProtocol,
      EmergencyConfig,
      Hub,
      Flight,
    ]),
  ],
  controllers: [EmergencyController],
  providers: [DetectionService, DecisionEngineService, ResponseExecutorService],
  exports: [TypeOrmModule, DetectionService, DecisionEngineService, ResponseExecutorService],
})
export class EmergencyModule {}
