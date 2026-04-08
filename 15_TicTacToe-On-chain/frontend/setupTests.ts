import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";

// Jest 环境补充 TextEncoder，兼容部分依赖在 Node 下的编码调用。
if (!globalThis.TextEncoder) {
  globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
}

// Jest 环境补充 TextDecoder，避免浏览器 API 缺失导致测试失败。
if (!globalThis.TextDecoder) {
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}
