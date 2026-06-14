"use client";

import { useState } from "react";
import { DEMO_SCENARIOS, type DemoScenarioId } from "@/lib/demoScenarios";
import { defaultInputs } from "@/lib/parseIntent";

const SCENARIO_CHIP_TEST_IDS: Partial<Record<DemoScenarioId, string>> = {
  friends: "scenario-chip-friendsEvening",
  errands: "scenario-chip-errandAfternoon",
  work: "scenario-chip-workAfternoon",
};

type InputPanelProps = {
  goal: string;
  wechat: string;
  seed: string;
  loading: boolean;
  travelSettingsSummary: string;
  activeDemoScenarioId?: DemoScenarioId | null;
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

  return (
    <section className="rounded-lg border border-black/5 bg-white p-4 shadow-soft">
      <div className="mb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-black/55">GoMap Agent</p>
            <h1 className="text-2xl font-bold tracking-normal text-meituan-ink">美团成行地图</h1>
            <p className="mt-2 text-base font-semibold text-black/70">一句话，让 AI 帮你安排本地短时活动</p>
          </div>
          <button
            type="button"
            onClick={onResetDemo}
            className="shrink-0 rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-bold text-black/50 transition hover:border-black/20 hover:text-black/70"
          >
            重置演示
          </button>
        </div>
        <p className="mt-2 rounded-lg bg-yellow-50 px-3 py-2 text-xs font-semibold leading-5 text-black/58">
          试试：选择下方演示场景，再点击「一键 AI 规划」查看不同本地生活方案。
        </p>

        <div className="mt-4">
          <p className="mb-2 text-xs font-bold text-black/45">试试这些场景</p>
          <div className="flex flex-wrap gap-2">
            {DEMO_SCENARIOS.map((scenario) => {
              const active = activeDemoScenarioId === scenario.id;
              return (
                <button
                  key={scenario.id}
                  type="button"
                  data-testid={SCENARIO_CHIP_TEST_IDS[scenario.id]}
                  className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
                    active
                      ? "border-meituan-yellow bg-meituan-yellow/20 text-meituan-ink"
                      : "border-black/8 bg-meituan-gray text-black/68 hover:border-meituan-yellow hover:bg-yellow-50"
                  }`}
                  onClick={() => onSelectDemoScenario(scenario.id)}
                >
                  {scenario.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-black/75">你今天想怎么安排？</span>
          <textarea
            data-testid="goal-input"
            className="h-28 w-full resize-none rounded-lg border border-black/10 bg-meituan-gray p-3 text-sm leading-6 outline-none transition focus:border-meituan-yellow focus:bg-white"
            value={goal}
            onChange={(event) => onGoalChange(event.target.value)}
            placeholder="比如：想找个地方轻松待一下，晚点和朋友吃饭"
          />
        </label>

        <button
          type="button"
          data-testid="travel-settings-button"
          onClick={onOpenTravelSettings}
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-black/8 bg-meituan-gray/50 px-3 py-2.5 text-left transition hover:border-meituan-yellow/60 hover:bg-yellow-50/40"
        >
          <span className="min-w-0">
            <span className="block text-xs font-bold text-black/45">出行设置</span>
            <span className="mt-0.5 block truncate text-sm font-extrabold text-meituan-ink">{travelSettingsSummary}</span>
          </span>
          <span className="shrink-0 text-xs font-bold text-meituan-ink">修改</span>
        </button>

        <button
          data-testid="run-agent-button"
          className="h-12 w-full rounded-lg bg-meituan-yellow px-6 text-sm font-bold text-meituan-ink shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:justify-self-start"
          type="button"
          disabled={loading}
          onClick={() => onGenerate?.()}
        >
          {loading ? "规划中..." : "一键 AI 规划"}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-black/8 bg-meituan-gray/60">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            onClick={() => setWechatOpen((open) => !open)}
            aria-expanded={wechatOpen}
          >
            <span>
              <span className="block text-sm font-extrabold text-black/78">添加朋友/家人要求</span>
              <span className="mt-1 block text-xs leading-5 text-black/50">例如不吃辣、别太远、预算、人群偏好等</span>
              {hasWechat ? <span className="mt-1 inline-block text-xs font-bold text-emerald-700">已添加朋友要求</span> : null}
            </span>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-black/60 shadow-sm">
              {wechatOpen ? "收起" : "+ 展开"}
            </span>
          </button>
          {wechatOpen ? (
            <div className="px-4 pb-4">
              <textarea
                className="h-28 w-full resize-none rounded-lg border border-black/8 bg-white p-3 text-sm leading-6 text-black/70 outline-none transition placeholder:text-black/35 focus:border-meituan-yellow"
                value={wechat}
                onChange={(event) => onWechatChange(event.target.value)}
                placeholder={defaultInputs.wechat}
              />
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-black/8 bg-meituan-gray/60">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            onClick={() => setSeedOpen((open) => !open)}
            aria-expanded={seedOpen}
          >
            <span>
              <span className="block text-sm font-extrabold text-black/78">添加种草地点/收藏内容</span>
              <span className="mt-1 block text-xs leading-5 text-black/50">例如收藏的店、想去清单、朋友推荐地点等</span>
              {hasSeed ? <span className="mt-1 inline-block text-xs font-bold text-emerald-700">已添加种草内容</span> : null}
            </span>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-black/60 shadow-sm">
              {seedOpen ? "收起" : "+ 展开"}
            </span>
          </button>
          {seedOpen ? (
            <div className="px-4 pb-4">
              <textarea
                className="h-28 w-full resize-none rounded-lg border border-black/8 bg-white p-3 text-sm leading-6 text-black/70 outline-none transition placeholder:text-black/35 focus:border-meituan-yellow"
                value={seed}
                onChange={(event) => onSeedChange(event.target.value)}
                placeholder={defaultInputs.seed || "例如：收藏的店、想去的展览"}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
