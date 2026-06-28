import { Module } from '@nestjs/common';
import { OpenaipService } from './openaip.service';
import { OpenaipController } from './openaip.controller';

@Module({
  providers: [OpenaipService],
  controllers: [OpenaipController],
  exports: [OpenaipService],
})
export class OpenaipModule {}
