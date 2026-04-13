import { Module } from "@nestjs/common";
import { UniversityController } from "./university.controller";
import { UniversityService } from "./university.service";
import { IndexerModule } from "../indexer/indexer.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [IndexerModule, AuthModule],
  controllers: [UniversityController],
  providers: [UniversityService],
  exports: [UniversityService]
})
export class UniversityModule {}
