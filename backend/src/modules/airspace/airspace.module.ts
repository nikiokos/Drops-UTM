import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AirspaceZone } from './airspace-zone.entity';
import { AirspaceService } from './airspace.service';
import { AirspaceController } from './airspace.controller';
import { OpenaipModule } from '../openaip/openaip.module';

@Module({
  imports: [TypeOrmModule.forFeature([AirspaceZone]), OpenaipModule],
  providers: [AirspaceService],
  controllers: [AirspaceController],
  exports: [AirspaceService],
})
export class AirspaceModule {}
