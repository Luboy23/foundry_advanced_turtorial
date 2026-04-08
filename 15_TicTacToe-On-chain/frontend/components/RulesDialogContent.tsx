"use client";

import {
  BASE_RULES_CONFIG,
  formatCancelSummary,
  formatScoringSummary,
  formatTimeoutMinutes,
} from "@/lib/rulesConfig";
import {
  PROJECT_INFO_CARD_CLASS,
  PROJECT_SECTION_CLASS,
  PROJECT_TITLE_CLASS,
  PROJECT_VALUE_SUBTLE_CLASS,
} from "@/lib/projectTheme";
import { useGameStore } from "@/store/useGameStore";

function RuleSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold text-primary">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

// 规则弹窗主体：提供“3 句话上手 + 详细说明”的双层结构。
export default function RulesDialogContent() {
  const { rulesMeta, isRulesLoading } = useGameStore();
  const timeoutMinutes = formatTimeoutMinutes(rulesMeta.turnTimeoutSeconds);
  const scoringSummary = formatScoringSummary(rulesMeta.scoring);
  const cancelSummary = formatCancelSummary(rulesMeta.scoring);
  const quickStart = [
    "先连接右上角钱包，再创建新对局或进入大厅加入已有对局。",
    "轮到你时点击棋盘空位落子，率先横竖斜三连即可获胜。",
    `若对手超过 ${timeoutMinutes} 分钟未行动，你可以直接发起超时判胜。`,
  ];

  return (
    <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
      <section className={`${PROJECT_INFO_CARD_CLASS} p-4`}>
        <p className={`text-sm ${PROJECT_TITLE_CLASS}`}>3 句话快速上手</p>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          {quickStart.map((item, index) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className={`${PROJECT_SECTION_CLASS} p-4 space-y-2`}>
        <p className={`text-sm ${PROJECT_TITLE_CLASS}`}>补充说明</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {BASE_RULES_CONFIG.quickFacts.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <RuleSection title="基础玩法" items={BASE_RULES_CONFIG.basicRules} />
      <RuleSection title="对局流程" items={BASE_RULES_CONFIG.gameFlow} />

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-primary">计分规则</h3>
        <p className={`text-sm ${PROJECT_VALUE_SUBTLE_CLASS}`}>{scoringSummary}</p>
        <p className="text-sm text-muted-foreground">{cancelSummary}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {BASE_RULES_CONFIG.scoringNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-base font-semibold text-primary">超时机制</h3>
        <p className={`text-sm ${PROJECT_VALUE_SUBTLE_CLASS}`}>
          当前回合超时：{timeoutMinutes} 分钟
          {isRulesLoading ? "（读取中...）" : ""}
          {rulesMeta.usingFallback ? "（默认值）" : "（链上值）"}
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {BASE_RULES_CONFIG.timeoutNotes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <RuleSection title="统计口径说明" items={BASE_RULES_CONFIG.statsNotes} />
    </div>
  );
}
