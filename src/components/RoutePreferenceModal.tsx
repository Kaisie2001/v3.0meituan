"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildPreferenceSummaryFromLabels,
  DEFAULT_PREFERENCE_SUMMARY,
  type PreferenceSubmitPayload,
} from "@/lib/preferenceSummary";
import type { Intent, IntentDraft, OptimizeGoal, TransportMode } from "@/lib/types";

type RoutePreferenceModalProps = {
  open: boolean;
  initialIntent?: Intent;
  initialDraft?: IntentDraft;
  onClose: () => void;
  onSubmit: (payload: PreferenceSubmitPayload) => void;
};

type TransportChoice = TransportMode | "auto";

type GoalChoice = "time" | "distance" | "cost" | "queue" | "detour" | "experience";

const TRANSPORT_LABELS: Record<TransportChoice, string> = {
  transit: "公共交通优先",
  walking: "步行优先",
  driving: "打车/驾车",
  auto: "系统综合推荐",
};

const GOAL_LABELS: Record<GoalChoice, string> = {
  time: "时间最短",
  distance: "少走路",
  queue: "少排队",
  cost: "预算优先",
  detour: "少绕路",
  experience: "体验优先",
};

const transportOptions: Array<{ label: string; value: TransportChoice }> = [
  { label: TRANSPORT_LABELS.transit, value: "transit" },
  { label: TRANSPORT_LABELS.walking, value: "walking" },
  { label: TRANSPORT_LABELS.driving, value: "driving" },
  { label: TRANSPORT_LABELS.auto, value: "auto" },
];

const goalOptions: Array<{ label: string; value: GoalChoice }> = [
  { label: GOAL_LABELS.time, value: "time" },
  { label: GOAL_LABELS.distance, value: "distance" },
  { label: GOAL_LABELS.queue, value: "queue" },
  { label: GOAL_LABELS.cost, value: "cost" },
  { label: GOAL_LABELS.detour, value: "detour" },
  { label: GOAL_LABELS.experience, value: "experience" },
];

const startTimeChoices = ["13:00", "14:00", "15:00", "16:00", "18:00", "19:00"];
const durationChoices = [
  { label: "2 小时", value: 120 },
  { label: "3 小时", value: 180 },
  { label: "4 小时", value: 240 },
  { label: "5 小时", value: 300 },
];
const commuteChoices = [20, 30, 45, 60];
const partyChoices = [1, 2, 3, 4];
const budgetChoices = [80, 120, 150, 200];

function getSpeechRecognition() {
  const w = window as typeof window & {
    SpeechRecognition?: new () => {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: ((event: { results: Array<Array<{ transcript?: string }>> }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    webkitSpeechRecognition?: new () => {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: ((event: { results: Array<Array<{ transcript?: string }>> }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

function inferGoalChoice(intent?: Intent): GoalChoice {
  const goal = intent?.routePrefs?.goal ?? "time";
  const customGoal = intent?.routePrefs?.customGoal ?? "";
  if (goal === "custom") {
    if (/排队/.test(customGoal)) return "queue";
    if (/绕路/.test(customGoal)) return "detour";
    if (/体验/.test(customGoal)) return "experience";
  }
  if (goal === "distance" || goal === "cost" || goal === "time") return goal;
  return "time";
}

function goalChoiceToRoutePrefs(choice: GoalChoice): Pick<PreferenceSubmitPayload["routePrefs"], "goal" | "customGoal"> {
  switch (choice) {
    case "queue":
      return { goal: "custom", customGoal: "少排队" };
    case "detour":
      return { goal: "custom", customGoal: "少绕路" };
    case "experience":
      return { goal: "custom", customGoal: "体验优先" };
    case "distance":
      return { goal: "distance" };
    case "cost":
      return { goal: "cost" };
    default:
      return { goal: "time" };
  }
}

function OptionButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
        active ? "border-meituan-yellow bg-yellow-50 text-meituan-ink" : "border-black/10 bg-white text-black/70 hover:border-black/20"
      }`}
    >
      {label}
    </button>
  );
}

export function RoutePreferenceModal({ open, initialIntent, initialDraft, onClose, onSubmit }: RoutePreferenceModalProps) {
  const [transport, setTransport] = useState<TransportChoice>("auto");
  const [goalChoice, setGoalChoice] = useState<GoalChoice>("time");
  const [customGoal, setCustomGoal] = useState("");
  const [startTime, setStartTime] = useState("14:00");
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [maxCommuteMinutes, setMaxCommuteMinutes] = useState(30);
  const [partySize, setPartySize] = useState(2);
  const [budgetPerPerson, setBudgetPerPerson] = useState(150);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void; start: () => void } | null>(null);

  const speechAvailable = useMemo(() => Boolean(typeof window !== "undefined" && getSpeechRecognition()), []);

  useEffect(() => {
    if (!open) return;
    setTransport((initialIntent?.routePrefs?.transport as TransportChoice) ?? "auto");
    setGoalChoice(inferGoalChoice(initialIntent));
    setCustomGoal(initialIntent?.routePrefs?.customGoal ?? "");
    setStartTime(initialIntent?.startTime ?? initialDraft?.startTime ?? "14:00");
    setDurationMinutes(initialIntent?.durationMinutes ?? initialDraft?.durationMinutes ?? 180);
    setMaxCommuteMinutes(initialIntent?.maxCommuteMinutes ?? initialDraft?.maxCommuteMinutes ?? 30);
    setPartySize(initialIntent?.partySize ?? initialDraft?.partySize ?? 2);
    setBudgetPerPerson(initialIntent?.budgetPerPerson ?? initialDraft?.budgetPerPerson ?? 150);
    setListening(false);
  }, [open, initialIntent, initialDraft]);

  if (!open) return null;

  function startListening() {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: { results: Array<Array<{ transcript?: string }>> }) => {
      const text = event.results[0]?.[0]?.transcript;
      if (typeof text === "string") setCustomGoal(text);
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  function stopListening() {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setListening(false);
  }

  function handleSubmit() {
    const routeGoal = goalChoiceToRoutePrefs(goalChoice);
    const resolvedTransport: TransportMode = transport === "auto" ? "transit" : transport;
    const summaryLabels = [
      transport === "auto" ? TRANSPORT_LABELS.auto : TRANSPORT_LABELS[resolvedTransport],
      GOAL_LABELS[goalChoice] ?? GOAL_LABELS.time,
    ];
    if (goalChoice === "queue") {
      summaryLabels.push("不想排太久");
    }

    const buildSummary =
      typeof buildPreferenceSummaryFromLabels === "function" ? buildPreferenceSummaryFromLabels : null;
    const displaySummary = buildSummary ? buildSummary(summaryLabels) : DEFAULT_PREFERENCE_SUMMARY;

    if (typeof onSubmit !== "function") return;

    onSubmit({
      routePrefs: {
        transport: resolvedTransport,
        goal: routeGoal.goal as OptimizeGoal,
        customGoal: routeGoal.customGoal,
      },
      intentPatch: {
        startTime,
        durationMinutes,
        maxCommuteMinutes,
        partySize,
        budgetPerPerson,
      },
      displaySummary,
    });
  }

  return (
    <div className="pointer-events-auto absolute inset-0 z-[12000] flex items-end justify-center bg-black/35">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="route-pref-modal-title"
        className="mx-3 flex max-h-[82%] w-[calc(100%-24px)] max-w-none flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-black/12" aria-hidden="true" />

        <div className="shrink-0 px-4 pb-2 pt-3">
          <h2 id="route-pref-modal-title" className="text-base font-extrabold text-meituan-ink">
            设置出行偏好
          </h2>
          <p className="mt-1 text-sm leading-5 text-black/60">AI 会基于这些约束规划主方案与备选方案。</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          <div className="space-y-3">
            <div className="rounded-xl bg-meituan-gray p-3">
              <p className="mb-2 text-sm font-bold text-black/75">出行方式</p>
              <div className="flex flex-wrap gap-2">
                {transportOptions.map((item) => (
                  <OptionButton
                    key={item.value}
                    active={transport === item.value}
                    label={item.label}
                    onClick={() => setTransport(item.value)}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-meituan-gray p-3">
              <p className="mb-2 text-sm font-bold text-black/75">路线优先级</p>
              <div className="flex flex-wrap gap-2">
                {goalOptions.map((item) => (
                  <OptionButton
                    key={item.value}
                    active={goalChoice === item.value}
                    label={item.label}
                    onClick={() => setGoalChoice(item.value)}
                  />
                ))}
              </div>
              {goalChoice === "experience" ? (
                <div className="mt-3 rounded-xl border border-black/10 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-black/65">补充体验偏好（可选）</p>
                    <button
                      type="button"
                      disabled={!speechAvailable}
                      onClick={() => (listening ? stopListening() : startListening())}
                      className="rounded-lg bg-meituan-yellow px-3 py-1.5 text-xs font-bold text-meituan-ink disabled:opacity-50"
                    >
                      {speechAvailable ? (listening ? "停止" : "语音") : "语音不可用"}
                    </button>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-black/10 bg-meituan-gray px-3 py-2 text-sm outline-none focus:border-meituan-yellow focus:bg-white"
                    value={customGoal}
                    onChange={(event) => setCustomGoal(event.target.value)}
                    placeholder="例如：更安静、适合聊天"
                  />
                </div>
              ) : null}
            </div>

            <div className="rounded-xl bg-meituan-gray p-3">
              <p className="mb-2 text-sm font-bold text-black/75">时间与约束</p>
              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-bold text-black/55">出发时间</p>
                  <div className="flex flex-wrap gap-2">
                    {startTimeChoices.map((value) => (
                      <OptionButton key={value} active={startTime === value} label={value} onClick={() => setStartTime(value)} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-bold text-black/55">可用时长</p>
                  <div className="flex flex-wrap gap-2">
                    {durationChoices.map((item) => (
                      <OptionButton
                        key={item.value}
                        active={durationMinutes === item.value}
                        label={item.label}
                        onClick={() => setDurationMinutes(item.value)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-bold text-black/55">最远通勤</p>
                  <div className="flex flex-wrap gap-2">
                    {commuteChoices.map((value) => (
                      <OptionButton
                        key={value}
                        active={maxCommuteMinutes === value}
                        label={`${value} 分钟`}
                        onClick={() => setMaxCommuteMinutes(value)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-bold text-black/55">人数</p>
                  <div className="flex flex-wrap gap-2">
                    {partyChoices.map((value) => (
                      <OptionButton
                        key={value}
                        active={partySize === value}
                        label={`${value} 人`}
                        onClick={() => setPartySize(value)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-bold text-black/55">人均预算</p>
                  <div className="flex flex-wrap gap-2">
                    {budgetChoices.map((value) => (
                      <OptionButton
                        key={value}
                        active={budgetPerPerson === value}
                        label={`¥${value}`}
                        onClick={() => setBudgetPerPerson(value)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-black/6 px-4 py-3">
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-bold text-black/70 hover:bg-black/5"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg bg-meituan-yellow px-3 py-2.5 text-sm font-bold text-meituan-ink transition hover:brightness-95"
              onClick={handleSubmit}
            >
              保存偏好
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
