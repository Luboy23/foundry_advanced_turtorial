import "reflect-metadata";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadAppConfig } from "./config/app-config";
import { AppModule } from "./app.module";
import { createOpenApiDocument } from "./openapi/document";

async function bootstrap() {
  const appConfig = loadAppConfig();
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.setGlobalPrefix("");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false
    })
  );

  if (appConfig.swaggerEnabled) {
    const document = createOpenApiDocument(app);
    SwaggerModule.setup("api/docs", app, document);
    app.getHttpAdapter().get("/api/openapi.json", (_req: unknown, res: { json: (value: unknown) => void }) => {
      res.json(document);
    });
  } else {
    app.getHttpAdapter().get(
      "/api/openapi.json",
      (_req: unknown, res: {
        json: (value: unknown) => void;
        status: (code: number) => { json: (value: unknown) => void };
      }) => {
        const openapiPath = path.resolve(process.cwd(), "openapi.json");
        if (!existsSync(openapiPath)) {
          res.status(404).json({ ok: false, message: "OpenAPI 文档尚未导出。" });
          return;
        }
        const raw = JSON.parse(readFileSync(openapiPath, "utf8")) as unknown;
        res.json(raw);
      }
    );
  }

  await app.listen(appConfig.port, appConfig.host);
}

void bootstrap();
