"use client";

import { useMemo, useState } from "react";
import { appendVoucherShareLine, BookingVoucherCard, buildBookingVoucherModel } from "@/components/BookingVoucherCard";
import {
  buildContextualDoneSummary,
  buildContextualIdleActions,
  buildContextualRunningSteps,
  buildEnhancedShareText,
  buildTraceFoldSummary,
  type SelectedPlanSummary,
  type SelectedPlanType,
} from "@/lib/executionContext";
import type { TravelSettings } from "@/lib/preferenceSummary";
import type { ExecutionTraceStep, Intent, RoutePlan } from "@/lib/types";
import { executePlan } from "@/lib/executor/executePlan";

type ExecutionPanelProps = {
  routePlan?: RoutePlan;
  intent: Intent;
  selectedPlanType: SelectedPlanType;
  selectedFallbackIndex: number | null;
  travelSettings: TravelSettings;
  currentPlanLabel: string;
  selectedPlanSummary: SelectedPlanSummary;
};

type ExecutionStatus = "idle" | "running" | "done";

const RUNNING_STEP_MS = 450;

function summarizePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return payload ? String(payload) : "无";
  const record = payload as Record<string, unknown>;
  const entries = Object.entries(record)
    .filter(([, value]) => value !== undefined && value !== "")
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
  return entries.length ? entries.join(" / ") : "无";
}

function extractReceiptIds(step: ExecutionTraceStep) {
  const response = step.response as Record<string, unknown> | undefined;
  if (!response) return [];
  return ["reservationId", "orderId", "ticketId", "receiptId", "routeId", "messageId"]
    .map((key) => (typeof response[key] === "string" ? `${key}: ${response[key]}` : ""))
    .filter(Boolean);
}

function collectReceiptIds(trace: ExecutionTraceStep[]) {
  const ids: Record<string, string> = {};
  for (const step of trace) {
    const response = step.response as Record<string, unknown> | undefined;
    if (!response) continue;
    for (const key of ["reservationId", "orderId", "ticketId", "receiptId", "routeId", "messageId"]) {
      if (typeof response[key] === "string") ids[key] = response[key];
    }
  }
  return ids;
}

async function copyTextSafely(text: string) {
  try {
    const permission = await navigator.permissions?.query?.({ name: "clipboard-write" as PermissionName });
    if (permission?.state !== "denied") {
      await navigator.clipboard?.writeText(text);
      return true;
    }
  } catch {}

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function ExecutionPanel({
  routePlan,
  intent,
  selectedPlanType,
  selectedFallbackIndex,
  travelSettings,
  currentPlanLabel,
  selectedPlanSummary,
}: ExecutionPanelProps) {
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>("idle");
  const [runningStep, setRunningStep] = useState(0);
  const [trace, setTrace] = useState<ExecutionTraceStep[]>([]);
  const [shareText, setShareText] = useState("");
  const [traceOpen, setTraceOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const idleActions = useMemo(
    () => buildContextualIdleActions({ travelSettings, selectedPlanType }),
    [travelSettings, selectedPlanType],
  );

  const { steps: runningSteps, hints: runningHints } = useMemo(
    () => buildContextualRunningSteps({ travelSettings, selectedPlanType }),
    [travelSettings, selectedPlanType],
  );

  const traceFoldSummary = useMemo(() => buildTraceFoldSummary(selectedPlanType), [selectedPlanType]);

  const receiptIds = useMemo(() => collectReceiptIds(trace), [trace]);

  const bookingVoucher = useMemo(() => {
    if (executionStatus !== "done" || !routePlan) return null;
    return buildBookingVoucherModel({
      routePlan,
      travelSettings,
      selectedPlanType,
      selectedFallbackIndex,
      currentPlanLabel,
      partySize: intent.partySize ?? travelSettings.partySize,
      receiptIds,
    });
  }, [
    executionStatus,
    routePlan,
    travelSettings,
    selectedPlanType,
    selectedFallbackIndex,
    currentPlanLabel,
    intent.partySize,
    receiptIds,
  ]);

  const doneSummary = useMemo(() => {
    const traceHasReservation = trace.some((step) => step.toolName === "ReserveTable" && step.status === "success");
    const traceHasOrder = trace.some(
      (step) => (step.toolName === "PlaceOrder" || step.toolName === "BookTickets") && step.status === "success",
    );
    return buildContextualDoneSummary({
      selectedPlanType,
      currentPlanLabel,
      hasShareText: Boolean(shareText),
      hasRoutePlan: Boolean(routePlan),
      traceHasReservation,
      traceHasOrder,
    });
  }, [trace, routePlan, selectedPlanType, currentPlanLabel, shareText]);

  const completedTraceCount = trace.filter((step) => step.status === "success").length;
  const progressPercent =
    executionStatus === "running"
      ? Math.round(((runningStep + 1) / runningSteps.length) * 100)
      : executionStatus === "done"
        ? 100
        : 0;

  async function handleExecute() {
    if (!routePlan || executionStatus === "running") return;

    setExecutionStatus("running");
    setRunningStep(0);
    setTrace([]);
    setShareText("");
    setCopied(false);
    setTraceOpen(false);

    const executePromise = executePlan({ routePlan, intent, shareTo: "对方" });

    for (let i = 0; i < runningSteps.length; i += 1) {
      setRunningStep(i);
      await delay(RUNNING_STEP_MS);
    }

    const result = await executePromise;
    const shareStep = result.find((step) => step.toolName === "GenerateShareText" && step.status === "success");
    const originalShareText = (shareStep?.response as { shareText?: string } | undefined)?.shareText ?? "";
    const enhancedShareText = appendVoucherShareLine(
      buildEnhancedShareText({
        originalShareText,
        travelSettings,
        currentPlanLabel,
        selectedPlanType,
        routePlan,
        selectedFallbackIndex,
      }),
    );

    setTrace(result);
    setShareText(enhancedShareText);
    setExecutionStatus("done");
  }

  async function handleCopy() {
    if (!shareText) return;
    const ok = await copyTextSafely(shareText);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-black/6 bg-white shadow-soft">
      <div className="border-b border-black/5 bg-meituan-gray/40 px-4 py-3">
        <p className="text-[11px] font-bold text-black/40">即将执行</p>
        <p className="mt-0.5 text-base font-extrabold text-meituan-ink">{currentPlanLabel}</p>
        <p className="mt-1 text-[11px] font-medium leading-5 text-black/55">{selectedPlanSummary.travelSummary}</p>
        {selectedPlanSummary.planNote ? (
          <p className="mt-1 text-[11px] leading-5 text-amber-900">{selectedPlanSummary.planNote}</p>
        ) : null}
      </div>

      <div className="p-4">
      {executionStatus === "idle" ? (
        <div>
          <h2 className="text-lg font-extrabold text-meituan-ink">确认后帮你搞定</h2>
          <p className="mt-1 text-sm text-black/55">会依次完成订座、路线衔接，并生成可转发的安排。</p>

          <ul className="mt-4 space-y-2">
            {idleActions.map((action) => (
              <li key={action.id} className="flex items-center gap-2.5 rounded-xl bg-meituan-gray/70 px-3 py-2.5 text-sm text-black/70">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-meituan-yellow text-[10px] font-bold text-meituan-ink">✓</span>
                {action.label}
              </li>
            ))}
          </ul>

          <button
            type="button"
            data-testid="execution-start-button"
            className="mt-5 w-full rounded-2xl bg-meituan-yellow px-4 py-3.5 text-sm font-extrabold text-meituan-ink shadow-md transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!routePlan}
            onClick={handleExecute}
          >
            确认执行
          </button>
        </div>
      ) : null}

      {executionStatus === "running" ? (
        <div>
          <div className="flex items-start gap-3">
            <div className="relative mt-0.5 h-10 w-10 shrink-0">
              <div className="absolute inset-0 rounded-full border-2 border-meituan-yellow/30" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-meituan-yellow" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-meituan-ink">正在处理中</h2>
              <p className="mt-1 text-sm text-black/55">订座和路线安排进行中，请稍候。</p>
            </div>
          </div>

          {runningHints.map((hint) => (
            <p key={hint} className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-900">
              {hint}
            </p>
          ))}

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/8">
            <div className="h-full rounded-full bg-meituan-yellow transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          </div>

          <ul className="mt-4 space-y-2">
            {runningSteps.map((label, index) => {
              const active = index === runningStep;
              const done = index < runningStep;
              return (
                <li
                  key={label}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                    active ? "bg-meituan-yellow/15 font-bold text-meituan-ink" : done ? "text-black/45" : "text-black/30"
                  }`}
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                      done ? "bg-emerald-500 text-white" : active ? "bg-meituan-yellow text-meituan-ink" : "bg-black/8 text-black/35"
                    }`}
                  >
                    {done ? "✓" : index + 1}
                  </span>
                  {label}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {executionStatus === "done" ? (
        <div data-testid="execution-done">
          <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <div className="flex items-center gap-3 px-4 py-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500 text-lg font-bold text-white shadow-sm">✓</span>
              <div>
                <h2 className="text-lg font-extrabold text-meituan-ink">安排已完成</h2>
                <p className="mt-0.5 text-xs text-black/50">订座与路线已就绪，出发前可直接使用</p>
              </div>
            </div>
            <ul className="space-y-1.5 border-t border-emerald-100 px-4 py-3">
              {doneSummary.map((line) => (
                <li key={line} className="flex items-start gap-2 text-sm font-semibold text-emerald-900">
                  <span className="mt-0.5 text-emerald-600">✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          {bookingVoucher ? <BookingVoucherCard voucher={bookingVoucher} /> : null}

          {shareText ? (
            <div className="mt-4 rounded-2xl border border-meituan-yellow/30 bg-yellow-50/80 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-extrabold text-black/80">发给同行人</p>
                <button
                  type="button"
                  className="rounded-lg bg-meituan-yellow px-3 py-1.5 text-xs font-bold text-meituan-ink hover:brightness-95"
                  onClick={handleCopy}
                >
                  {copied ? "已复制" : "复制文案"}
                </button>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-black/70">{shareText}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-black/6 bg-meituan-gray/40">
        <button
          type="button"
          data-testid="execution-trace-toggle"
          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
          onClick={() => setTraceOpen((open) => !open)}
          aria-expanded={traceOpen}
        >
          <span>
            <span className="block text-xs font-bold text-black/45">技术细节</span>
            <span className="mt-0.5 block text-[11px] leading-5 text-black/40">{traceFoldSummary}</span>
            {trace.length ? (
              <span className="mt-0.5 inline-block text-[10px] font-semibold text-black/35">{completedTraceCount} 步已完成</span>
            ) : null}
          </span>
          <span className="shrink-0 text-[11px] font-bold text-black/40">{traceOpen ? "收起" : "展开"}</span>
        </button>

        {traceOpen ? (
          <div className="max-h-[240px] space-y-2 overflow-y-auto px-4 pb-4">
            {trace.length ? (
              trace.map((step) => {
                const stepReceiptIds = extractReceiptIds(step);
                return (
                  <div key={step.stepId} className="rounded-lg bg-white p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-extrabold text-black/80">{step.toolName}</p>
                        <p className="text-xs font-bold uppercase text-black/38">
                          {step.phase} · {step.status}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                          step.status === "success"
                            ? "bg-emerald-50 text-emerald-700"
                            : step.status === "failed"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {step.status}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-black/62">
                      <div className="rounded-md bg-meituan-gray px-3 py-2">
                        <span className="font-bold text-black/70">Request：</span>
                        {summarizePayload(step.request)}
                      </div>
                      <div className="rounded-md bg-meituan-gray px-3 py-2">
                        <span className="font-bold text-black/70">Response：</span>
                        {step.error?.message ?? summarizePayload(step.response)}
                      </div>
                    </div>
                    {stepReceiptIds.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {stepReceiptIds.map((id) => (
                          <span key={`${step.stepId}-${id}`} className="rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-bold text-black/65">
                            {id}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <p className="rounded-lg bg-white px-3 py-3 text-xs text-black/45">执行完成后可查看后台处理记录。</p>
            )}
          </div>
        ) : null}
      </div>
      </div>
    </section>
  );
}
