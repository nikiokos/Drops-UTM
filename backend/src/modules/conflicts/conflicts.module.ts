import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conflict } from './conflict.entity';
import { ConflictsService } from './conflicts.service';
import { ConflictsController } from './conflicts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Conflict])],
  providers: [ConflictsService],
  controllers: [ConflictsController],
  exports: [ConflictsService],
})
export class ConflictsModule {}
