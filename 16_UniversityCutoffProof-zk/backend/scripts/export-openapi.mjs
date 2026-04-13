import "reflect-metadata";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { NestFactory } from "@nestjs/core";

process.env.BACKEND_ROOT_DIR ??= process.cwd();
process.env.BACKEND_INDEXER_ENABLED ??= "false";

const appModuleUrl = pathToFileURL(path.resolve(process.cwd(), "dist/app.module.js")).href;
const documentUrl = pathToFileURL(path.resolve(process.cwd(), "dist/openapi/document.js")).href;

const [{ AppModule }, { createOpenApiDocument }] = await Promise.all([
  import(appModuleUrl),
  import(documentUrl)
]);

const app = await NestFactory.create(AppModule, { logger: false });
await app.init();

const document = createOpenApiDocument(app);
const outputPath = path.resolve(process.cwd(), "openapi.json");
writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");

await app.close();

console.log(`OpenAPI document written to ${outputPath}`);
