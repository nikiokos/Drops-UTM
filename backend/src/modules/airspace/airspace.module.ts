import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AirspaceZone } from './airspace-zone.entity';
import { AirspaceService } from './airspace.service';
import { AirspaceController } from './airspace.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AirspaceZone])],
  providers: [AirspaceService],
  controllers: [AirspaceController],
  exports: [AirspaceService],
})
export class AirspaceModule {}
