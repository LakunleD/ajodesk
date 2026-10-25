import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Collector } from './collector.entity';
import { CollectorsService } from './collectors.service';

@Module({
  imports: [TypeOrmModule.forFeature([Collector])],
  providers: [CollectorsService],
  exports: [CollectorsService],
})
export class CollectorsModule {}
