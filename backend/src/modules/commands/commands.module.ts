import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DroneCommand } from './command.entity';
import { CommandsService } from './commands.service';
import { CommandsController } from './commands.controller';
import { GatewayModule } from '../../gateways/gateway.module';

@Module({
  imports: [TypeOrmModule.forFeature([DroneCommand]), GatewayModule],
  providers: [CommandsService],
  controllers: [CommandsController],
  exports: [CommandsService],
})
export class CommandsModule {}
