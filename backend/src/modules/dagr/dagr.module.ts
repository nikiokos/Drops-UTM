import { Module } from '@nestjs/common';
import { DagrService } from './dagr.service';
import { DagrController } from './dagr.controller';

@Module({
  providers: [DagrService],
  controllers: [DagrController],
  exports: [DagrService],
})
export class DagrModule {}
