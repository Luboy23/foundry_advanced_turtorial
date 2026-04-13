import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { FilesModule } from "./files/files.module";
import { ChainModule } from "./chain/chain.module";
import { IndexerModule } from "./indexer/indexer.module";
import { AuthModule } from "./auth/auth.module";
import { AuthorityModule } from "./authority/authority.module";
import { UniversityModule } from "./university/university.module";
import { StudentModule } from "./student/student.module";
import { CommonModule } from "./common/common.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env"
    }),
    PrismaModule,
    FilesModule,
    ChainModule,
    IndexerModule,
    AuthModule,
    AuthorityModule,
    UniversityModule,
    StudentModule,
    CommonModule
  ]
})
export class AppModule {}
