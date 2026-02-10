import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MissionTemplate } from './template.entity';
import { Mission } from '../missions/mission.entity';
import { Waypoint } from '../missions/waypoint.entity';
import { Hub } from '../hubs/hub.entity';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MissionTemplate, Mission, Waypoint, Hub])],
  providers: [TemplatesService],
  controllers: [TemplatesController],
  exports: [TemplatesService],
})
export class TemplatesModule {}
