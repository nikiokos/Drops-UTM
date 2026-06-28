import { Module } from '@nestjs/common';
import { AdsbService } from './adsb.service';
import { AdsbController } from './adsb.controller';

@Module({
  providers: [AdsbService],
  controllers: [AdsbController],
  exports: [AdsbService],
})
export class AdsbModule {}
