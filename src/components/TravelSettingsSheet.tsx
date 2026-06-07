"use client";

import { useEffect, useState } from "react";
import {
  DATE_OPTIONS,
  DURATION_OPTIONS,
  ROUTE_PRIORITY_LABELS,
  TIME_SLOT_OPTIONS,
  TRANSPORT_MODE_LABELS,
  type RoutePriorityChoice,
  type TransportModeChoice,
  type TravelSettings,
  type TripDateOption,
  type TripDurationOption,
} from "@/lib/preferenceSummary";

type TravelSettingsSheetProps = {
  open: boolean;
  value: TravelSettings;
  onClose: () => void;
  onSubmit: (value: TravelSettings) => void;
};

const transportOptions: Array<{ label: string; value: TransportModeChoice }> = [
  { label: TRANSPORT_MODE_LABELS.transit, value: "transit" },
  { label: TRANSPORT_MODE_LABELS.walking, value: "walking" },
  { label: TRANSPORT_MODE_LABELS.driving, value: "driving" },
  { label: TRANSPORT_MODE_LABELS.auto, value: "auto" },
];

const priorityOptions: Array<{ label: string; value: RoutePriorityChoice }> = [
  { label: ROUTE_PRIORITY_LABELS.time, value: "time" },
  { label: ROUTE_PRIORITY_LABELS.distance, value: "distance" },
  { label: ROUTE_PRIORITY_LABELS.queue, value: "queue" },
  { label: ROUTE_PRIORITY_LABELS.cost, value: "cost" },
  { label: ROUTE_PRIORITY_LABELS.detour, value: "detour" },
  { label: ROUTE_PRIORITY_LABELS.experience, value: "experience" },
];

const partyChoices = [1, 2, 3, 4];
const budgetChoices = [80, 120, 150, 200];
const commuteChoices = [20, 30, 45, 60];

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
      <div className="relative h-36 overflow-hidden rounded-xl border border-black/8 bg-white">
        <div
          className="pointer-events-none absolute inset-x-1 top-1/2 z-10 h-9 -translate-y-1/2 rounded-lg border border-meituan-yellow/70 bg-meituan-yellow/15"
          aria-hidden="true"
        />
        <div className="h-full overflow-y-auto scroll-smooth py-[54px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {options.map((option) => {
            const active = option === value;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                className={`flex h-9 w-full items-center justify-center px-1 text-xs transition ${
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

export function TravelSettingsSheet({ open, value, onClose, onSubmit }: TravelSettingsSheetProps) {
  const [draft, setDraft] = useState<TravelSettings>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  if (!open) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-[12000] flex items-end justify-center bg-black/35">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="travel-settings-title"
        className="mx-3 flex max-h-[80%] w-[calc(100%-24px)] max-w-none flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-black/12" aria-hidden="true" />

        <div className="shrink-0 px-4 pb-2 pt-3">
          <h2 id="travel-settings-title" className="text-base font-extrabold text-meituan-ink">
            出行设置
          </h2>
          <p className="mt-1 text-sm leading-5 text-black/60">统一设置时间窗口、出行方式、路线优先级与人数预算约束。</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          <div className="space-y-3">
            <div className="rounded-xl bg-meituan-gray p-3">
              <p className="mb-2 text-sm font-bold text-black/75">时间窗口</p>
              <div className="flex gap-2">
                <WheelColumn
                  label="日期"
                  options={DATE_OPTIONS.map((option) => option.id)}
                  value={draft.date}
                  onChange={(next) => setDraft((prev) => ({ ...prev, date: next as TripDateOption }))}
                  formatOption={(option) => DATE_OPTIONS.find((item) => item.id === option)?.label ?? option}
                />
                <WheelColumn
                  label="出发时间"
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

            <div className="rounded-xl bg-meituan-gray p-3">
              <p className="mb-2 text-sm font-bold text-black/75">出行方式</p>
              <div className="flex flex-wrap gap-2">
                {transportOptions.map((item) => (
                  <OptionButton
                    key={item.value}
                    active={draft.transportMode === item.value}
                    label={item.label}
                    onClick={() => setDraft((prev) => ({ ...prev, transportMode: item.value }))}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-meituan-gray p-3">
              <p className="mb-2 text-sm font-bold text-black/75">路线优先级</p>
              <div className="flex flex-wrap gap-2">
                {priorityOptions.map((item) => (
                  <OptionButton
                    key={item.value}
                    active={draft.routePriority === item.value}
                    label={item.label}
                    onClick={() => setDraft((prev) => ({ ...prev, routePriority: item.value }))}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-meituan-gray p-3">
              <p className="mb-2 text-sm font-bold text-black/75">其他约束</p>
              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-bold text-black/55">人数</p>
                  <div className="flex flex-wrap gap-2">
                    {partyChoices.map((size) => (
                      <OptionButton
                        key={size}
                        active={draft.partySize === size}
                        label={`${size} 人`}
                        onClick={() => setDraft((prev) => ({ ...prev, partySize: size }))}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-bold text-black/55">人均预算</p>
                  <div className="flex flex-wrap gap-2">
                    {budgetChoices.map((amount) => (
                      <OptionButton
                        key={amount}
                        active={draft.budget === amount}
                        label={`¥${amount}`}
                        onClick={() => setDraft((prev) => ({ ...prev, budget: amount }))}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-bold text-black/55">最远通勤时间</p>
                  <div className="flex flex-wrap gap-2">
                    {commuteChoices.map((minutes) => (
                      <OptionButton
                        key={minutes}
                        active={draft.maxCommute === minutes}
                        label={`${minutes} 分钟`}
                        onClick={() => setDraft((prev) => ({ ...prev, maxCommute: minutes }))}
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
              onClick={() => onSubmit(draft)}
            >
              保存出行设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
