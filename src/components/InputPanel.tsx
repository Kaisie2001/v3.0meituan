"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DEMO_SCENARIOS, type DemoScenarioId } from "@/lib/demoScenarios";
import { defaultInputs } from "@/lib/parseIntent";

const SCENARIO_CHIP_TEST_IDS: Partial<Record<DemoScenarioId, string>> = {
  friends: "scenario-chip-friendsEvening",
  family: "scenario-chip-familyWeekend",
  date: "scenario-chip-dateEvening",
  errands: "scenario-chip-errandAfternoon",
  work: "scenario-chip-workAfternoon",
};

const SCENARIO_SHORTCUTS: Record<DemoScenarioId, { emoji: string; subtitle: string }> = {
  friends: { emoji: "🍻", subtitle: "晚饭 + 续摊" },
  family: { emoji: "👨‍👩‍👧", subtitle: "亲子 + 少折腾" },
  date: { emoji: "💛", subtitle: "氛围 + 散步" },
  work: { emoji: "☕", subtitle: "安静 + 久坐" },
  errands: { emoji: "📍", subtitle: "顺路 + 少折返" },
};

const MOCK_VOICE_GOAL = "今晚和朋友吃饭，别排太久，吃完想找地方聊天。";
const MOCK_FAVORITE_SEED = "三里屯咖啡; 朝阳公园野餐; 望京小馆";

type EntrySourceId = "favorites" | "nearby" | "friend";

const ENTRY_SOURCES: {
  id: EntrySourceId;
  emoji: string;
  title: string;
  subtitle: string;
  status: string;
  goal: string;
}[] = [
  {
    id: "favorites",
    emoji: "⭐",
    title: "收藏想去",
    subtitle: "想去的店、清单、团购",
    status: "已加入 3 个收藏地点",
    goal: "从我收藏的想去地点里，安排一个今晚的路线。",
  },
  {
    id: "nearby",
    emoji: "📍",
    title: "附近可成行",
    subtitle: "现在附近适合去哪",
    status: "已读取附近推荐",
    goal: "现在附近找个适合停留和吃饭的路线。",
  },
  {
    id: "friend",
    emoji: "💬",
    title: "朋友推荐",
    subtitle: "朋友发来的店也能排",
    status: "已加入朋友推荐地点",
    goal: "把朋友推荐的店加入今晚路线。",
  },
];

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

function ActionChip({
  active,
  onClick,
  children,
  className = "",
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-w-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-bold leading-4 transition active:scale-[0.98] ${
        active
          ? "border-meituan-yellow/60 bg-meituan-yellow/12 text-meituan-ink"
          : "border-black/8 bg-white text-black/62 hover:border-black/12 hover:bg-meituan-gray/50"
      } ${className}`}
    >
      {children}
    </button>
  );
}

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
  const [voiceListening, setVoiceListening] = useState(false);
  const [favoritesPicked, setFavoritesPicked] = useState(false);
  const [activeEntrySource, setActiveEntrySource] = useState<EntrySourceId | null>(null);
  const voiceTimerRef = useRef<number | null>(null);

  const hasWechat = wechat.trim().length > 0;
  const hasSeed = seed.trim().length > 0;
  const isSheet = variant === "sheet";

  useEffect(() => {
    return () => {
      if (voiceTimerRef.current !== null) {
        window.clearTimeout(voiceTimerRef.current);
      }
    };
  }, []);

  function handleVoiceInput() {
    if (voiceListening) return;
    setVoiceListening(true);
    voiceTimerRef.current = window.setTimeout(() => {
      onGoalChange(MOCK_VOICE_GOAL);
      setVoiceListening(false);
      voiceTimerRef.current = null;
    }, 1000);
  }

  function handleFavoritesPick() {
    if (!favoritesPicked && !hasSeed) {
      onSeedChange(MOCK_FAVORITE_SEED);
      setFavoritesPicked(true);
      return;
    }
    setSeedOpen((open) => !open);
  }

  function handleEntrySource(sourceId: EntrySourceId) {
    const source = ENTRY_SOURCES.find((item) => item.id === sourceId);
    if (!source) return;

    setActiveEntrySource(sourceId);
    onGoalChange(source.goal);

    if (sourceId === "favorites") {
      onSeedChange(MOCK_FAVORITE_SEED);
      setFavoritesPicked(true);
    }
  }

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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="voice-input-button"
            disabled={voiceListening}
            onClick={handleVoiceInput}
            className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold leading-4 transition active:scale-[0.98] disabled:opacity-80 ${
              voiceListening
                ? "border-meituan-yellow/50 bg-meituan-yellow/10 text-meituan-ink"
                : "border-black/10 bg-meituan-gray/60 text-meituan-ink hover:border-meituan-yellow/40 hover:bg-meituan-yellow/10"
            }`}
          >
            <span aria-hidden="true">🎤</span>
            <span>{voiceListening ? "正在听你说…" : "语音输入"}</span>
          </button>

          <ActionChip active={hasWechat || wechatOpen} onClick={() => setWechatOpen((open) => !open)}>
            {hasWechat ? "同行人 · 已补充" : "同行人"}
          </ActionChip>

          <ActionChip
            active={favoritesPicked || hasSeed || seedOpen}
            onClick={handleFavoritesPick}
            className="max-w-full"
          >
            <span className="truncate">
              {favoritesPicked ? "已选择 3 个想去地点" : hasSeed ? "从收藏选 · 已补充" : "从收藏选"}
            </span>
          </ActionChip>
        </div>

        {wechatOpen ? (
          <textarea
            className="h-20 w-full resize-none rounded-xl border border-black/8 bg-white p-3 text-sm leading-6 text-black/70 outline-none transition placeholder:text-black/35 focus:border-meituan-yellow"
            value={wechat}
            onChange={(event) => onWechatChange(event.target.value)}
            placeholder={defaultInputs.wechat}
          />
        ) : null}

        {seedOpen ? (
          <textarea
            className="h-20 w-full resize-none rounded-xl border border-black/8 bg-white p-3 text-sm leading-6 text-black/70 outline-none transition placeholder:text-black/35 focus:border-meituan-yellow"
            value={seed}
            onChange={(event) => {
              onSeedChange(event.target.value);
              if (!event.target.value.trim()) setFavoritesPicked(false);
            }}
            placeholder={defaultInputs.seed || "例如：收藏的店、想去的展览"}
          />
        ) : null}

        <div>
          <p className="mb-2 text-[11px] font-bold text-black/45">从哪里开始规划？</p>
          <div className="grid grid-cols-3 gap-2">
            {ENTRY_SOURCES.map((source) => {
              const active = activeEntrySource === source.id;
              return (
                <button
                  key={source.id}
                  type="button"
                  data-testid={`entry-source-${source.id}`}
                  onClick={() => handleEntrySource(source.id)}
                  className={`flex min-h-[88px] flex-col rounded-xl border px-2 py-2 text-left transition active:scale-[0.99] ${
                    active
                      ? "border-meituan-yellow bg-meituan-yellow/12 shadow-[0_4px_12px_rgba(255,195,0,0.14)] ring-1 ring-meituan-yellow/30"
                      : "border-black/8 bg-white shadow-[0_1px_4px_rgba(15,23,42,0.04)] hover:border-black/12"
                  }`}
                >
                  <span className="text-base leading-none" aria-hidden="true">
                    {source.emoji}
                  </span>
                  <span className="mt-1.5 block text-[11px] font-extrabold leading-4 text-meituan-ink">{source.title}</span>
                  <span className="mt-0.5 block text-[9px] font-medium leading-3 text-black/45">{source.subtitle}</span>
                  {active ? (
                    <span className="mt-1.5 block text-[9px] font-bold leading-3 text-emerald-700">{source.status}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

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
          <p className="mb-2.5 text-xs font-extrabold text-meituan-ink">快捷入口</p>
          <div className="grid grid-cols-2 gap-3">
            {DEMO_SCENARIOS.map((scenario) => {
              const active = activeDemoScenarioId === scenario.id;
              const shortcut = SCENARIO_SHORTCUTS[scenario.id];
              return (
                <button
                  key={scenario.id}
                  type="button"
                  data-testid={SCENARIO_CHIP_TEST_IDS[scenario.id]}
                  className={`flex min-h-[96px] flex-col rounded-2xl border px-3 py-3 text-left transition active:scale-[0.99] ${
                    active
                      ? "border-meituan-yellow bg-meituan-yellow/15 shadow-[0_6px_18px_rgba(255,195,0,0.18)] ring-1 ring-meituan-yellow/35"
                      : "border-black/8 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)] hover:border-black/12 hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)]"
                  }`}
                  onClick={() => onSelectDemoScenario(scenario.id)}
                >
                  <span
                    className={`mb-2 grid h-10 w-10 place-items-center rounded-2xl text-xl leading-none ${
                      active ? "bg-white text-meituan-ink" : "bg-meituan-gray/70 text-meituan-ink"
                    }`}
                  >
                    {shortcut.emoji}
                  </span>
                  <span className="block text-[13px] font-extrabold leading-5 text-meituan-ink">{scenario.label}</span>
                  <span className="mt-0.5 block text-[11px] font-medium leading-4 text-black/50">{shortcut.subtitle}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
