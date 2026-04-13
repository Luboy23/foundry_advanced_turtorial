import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { IndexerService } from "./indexer.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [IndexerService],
  exports: [IndexerService]
})
export class IndexerModule {}
