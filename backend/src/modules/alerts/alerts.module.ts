import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DroneAlert } from './alert.entity';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { GatewayModule } from '../../gateways/gateway.module';

@Module({
  imports: [TypeOrmModule.forFeature([DroneAlert]), GatewayModule],
  providers: [AlertsService],
  controllers: [AlertsController],
  exports: [AlertsService],
})
export class AlertsModule {}
