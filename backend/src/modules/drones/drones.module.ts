import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Drone } from './drone.entity';
import { DronesService } from './drones.service';
import { DronesController } from './drones.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Drone])],
  providers: [DronesService],
  controllers: [DronesController],
  exports: [DronesService],
})
export class DronesModule {}
