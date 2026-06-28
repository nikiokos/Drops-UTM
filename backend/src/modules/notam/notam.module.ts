import { Module } from '@nestjs/common';
import { NotamService } from './notam.service';
import { NotamController } from './notam.controller';

@Module({
  providers: [NotamService],
  controllers: [NotamController],
  exports: [NotamService],
})
export class NotamModule {}
