"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OptimizeGoal, RoutePreferences, TransportMode } from "@/lib/types";

type RoutePreferenceModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (prefs: RoutePreferences) => void;
};

const transportOptions: Array<{ label: string; value: TransportMode; desc: string }> = [
  { label: "公共交通", value: "transit", desc: "更符合城市出行（Demo 使用估算）" },
  { label: "私家车", value: "driving", desc: "更快但成本/停车不确定（Demo 使用估算）" },
  { label: "步行", value: "walking", desc: "更慢但更自由（Demo 使用估算）" },
];

const goalOptions: Array<{ label: string; value: OptimizeGoal; desc: string }> = [
  { label: "用时最短", value: "time", desc: "优先少通勤少等待" },
  { label: "距离最短", value: "distance", desc: "优先就近不折返" },
  { label: "最省钱", value: "cost", desc: "优先更低预算" },
  { label: "其他", value: "custom", desc: "用语音说一句你的偏好" },
];

function getSpeechRecognition() {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

export function RoutePreferenceModal({ open, onClose, onSubmit }: RoutePreferenceModalProps) {
  const [transport, setTransport] = useState<TransportMode>("transit");
  const [goal, setGoal] = useState<OptimizeGoal>("time");
  const [customGoal, setCustomGoal] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const speechAvailable = useMemo(() => Boolean(typeof window !== "undefined" && getSpeechRecognition()), []);

  useEffect(() => {
    if (!open) return;
    setListening(false);
  }, [open]);

  if (!open) return null;

  function startListening() {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const text = event?.results?.[0]?.[0]?.transcript;
      if (typeof text === "string") setCustomGoal(text);
      setListening(false);
    };
    recognition.onerror = () => {
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };
    setListening(true);
    recognition.start();
  }

  function stopListening() {
    try {
      recognitionRef.current?.stop?.();
    } catch {}
    setListening(false);
  }

  return (
    <div className="absolute inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 px-3 py-4">
      <div className="w-full max-w-[350px] rounded-2xl border border-black/10 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-meituan-ink">路线偏好问答 Agent</h2>
            <p className="mt-1 text-sm text-black/60">选择你的出行方式与路线目标，系统会据此重新规划。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-bold text-black/60 hover:bg-black/5">
            取消
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl bg-meituan-gray p-4">
            <p className="mb-2 text-sm font-bold text-black/75">你倾向怎么出行？</p>
            <div className="space-y-2">
              {transportOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setTransport(item.value)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    transport === item.value ? "border-meituan-yellow bg-yellow-50" : "border-black/10 bg-white hover:border-black/20"
                  }`}
                >
                  <p className="text-sm font-extrabold text-black/80">{item.label}</p>
                  <p className="mt-1 text-xs text-black/55">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-meituan-gray p-4">
            <p className="mb-2 text-sm font-bold text-black/75">你倾向怎么选路线？</p>
            <div className="space-y-2">
              {goalOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setGoal(item.value)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    goal === item.value ? "border-meituan-yellow bg-yellow-50" : "border-black/10 bg-white hover:border-black/20"
                  }`}
                >
                  <p className="text-sm font-extrabold text-black/80">{item.label}</p>
                  <p className="mt-1 text-xs text-black/55">{item.desc}</p>
                </button>
              ))}
            </div>

            {goal === "custom" ? (
              <div className="mt-3 rounded-xl border border-black/10 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-extrabold text-black/75">语音输入偏好</p>
                  <button
                    type="button"
                    disabled={!speechAvailable}
                    onClick={() => (listening ? stopListening() : startListening())}
                    className="rounded-lg bg-meituan-yellow px-3 py-1.5 text-xs font-bold text-meituan-ink disabled:opacity-50"
                  >
                    {speechAvailable ? (listening ? "停止" : "开始说话") : "不可用"}
                  </button>
                </div>
                <input
                  className="mt-2 w-full rounded-lg border border-black/10 bg-meituan-gray px-3 py-2 text-sm outline-none focus:border-meituan-yellow focus:bg-white"
                  value={customGoal}
                  onChange={(event) => setCustomGoal(event.target.value)}
                  placeholder="例如：更热闹一点、想吃麻辣火锅、想拍照出片"
                />
                <p className="mt-2 text-xs text-black/55">浏览器不支持语音时可直接在这里输入。</p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            className="rounded-lg border border-black/10 bg-white px-5 py-2.5 text-sm font-bold text-black/70 hover:bg-black/5"
            onClick={onClose}
          >
            先不选
          </button>
          <button
            type="button"
            className="rounded-lg bg-meituan-yellow px-6 py-2.5 text-sm font-bold text-meituan-ink transition hover:brightness-95"
            onClick={() => onSubmit({ transport, goal, customGoal: goal === "custom" ? customGoal : undefined })}
          >
            确认并规划
          </button>
        </div>
      </div>
    </div>
  );
}
