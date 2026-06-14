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

const transportOptions: Array<{ label: string; value: TransportModeChoice; hint?: string }> = [
  { label: "地铁公交", value: "transit", hint: "优先稳定换乘" },
  { label: "步行", value: "walking", hint: "附近紧凑路线" },
  { label: "打车", value: "driving", hint: "省时少转场" },
  { label: "智能推荐", value: "auto", hint: "综合平衡" },
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
        active ? "border-meituan-yellow bg-yellow-50 text-meituan-ink shadow-sm" : "border-black/10 bg-white text-black/70 hover:border-black/20"
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
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(value);
      setAdvancedOpen(false);
    }
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
            出行偏好
          </h2>
          <p className="mt-1 text-sm leading-5 text-black/55">选好时间和方式，方案会按你的习惯来排。</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          <div className="space-y-3">
            <div className="rounded-2xl bg-meituan-gray/80 p-3">
              <p className="mb-2 text-sm font-extrabold text-meituan-ink">什么时候出发</p>
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
                  label="时长"
                  options={DURATION_OPTIONS.map((option) => option.id)}
                  value={draft.duration}
                  onChange={(next) => setDraft((prev) => ({ ...prev, duration: next as TripDurationOption }))}
                  formatOption={(option) => DURATION_OPTIONS.find((item) => item.id === option)?.label ?? option}
                />
              </div>
            </div>

            <div className="rounded-2xl bg-meituan-gray/80 p-3">
              <p className="mb-2 text-sm font-extrabold text-meituan-ink">怎么过去</p>
              <div className="grid grid-cols-2 gap-2">
                {transportOptions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, transportMode: item.value }))}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      draft.transportMode === item.value
                        ? "border-meituan-yellow bg-yellow-50 shadow-sm"
                        : "border-black/10 bg-white hover:border-black/20"
                    }`}
                  >
                    <span className="block text-sm font-extrabold text-meituan-ink">{item.label}</span>
                    {item.hint ? <span className="mt-0.5 block text-[10px] font-semibold text-black/45">{item.hint}</span> : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-meituan-gray/80 p-3">
              <p className="mb-2 text-sm font-extrabold text-meituan-ink">路线更在意什么</p>
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

            <div className="rounded-2xl border border-black/6 bg-white">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-3 text-left"
                onClick={() => setAdvancedOpen((open) => !open)}
                aria-expanded={advancedOpen}
              >
                <span>
                  <span className="block text-sm font-bold text-black/75">人数与预算</span>
                  <span className="mt-0.5 block text-[11px] text-black/45">
                    {draft.partySize} 人 · 人均 ¥{draft.budget} · 最远 {draft.maxCommute} 分钟
                  </span>
                </span>
                <span className="text-xs font-bold text-black/45">{advancedOpen ? "收起" : "展开"}</span>
              </button>
              {advancedOpen ? (
                <div className="space-y-3 border-t border-black/6 px-3 pb-3 pt-2">
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
                    <p className="mb-1.5 text-xs font-bold text-black/55">最远愿意走多远</p>
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
              ) : null}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-black/6 px-4 py-3">
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-bold text-black/70 hover:bg-black/5"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl bg-meituan-yellow px-3 py-2.5 text-sm font-extrabold text-meituan-ink transition hover:brightness-95"
              onClick={() => onSubmit(draft)}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
