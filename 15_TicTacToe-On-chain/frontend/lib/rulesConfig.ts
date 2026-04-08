import { RulesConfig, RulesMeta, ScoringRule } from "@/types/types";

// 默认每回合超时时间（秒），当链上读取失败时使用该值。
export const DEFAULT_TURN_TIMEOUT_SECONDS = 10 * 60;

// 默认计分口径：胜 +1、平 0、负 -1，取消局不计分。
export const SCORING_RULE: ScoringRule = {
  win: 1,
  draw: 0,
  loss: -1,
  cancelCounts: false,
};

// 规则弹窗基础文案配置（链上元数据只覆盖超时与计分等动态字段）。
export const BASE_RULES_CONFIG: RulesConfig = {
  quickFacts: [
    "两名玩家轮流落子，先连成一条线者获胜。",
    "每一步都上链记录，结果公开可验证。",
    "本项目默认采用轻授权流程：开局确认一次后，局内大多数操作无需反复弹窗。",
  ],
  basicRules: [
    "棋盘为 3x3，玩家分别使用 X 与 O。",
    "仅当前回合玩家可落子，已占用格子不可重复落子。",
    "任意横/竖/斜三连即胜；棋盘填满且无人三连为平局。",
  ],
  gameFlow: [
    "创建者先发起对局，另一名玩家加入后开始。",
    "进行中可选择继续落子、认输或在对手超时后申请判胜。",
    "等待中对局可由创建者取消（取消局不纳入历史积分）。",
  ],
  scoringNotes: [
    "胜利 +1 分，平局 0 分，失败 -1 分。",
    "仅双方都参与并结束的有效对局计入积分与历史。",
    "排行榜仅展示：对局数、总分。",
  ],
  timeoutNotes: [
    "当轮到对手行动且超过超时时间，可调用“超时判胜”。",
    "超时判胜与普通胜利同样计入有效对局与积分。",
  ],
  statsNotes: [
    "历史成绩会按你的主钱包统一统计，不影响输赢结果。",
    "界面会优先展示钱包地址，方便你识别对手。",
    "页面展示地址与链上原始地址可能不同，但统计口径一致。",
  ],
};

// 将结构化计分规则格式化为短句文案。
export const formatScoringSummary = (scoring: ScoringRule) =>
  `胜 ${scoring.win >= 0 ? "+" : ""}${scoring.win} 分 / 平 ${scoring.draw} 分 / 负 ${scoring.loss} 分`;

// 生成“取消局是否计分”的说明文案。
export const formatCancelSummary = (scoring: ScoringRule) =>
  scoring.cancelCounts ? "取消等待局会计入积分统计" : "取消等待局不计入积分统计";

// 秒转分钟文案，保留两位小数后去掉冗余 0。
export const formatTimeoutMinutes = (seconds: number) =>
  Number((seconds / 60).toFixed(2)).toString();

// 生成规则元信息默认值，供 store 初始化与异常回退复用。
export const createDefaultRulesMeta = (): RulesMeta => ({
  turnTimeoutSeconds: DEFAULT_TURN_TIMEOUT_SECONDS,
  loaded: false,
  usingFallback: true,
  scoring: SCORING_RULE,
});
