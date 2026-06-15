"use client";

import { useEffect, useRef, useState } from "react";
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

const MOCK_VOICE_GOAL = "今晚和两个朋友吃饭，有人不吃辣，别排太久，吃完想找地方聊天。";
const IMPORT_GOAL_SUGGESTION = "结合我导入的地点，安排一个今晚可执行路线。";
const IMPORT_MOCK_DISCLAIMER =
  "当前为 demo mock，真实产品可通过用户授权识别链接、分享内容或地点名。";

type ParsedPlaceOption = {
  id: string;
  name: string;
  category: string;
  sourceLabel: string;
};

const MOCK_PARSED_PLACES: ParsedPlaceOption[] = [
  { id: "plain-table", name: "Plain Table", category: "餐厅", sourceLabel: "来自攻略链接" },
  { id: "quick-stop", name: "Quick Stop", category: "饭后聊天", sourceLabel: "来自朋友分享" },
  { id: "kid-zone", name: "Kid Zone 奇趣亲子馆", category: "活动", sourceLabel: "来自商家链接" },
];

type InputPanelProps = {
  goal: string;
  seed: string;
  loading: boolean;
  travelSettingsSummary: string;
  activeDemoScenarioId?: DemoScenarioId | null;
  variant?: "card" | "sheet";
  onGoalChange: (value: string) => void;
  onSeedChange: (value: string) => void;
  onOpenTravelSettings: () => void;
  onSelectDemoScenario: (scenarioId: DemoScenarioId) => void;
  onResetDemo: () => void;
  onGenerate: () => void;
};

function shouldSuggestImportGoal(currentGoal: string) {
  const trimmed = currentGoal.trim();
  return !trimmed || trimmed === defaultInputs.goal.trim();
}

export function InputPanel({
  goal,
  seed,
  loading,
  travelSettingsSummary,
  activeDemoScenarioId,
  variant = "card",
  onGoalChange,
  onSeedChange,
  onOpenTravelSettings,
  onSelectDemoScenario,
  onResetDemo,
  onGenerate,
}: InputPanelProps) {
  const [voiceListening, setVoiceListening] = useState(false);
  const [importSheetOpen, setImportSheetOpen] = useState(false);
  const [importLinkText, setImportLinkText] = useState("");
  const [parsedPlacesVisible, setParsedPlacesVisible] = useState(false);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);
  const [importedPlaces, setImportedPlaces] = useState<ParsedPlaceOption[]>([]);
  const voiceTimerRef = useRef<number | null>(null);

  const isSheet = variant === "sheet";
  const hasImportedPlaces = importedPlaces.length > 0;

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

  function openImportSheet() {
    setImportSheetOpen(true);
    setParsedPlacesVisible(false);
    setSelectedPlaceIds([]);
  }

  function closeImportSheet() {
    setImportSheetOpen(false);
    setParsedPlacesVisible(false);
    setSelectedPlaceIds([]);
  }

  function handleParsePlaces() {
    setParsedPlacesVisible(true);
    setSelectedPlaceIds(MOCK_PARSED_PLACES.map((place) => place.id));
  }

  function togglePlaceSelection(placeId: string) {
    setSelectedPlaceIds((current) =>
      current.includes(placeId) ? current.filter((id) => id !== placeId) : [...current, placeId],
    );
  }

  function handleConfirmImportedPlaces() {
    const selected = MOCK_PARSED_PLACES.filter((place) => selectedPlaceIds.includes(place.id));
    if (!selected.length) return;

    setImportedPlaces(selected);
    onSeedChange(selected.map((place) => `${place.name}(${place.sourceLabel})`).join("; "));
    if (shouldSuggestImportGoal(goal)) {
      onGoalChange(IMPORT_GOAL_SUGGESTION);
    }
    closeImportSheet();
  }

  return (
    <section
      data-testid="home-input-sheet"
      className={
        isSheet
          ? "relative bg-white"
          : "relative overflow-hidden rounded-2xl border border-black/5 bg-white shadow-soft"
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
          <div className="relative">
            <textarea
              data-testid="goal-input"
              className={`w-full resize-none rounded-2xl border border-black/8 bg-meituan-gray/80 p-3 pr-11 text-[15px] leading-6 text-meituan-ink outline-none transition placeholder:text-black/35 focus:border-meituan-yellow focus:bg-white focus:shadow-[0_0_0_3px_rgba(255,195,0,0.25)] ${
                isSheet ? "h-24" : "h-32"
              }`}
              value={goal}
              onChange={(event) => onGoalChange(event.target.value)}
              placeholder="例如：晚上和朋友吃饭，有人不吃辣，别排太久，吃完想找地方聊天"
            />
            <button
              type="button"
              data-testid="voice-input-button"
              disabled={voiceListening}
              onClick={handleVoiceInput}
              aria-label={voiceListening ? "正在听你说" : "语音说需求"}
              className={`absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full border text-base leading-none transition active:scale-95 disabled:opacity-80 ${
                voiceListening
                  ? "border-meituan-yellow/50 bg-meituan-yellow/15"
                  : "border-black/8 bg-white text-meituan-ink hover:border-meituan-yellow/40 hover:bg-meituan-yellow/10"
              }`}
            >
              <span aria-hidden="true">{voiceListening ? "···" : "🎤"}</span>
            </button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-4 text-black/45">
            {voiceListening ? <span className="font-semibold text-meituan-ink">正在听你说…</span> : null}
            {voiceListening ? <span aria-hidden="true" className="text-black/20">·</span> : null}
            <button
              type="button"
              data-testid="import-place-entry"
              onClick={openImportSheet}
              className="font-semibold text-black/55 transition hover:text-meituan-ink"
            >
              🔗 粘贴链接/地点
            </button>
          </div>
        </label>

        {hasImportedPlaces ? (
          <p data-testid="imported-place-summary" className="text-[11px] leading-4 text-black/50">
            <span className="font-bold text-meituan-ink">已导入 {importedPlaces.length} 个地点：</span>
            {importedPlaces.map((place) => place.name).join(" · ")}
          </p>
        ) : null}

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

      {importSheetOpen ? (
        <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/25">
          <div
            data-testid="import-place-sheet"
            className="max-h-[78%] overflow-y-auto rounded-t-[24px] border-t border-white/80 bg-white px-4 pb-5 pt-3 shadow-[0_-12px_40px_rgba(15,23,42,0.16)]"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-meituan-ink">导入想去地点</h3>
              <button
                type="button"
                className="text-[11px] font-bold text-black/45"
                onClick={closeImportSheet}
              >
                关闭
              </button>
            </div>

            <p className="mb-3 text-[10px] leading-4 text-black/45">{IMPORT_MOCK_DISCLAIMER}</p>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold text-black/45">粘贴内容</span>
              <textarea
                data-testid="import-place-input"
                className="h-20 w-full resize-none rounded-xl border border-black/8 bg-meituan-gray/60 p-3 text-sm leading-6 text-meituan-ink outline-none transition placeholder:text-black/35 focus:border-meituan-yellow focus:bg-white"
                value={importLinkText}
                onChange={(event) => setImportLinkText(event.target.value)}
                placeholder="粘贴攻略链接、朋友分享链接、商家链接或地点名"
              />
            </label>

            <ul className="mt-2 space-y-1 text-[10px] leading-4 text-black/45">
              <li>· 小红书攻略链接</li>
              <li>· 微信朋友分享</li>
              <li>· 美团/点评商家链接</li>
              <li>· 地点名</li>
            </ul>

            <button
              type="button"
              data-testid="import-place-parse-button"
              className="mt-3 h-10 w-full rounded-xl border border-black/8 bg-white text-[12px] font-extrabold text-meituan-ink transition hover:border-meituan-yellow/50"
              onClick={handleParsePlaces}
            >
              识别地点
            </button>

            {parsedPlacesVisible ? (
              <div className="mt-3 space-y-2">
                {MOCK_PARSED_PLACES.map((place) => {
                  const checked = selectedPlaceIds.includes(place.id);
                  return (
                    <label
                      key={place.id}
                      data-testid="import-place-option"
                      className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 ${
                        checked ? "border-meituan-yellow bg-meituan-yellow/10" : "border-black/8 bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePlaceSelection(place.id)}
                        className="mt-0.5 h-4 w-4 rounded border-black/20 text-meituan-yellow focus:ring-meituan-yellow/40"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-extrabold text-meituan-ink">
                          {place.name} · {place.category}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-black/45">{place.sourceLabel}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : null}

            <button
              type="button"
              data-testid="import-place-confirm-button"
              disabled={!parsedPlacesVisible || selectedPlaceIds.length === 0}
              className="mt-4 h-11 w-full rounded-2xl bg-meituan-yellow text-[13px] font-extrabold text-meituan-ink shadow-md transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
              onClick={handleConfirmImportedPlaces}
            >
              {selectedPlaceIds.length === 0 && parsedPlacesVisible ? "请先选择地点" : "加入路线"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
