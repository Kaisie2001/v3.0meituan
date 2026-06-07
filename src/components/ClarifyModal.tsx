"use client";

import { useMemo, useState } from "react";
import type { IntentDraft, MissingField } from "@/lib/types";

type ClarifyModalProps = {
  open: boolean;
  missingFields: MissingField[];
  draft: IntentDraft;
  onClose: () => void;
  onSubmit: (patch: Partial<IntentDraft>) => void;
};

type Choice<T extends string | number> = {
  label: string;
  value: T;
};

const startTimeChoices: Choice<string>[] = [
  { label: "13:00", value: "13:00" },
  { label: "14:00", value: "14:00" },
  { label: "15:00", value: "15:00" },
  { label: "16:00", value: "16:00" },
];

const durationChoices: Choice<number>[] = [
  { label: "4 小时", value: 240 },
  { label: "5 小时", value: 300 },
  { label: "6 小时", value: 360 },
];

const partySizeChoices: Choice<number>[] = [
  { label: "1 人", value: 1 },
  { label: "2 人", value: 2 },
  { label: "3 人", value: 3 },
  { label: "4 人", value: 4 },
];

const commuteChoices: Choice<number>[] = [
  { label: "20 分钟", value: 20 },
  { label: "30 分钟", value: 30 },
  { label: "45 分钟", value: 45 },
  { label: "60 分钟", value: 60 },
];

function hasField(missingFields: MissingField[], field: MissingField) {
  return missingFields.includes(field);
}

export function ClarifyModal({ open, missingFields, draft, onClose, onSubmit }: ClarifyModalProps) {
  const [startTime, setStartTime] = useState<string>(draft.startTime ?? "14:00");
  const [durationMinutes, setDurationMinutes] = useState<number>(draft.durationMinutes ?? 300);
  const [partySize, setPartySize] = useState<number>(draft.partySize ?? 2);
  const [maxCommuteMinutes, setMaxCommuteMinutes] = useState<number>(draft.maxCommuteMinutes ?? 30);

  const fieldsToAsk = useMemo(() => {
    return missingFields.filter((field) => field === "startTime" || field === "durationMinutes" || field === "partySize" || field === "maxCommuteMinutes");
  }, [missingFields]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 grid place-items-center overflow-y-auto bg-black/35 px-3 py-4">
      <div className="w-full max-w-[350px] rounded-2xl border border-black/10 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-meituan-ink">补全关键信息</h2>
            <p className="mt-1 text-sm text-black/60">为了生成可执行方案，需要你确认几个关键信息。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-bold text-black/60 hover:bg-black/5"
          >
            取消
          </button>
        </div>

        <div className="space-y-4">
          {hasField(fieldsToAsk, "partySize") ? (
            <div className="rounded-xl bg-meituan-gray p-4">
              <p className="mb-2 text-sm font-bold text-black/75">你们几个人？</p>
              <div className="flex flex-wrap gap-2">
                {partySizeChoices.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      partySize === choice.value ? "border-meituan-yellow bg-yellow-50 text-meituan-ink" : "border-black/10 bg-white text-black/70 hover:border-black/20"
                    }`}
                    onClick={() => setPartySize(choice.value)}
                  >
                    {choice.label}
                  </button>
                ))}
                <label className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/70">
                  自定义
                  <input
                    className="w-16 rounded border border-black/10 bg-meituan-gray px-2 py-1 text-sm outline-none focus:border-meituan-yellow focus:bg-white"
                    value={partySize}
                    onChange={(event) => setPartySize(Number(event.target.value || 0))}
                    inputMode="numeric"
                  />
                </label>
              </div>
            </div>
          ) : null}

          {hasField(fieldsToAsk, "durationMinutes") ? (
            <div className="rounded-xl bg-meituan-gray p-4">
              <p className="mb-2 text-sm font-bold text-black/75">计划玩多久？</p>
              <div className="flex flex-wrap gap-2">
                {durationChoices.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      durationMinutes === choice.value ? "border-meituan-yellow bg-yellow-50 text-meituan-ink" : "border-black/10 bg-white text-black/70 hover:border-black/20"
                    }`}
                    onClick={() => setDurationMinutes(choice.value)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {hasField(fieldsToAsk, "maxCommuteMinutes") ? (
            <div className="rounded-xl bg-meituan-gray p-4">
              <p className="mb-2 text-sm font-bold text-black/75">最远通勤能接受多久？</p>
              <div className="flex flex-wrap gap-2">
                {commuteChoices.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      maxCommuteMinutes === choice.value ? "border-meituan-yellow bg-yellow-50 text-meituan-ink" : "border-black/10 bg-white text-black/70 hover:border-black/20"
                    }`}
                    onClick={() => setMaxCommuteMinutes(choice.value)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {hasField(fieldsToAsk, "startTime") ? (
            <div className="rounded-xl bg-meituan-gray p-4">
              <p className="mb-2 text-sm font-bold text-black/75">什么时候出发？</p>
              <div className="flex flex-wrap gap-2">
                {startTimeChoices.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      startTime === choice.value ? "border-meituan-yellow bg-yellow-50 text-meituan-ink" : "border-black/10 bg-white text-black/70 hover:border-black/20"
                    }`}
                    onClick={() => setStartTime(choice.value)}
                  >
                    {choice.label}
                  </button>
                ))}
                <label className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/70">
                  自定义
                  <input
                    className="w-20 rounded border border-black/10 bg-meituan-gray px-2 py-1 text-sm outline-none focus:border-meituan-yellow focus:bg-white"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    placeholder="14:00"
                  />
                </label>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            className="rounded-lg border border-black/10 bg-white px-5 py-2.5 text-sm font-bold text-black/70 hover:bg-black/5"
            onClick={onClose}
          >
            先不生成
          </button>
          <button
            type="button"
            className="rounded-lg bg-meituan-yellow px-6 py-2.5 text-sm font-bold text-meituan-ink transition hover:brightness-95"
            onClick={() => {
              onSubmit({
                startTime,
                durationMinutes,
                partySize,
                maxCommuteMinutes,
              });
            }}
          >
            确认并生成
          </button>
        </div>
      </div>
    </div>
  );
}

