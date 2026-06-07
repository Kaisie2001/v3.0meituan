"use client";

import { useEffect, useState } from "react";
import {
  DATE_OPTIONS,
  DURATION_OPTIONS,
  TIME_SLOT_OPTIONS,
  type TimePickerValue,
  type TripDateOption,
  type TripDurationOption,
} from "@/lib/preferenceSummary";

type TimePickerSheetProps = {
  open: boolean;
  value: TimePickerValue;
  onClose: () => void;
  onConfirm: (value: TimePickerValue) => void;
};

function WheelColumn<T extends string>({
  label,
  options,
  value,
  onChange,
  formatOption,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (next: T) => void;
  formatOption: (option: T) => string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-2 text-center text-[11px] font-bold text-black/45">{label}</p>
      <div className="relative h-44 overflow-hidden rounded-xl border border-black/8 bg-meituan-gray/50">
        <div
          className="pointer-events-none absolute inset-x-1 top-1/2 z-10 h-10 -translate-y-1/2 rounded-lg border border-meituan-yellow/70 bg-meituan-yellow/15"
          aria-hidden="true"
        />
        <div className="h-full overflow-y-auto scroll-smooth py-[68px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {options.map((option) => {
            const active = option === value;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                className={`flex h-10 w-full items-center justify-center px-2 text-sm transition ${
                  active ? "font-extrabold text-meituan-ink" : "font-semibold text-black/38 hover:text-black/55"
                }`}
              >
                {formatOption(option)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function TimePickerSheet({ open, value, onClose, onConfirm }: TimePickerSheetProps) {
  const [draft, setDraft] = useState<TimePickerValue>(value);

  useEffect(() => {
    if (open) {
      setDraft(value);
    }
  }, [open, value]);

  if (!open) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-[12000] flex items-end justify-center bg-black/35">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="time-picker-title"
        className="mx-3 flex max-h-[78%] w-[calc(100%-24px)] max-w-none flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-black/12" aria-hidden="true" />

        <div className="shrink-0 px-4 pb-2 pt-3">
          <h2 id="time-picker-title" className="text-base font-extrabold text-meituan-ink">
            选择出行时间
          </h2>
          <p className="mt-1 text-sm leading-5 text-black/60">精确选择出发日期、时间和可用时长，便于 AI 按真实窗口规划。</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          <div className="flex gap-2">
            <WheelColumn
              label="日期"
              options={DATE_OPTIONS.map((option) => option.id)}
              value={draft.date}
              onChange={(next) => setDraft((prev) => ({ ...prev, date: next as TripDateOption }))}
              formatOption={(option) => DATE_OPTIONS.find((item) => item.id === option)?.label ?? option}
            />
            <WheelColumn
              label="时间"
              options={TIME_SLOT_OPTIONS}
              value={draft.startTime}
              onChange={(next) => setDraft((prev) => ({ ...prev, startTime: next }))}
              formatOption={(option) => option}
            />
            <WheelColumn
              label="可用时长"
              options={DURATION_OPTIONS.map((option) => option.id)}
              value={draft.duration}
              onChange={(next) => setDraft((prev) => ({ ...prev, duration: next as TripDurationOption }))}
              formatOption={(option) => DURATION_OPTIONS.find((item) => item.id === option)?.label ?? option}
            />
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
              onClick={() => onConfirm(draft)}
            >
              确认时间
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
