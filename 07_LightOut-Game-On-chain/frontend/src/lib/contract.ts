import type { Abi } from "viem";
import { isAddress } from "viem";
import lightsOutAbiJson from "@/lib/generated/lights-out-abi.json";
import { getRuntimeConfig } from "@/lib/runtime-config";

// 从环境变量读取部署地址；在教学项目中由 make dev 自动写入
export const LIGHTS_OUT_ADDRESS =
  getRuntimeConfig().lightsOutAddress;

// 前端渲染前先校验地址合法性，避免后续 read/write 报错
export const LIGHTS_OUT_ADDRESS_VALID =
  !!LIGHTS_OUT_ADDRESS && isAddress(LIGHTS_OUT_ADDRESS);

// 仅保留前端需要的最小 ABI（事件 + 核心读写函数）
export const LIGHTS_OUT_ABI = lightsOutAbiJson as Abi;

// UI 密度枚举映射到合约约定的 uint8（0/1/2）
export const densityToIndex = (density: string) => {
  switch (density) {
    case "low":
      return 0;
    case "medium":
      return 1;
    case "high":
      return 2;
    default:
      return 1;
  }
};

// 链上枚举值映射回中文文案，便于记录面板展示
export const densityLabel = (value: number) => {
  switch (value) {
    case 0:
      return "低";
    case 1:
      return "中";
    case 2:
      return "高";
    default:
      return "未知";
  }
};
