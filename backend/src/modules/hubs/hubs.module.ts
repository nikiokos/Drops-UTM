import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hub } from './hub.entity';
import { HubsService } from './hubs.service';
import { HubsController } from './hubs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Hub])],
  providers: [HubsService],
  controllers: [HubsController],
  exports: [HubsService],
})
export class HubsModule {}
