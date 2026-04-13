import { Module } from "@nestjs/common";
import { AuthorityController } from "./authority.controller";
import { AuthorityService } from "./authority.service";
import { FilesModule } from "../files/files.module";
import { IndexerModule } from "../indexer/indexer.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [FilesModule, IndexerModule, AuthModule],
  controllers: [AuthorityController],
  providers: [AuthorityService],
  exports: [AuthorityService]
})
export class AuthorityModule {}
