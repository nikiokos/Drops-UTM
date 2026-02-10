import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SimulationSession } from './entities/simulation-session.entity';
import { SimulationController } from './simulation.controller';
import { SimulationEngineService } from './services/simulation-engine.service';
import { PhysicsModelService } from './services/physics-model.service';
import { ScenarioRunnerService } from './services/scenario-runner.service';
import { GatewayModule } from '../../gateways/gateway.module';
import { Drone } from '../drones/drone.entity';
import { Mission } from '../missions/mission.entity';
import { Waypoint } from '../missions/waypoint.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SimulationSession, Drone, Mission, Waypoint]),
    GatewayModule,
  ],
  controllers: [SimulationController],
  providers: [
    SimulationEngineService,
    PhysicsModelService,
    ScenarioRunnerService,
  ],
  exports: [SimulationEngineService, PhysicsModelService, ScenarioRunnerService],
})
export class SimulationModule {}
