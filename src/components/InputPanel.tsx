"use client";

import { useState } from "react";
import { DEMO_SCENARIOS, type DemoScenarioId } from "@/lib/demoScenarios";
import { defaultInputs } from "@/lib/parseIntent";

const SCENARIO_CHIP_TEST_IDS: Partial<Record<DemoScenarioId, string>> = {
  friends: "scenario-chip-friendsEvening",
  family: "scenario-chip-familyWeekend",
  date: "scenario-chip-dateEvening",
  errands: "scenario-chip-errandAfternoon",
  work: "scenario-chip-workAfternoon",
};

const SCENARIO_SHORTCUTS: Record<DemoScenarioId, { emoji: string; subtitle: string; tags: string[] }> = {
  friends: { emoji: "🍻", subtitle: "晚饭 + 续摊", tags: ["少排队", "好聊天"] },
  family: { emoji: "👨‍👩‍👧", subtitle: "亲子 + 少折腾", tags: ["近距离", "适合孩子"] },
  date: { emoji: "💛", subtitle: "氛围 + 散步", tags: ["重体验", "不赶路"] },
  work: { emoji: "☕", subtitle: "安静 + 久坐", tags: ["咖啡", "插座"] },
  errands: { emoji: "📍", subtitle: "顺路 + 少折返", tags: ["高效率", "少绕路"] },
};

type InputPanelProps = {
  goal: string;
  wechat: string;
  seed: string;
  loading: boolean;
  travelSettingsSummary: string;
  activeDemoScenarioId?: DemoScenarioId | null;
  variant?: "card" | "sheet";
  onGoalChange: (value: string) => void;
  onWechatChange: (value: string) => void;
  onSeedChange: (value: string) => void;
  onOpenTravelSettings: () => void;
  onSelectDemoScenario: (scenarioId: DemoScenarioId) => void;
  onResetDemo: () => void;
  onGenerate: () => void;
};

export function InputPanel({
  goal,
  wechat,
  seed,
  loading,
  travelSettingsSummary,
  activeDemoScenarioId,
  variant = "card",
  onGoalChange,
  onWechatChange,
  onSeedChange,
  onOpenTravelSettings,
  onSelectDemoScenario,
  onResetDemo,
  onGenerate,
}: InputPanelProps) {
  const [wechatOpen, setWechatOpen] = useState(false);
  const [seedOpen, setSeedOpen] = useState(false);
  const hasWechat = wechat.trim().length > 0;
  const hasSeed = seed.trim().length > 0;
  const isSheet = variant === "sheet";

  return (
    <section
      data-testid="home-input-sheet"
      className={
        isSheet
          ? "bg-white"
          : "overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft"
      }
    >
      {!isSheet ? (
        <div className="bg-gradient-to-br from-meituan-yellow/25 via-white to-white px-4 pb-4 pt-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-black/40">美团 · 本地生活</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-meituan-ink">成行地图</h1>
              <p className="mt-1.5 text-sm leading-5 text-black/55">说出你想怎么过这几小时，帮你排好路线</p>
            </div>
            <button
              type="button"
              onClick={onResetDemo}
              className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold text-black/40 transition hover:text-black/60"
            >
              清空
            </button>
          </div>
        </div>
      ) : null}

      <div className={`space-y-3 ${isSheet ? "px-1 pb-1 pt-2" : "space-y-4 px-4 pb-4"}`}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-extrabold text-meituan-ink">你想怎么安排？</span>
          <textarea
            data-testid="goal-input"
            className={`w-full resize-none rounded-2xl border border-black/8 bg-meituan-gray/80 p-3 text-[15px] leading-6 text-meituan-ink outline-none transition placeholder:text-black/35 focus:border-meituan-yellow focus:bg-white focus:shadow-[0_0_0_3px_rgba(255,195,0,0.25)] ${
              isSheet ? "h-24" : "h-32"
            }`}
            value={goal}
            onChange={(event) => onGoalChange(event.target.value)}
            placeholder="例如：晚上和朋友吃饭，吃完还想找地方聊聊天"
          />
        </label>

        <button
          type="button"
          data-testid="travel-settings-button"
          onClick={onOpenTravelSettings}
          className="flex w-full items-center gap-3 rounded-2xl border border-black/6 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-meituan-yellow/50"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-meituan-yellow/20 text-base">🕐</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold text-black/45">出行偏好</span>
            <span className="mt-0.5 block truncate text-sm font-extrabold text-meituan-ink">{travelSettingsSummary}</span>
          </span>
          <span className="shrink-0 text-xs font-bold text-meituan-ink">调整</span>
        </button>

        <button
          data-testid="run-agent-button"
          className="h-11 w-full rounded-2xl bg-meituan-yellow px-6 text-[15px] font-extrabold text-meituan-ink shadow-md transition hover:brightness-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={loading}
          onClick={() => onGenerate?.()}
        >
          {loading ? "正在为你排路线…" : "开始规划"}
        </button>

        <div>
          <p className="mb-2.5 text-[11px] font-bold text-black/40">快捷入口</p>
          <div className="grid grid-cols-2 gap-2.5">
            {DEMO_SCENARIOS.map((scenario) => {
              const active = activeDemoScenarioId === scenario.id;
              const shortcut = SCENARIO_SHORTCUTS[scenario.id];
              return (
                <button
                  key={scenario.id}
                  type="button"
                  data-testid={SCENARIO_CHIP_TEST_IDS[scenario.id]}
                  className={`flex min-h-[108px] flex-col rounded-2xl border px-3 py-2.5 text-left shadow-sm transition active:scale-[0.99] ${
                    active
                      ? "border-meituan-yellow bg-meituan-yellow/20 shadow-[0_4px_14px_rgba(255,195,0,0.22)]"
                      : "border-black/6 bg-white hover:border-meituan-yellow/45 hover:bg-meituan-yellow/5"
                  }`}
                  onClick={() => onSelectDemoScenario(scenario.id)}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg leading-none ${
                        active ? "bg-white/80" : "bg-meituan-yellow/15"
                      }`}
                    >
                      {shortcut.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-extrabold leading-4 text-meituan-ink">{scenario.label}</span>
                      <span className="mt-1 block text-[10px] font-semibold leading-4 text-black/50">{shortcut.subtitle}</span>
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {shortcut.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold leading-4 ${
                          active ? "bg-white/75 text-meituan-ink" : "bg-meituan-gray/80 text-black/50"
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`space-y-2 border-t border-black/5 bg-meituan-gray/30 ${isSheet ? "px-1 py-2.5" : "px-4 py-3"}`}>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-2 text-left"
          onClick={() => setWechatOpen((open) => !open)}
          aria-expanded={wechatOpen}
        >
          <span>
            <span className="block text-sm font-bold text-black/75">同行人要求</span>
            <span className="mt-0.5 block text-[11px] text-black/45">口味、预算、人群偏好</span>
            {hasWechat ? <span className="mt-1 inline-block text-[11px] font-bold text-emerald-700">已补充</span> : null}
          </span>
          <span className="shrink-0 text-xs font-bold text-black/45">{wechatOpen ? "收起" : "添加"}</span>
        </button>
        {wechatOpen ? (
          <textarea
            className="h-24 w-full resize-none rounded-xl border border-black/8 bg-white p-3 text-sm leading-6 text-black/70 outline-none transition placeholder:text-black/35 focus:border-meituan-yellow"
            value={wechat}
            onChange={(event) => onWechatChange(event.target.value)}
            placeholder={defaultInputs.wechat}
          />
        ) : null}

        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-2 text-left"
          onClick={() => setSeedOpen((open) => !open)}
          aria-expanded={seedOpen}
        >
          <span>
            <span className="block text-sm font-bold text-black/75">种草 / 收藏</span>
            <span className="mt-0.5 block text-[11px] text-black/45">想去的店、清单、朋友推荐</span>
            {hasSeed ? <span className="mt-1 inline-block text-[11px] font-bold text-emerald-700">已补充</span> : null}
          </span>
          <span className="shrink-0 text-xs font-bold text-black/45">{seedOpen ? "收起" : "添加"}</span>
        </button>
        {seedOpen ? (
          <textarea
            className="h-24 w-full resize-none rounded-xl border border-black/8 bg-white p-3 text-sm leading-6 text-black/70 outline-none transition placeholder:text-black/35 focus:border-meituan-yellow"
            value={seed}
            onChange={(event) => onSeedChange(event.target.value)}
            placeholder={defaultInputs.seed || "例如：收藏的店、想去的展览"}
          />
        ) : null}
      </div>
    </section>
  );
}
