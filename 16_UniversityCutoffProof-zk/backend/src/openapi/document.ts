import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

// OpenAPI 文档导出入口。
// 前端生成类型时只依赖这份文档，因此这里要尽量稳定，不夹带运行时分支。
export function createOpenApiDocument(app: INestApplication) {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("UniversityCutoffProof-zk Backend")
      .setDescription("NestJS workbench backend for the admission demo")
      .setVersion("1.0.0")
      .build()
  );
}
