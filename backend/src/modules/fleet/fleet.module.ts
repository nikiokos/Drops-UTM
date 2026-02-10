import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetAssignment } from './fleet-assignment.entity';
import { RebalancingTask } from './rebalancing-task.entity';
import { FleetConfiguration } from './fleet-config.entity';
import { FleetController } from './fleet.controller';
import { ScoringEngineService } from './scoring-engine.service';
import { FleetStateService } from './fleet-state.service';
import { FleetOrchestratorService } from './fleet-orchestrator.service';
import { Drone } from '../drones/drone.entity';
import { Hub } from '../hubs/hub.entity';
import { Mission } from '../missions/mission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FleetAssignment,
      RebalancingTask,
      FleetConfiguration,
      Drone,
      Hub,
      Mission,
    ]),
  ],
  controllers: [FleetController],
  providers: [ScoringEngineService, FleetStateService, FleetOrchestratorService],
  exports: [ScoringEngineService, FleetStateService, FleetOrchestratorService],
})
export class FleetModule {}
