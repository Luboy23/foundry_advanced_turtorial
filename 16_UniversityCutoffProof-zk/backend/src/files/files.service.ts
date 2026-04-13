import { Injectable } from "@nestjs/common";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadAppConfig } from "../config/app-config";

@Injectable()
// 文件存储服务。
// 后端只把“相对路径 + 元数据”写入数据库，真正的磁盘绝对路径由这一层统一解析。
export class FilesService {
  private readonly storageDir = path.resolve(process.cwd(), loadAppConfig().storageDir);

  async ensureStorageDir() {
    await mkdir(this.storageDir, { recursive: true });
  }

  async writeJson(relativePath: string, payload: unknown) {
    await this.ensureStorageDir();
    const absolutePath = path.join(this.storageDir, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    // 返回相对路径，避免数据库记录绑定当前机器的绝对目录结构。
    return relativePath;
  }

  getStorageDir() {
    return this.storageDir;
  }

  resolveAbsolutePath(relativePath: string) {
    return path.join(this.storageDir, relativePath);
  }
}
