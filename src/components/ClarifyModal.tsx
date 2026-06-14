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

function ChoiceButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
        active ? "border-meituan-yellow bg-yellow-50 text-meituan-ink" : "border-black/10 bg-white text-black/70 hover:border-black/20"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
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
    <div className="pointer-events-auto absolute inset-0 z-[3000] flex items-end justify-center bg-black/35">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clarify-modal-title"
        className="mx-3 flex max-h-[78%] w-[calc(100%-24px)] max-w-none flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-black/12" aria-hidden="true" />

        <div className="shrink-0 px-4 pb-2 pt-3">
          <h2 id="clarify-modal-title" className="text-base font-extrabold text-meituan-ink">
            再确认几个细节
          </h2>
          <p className="mt-1 text-sm leading-5 text-black/55">补全后就能生成更合适的路线。</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          <div className="space-y-3">
            {hasField(fieldsToAsk, "partySize") ? (
              <div className="rounded-xl bg-meituan-gray p-3">
                <p className="mb-2 text-sm font-bold text-black/75">你们几个人？</p>
                <div className="grid grid-cols-2 gap-2">
                  {partySizeChoices.map((choice) => (
                    <ChoiceButton
                      key={choice.value}
                      active={partySize === choice.value}
                      label={choice.label}
                      onClick={() => setPartySize(choice.value)}
                    />
                  ))}
                </div>
                <label className="mt-2 flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-black/70">
                  自定义人数
                  <input
                    className="min-w-0 flex-1 rounded border border-black/10 bg-meituan-gray px-2 py-1 text-sm outline-none focus:border-meituan-yellow focus:bg-white"
                    value={partySize}
                    onChange={(event) => setPartySize(Number(event.target.value || 0))}
                    inputMode="numeric"
                  />
                </label>
              </div>
            ) : null}

            {hasField(fieldsToAsk, "durationMinutes") ? (
              <div className="rounded-xl bg-meituan-gray p-3">
                <p className="mb-2 text-sm font-bold text-black/75">计划玩多久？</p>
                <div className="grid grid-cols-2 gap-2">
                  {durationChoices.map((choice) => (
                    <ChoiceButton
                      key={choice.value}
                      active={durationMinutes === choice.value}
                      label={choice.label}
                      onClick={() => setDurationMinutes(choice.value)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {hasField(fieldsToAsk, "maxCommuteMinutes") ? (
              <div className="rounded-xl bg-meituan-gray p-3">
                <p className="mb-2 text-sm font-bold text-black/75">最远通勤能接受多久？</p>
                <div className="grid grid-cols-2 gap-2">
                  {commuteChoices.map((choice) => (
                    <ChoiceButton
                      key={choice.value}
                      active={maxCommuteMinutes === choice.value}
                      label={choice.label}
                      onClick={() => setMaxCommuteMinutes(choice.value)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {hasField(fieldsToAsk, "startTime") ? (
              <div className="rounded-xl bg-meituan-gray p-3">
                <p className="mb-2 text-sm font-bold text-black/75">什么时候出发？</p>
                <div className="grid grid-cols-2 gap-2">
                  {startTimeChoices.map((choice) => (
                    <ChoiceButton
                      key={choice.value}
                      active={startTime === choice.value}
                      label={choice.label}
                      onClick={() => setStartTime(choice.value)}
                    />
                  ))}
                </div>
                <label className="mt-2 flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-black/70">
                  自定义时间
                  <input
                    className="min-w-0 flex-1 rounded border border-black/10 bg-meituan-gray px-2 py-1 text-sm outline-none focus:border-meituan-yellow focus:bg-white"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    placeholder="14:00"
                  />
                </label>
              </div>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-black/6 px-4 py-3">
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-bold text-black/70 hover:bg-black/5"
              onClick={onClose}
            >
              先不生成
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg bg-meituan-yellow px-3 py-2.5 text-sm font-bold text-meituan-ink transition hover:brightness-95"
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
    </div>
  );
}
