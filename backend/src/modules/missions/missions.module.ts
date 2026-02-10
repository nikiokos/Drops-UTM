import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mission } from './mission.entity';
import { Waypoint } from './waypoint.entity';
import { MissionExecution } from './mission-execution.entity';
import { MissionsService } from './missions.service';
import { MissionsController } from './missions.controller';
import { MissionExecutorService } from './mission-executor.service';
import { GatewayModule } from '../../gateways/gateway.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Mission, Waypoint, MissionExecution]),
    GatewayModule,
  ],
  providers: [MissionsService, MissionExecutorService],
  controllers: [MissionsController],
  exports: [MissionsService, MissionExecutorService],
})
export class MissionsModule {}
