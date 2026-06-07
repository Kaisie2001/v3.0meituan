"use client";

import { useMemo, useState } from "react";
import type { ExecutionAction, ExecutionTraceStep, Intent, RoutePlan } from "@/lib/types";
import { executePlan } from "@/lib/executor/executePlan";

type ExecutionPanelProps = {
  actions: ExecutionAction[];
  routePlan?: RoutePlan;
  intent: Intent;
};

type ExecutionStatus = "idle" | "running" | "done";

const defaultActions: ExecutionAction[] = [
  { id: "check", label: "检查可订状态" },
  { id: "lock", label: "锁定餐厅/活动名额" },
  { id: "route", label: "生成路线" },
  { id: "share", label: "生成可转发文案" },
];

const runningSteps = ["正在检查可订状态", "正在锁定座位/票券", "正在生成路线", "正在生成分享文案"];

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

function buildDoneSummary(trace: ExecutionTraceStep[], hasRoutePlan: boolean) {
  const ids = collectReceiptIds(trace);
  const items: string[] = [];

  if (ids.reservationId || trace.some((s) => s.toolName === "ReserveTable" && s.status === "success")) {
    items.push("已完成订座");
  }
  if (ids.orderId || ids.ticketId || trace.some((s) => (s.toolName === "PlaceOrder" || s.toolName === "BookTickets") && s.status === "success")) {
    items.push("已完成下单/购券");
  }
  if (ids.routeId || hasRoutePlan) {
    items.push("已生成路线");
  }
  if (trace.some((s) => s.toolName === "GenerateShareText" && s.status === "success")) {
    items.push("已生成可转发文案");
  }

  return items.length ? items : ["方案已执行完成"];
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

export function ExecutionPanel({ actions, routePlan, intent }: ExecutionPanelProps) {
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>("idle");
  const [runningStep, setRunningStep] = useState(0);
  const [trace, setTrace] = useState<ExecutionTraceStep[]>([]);
  const [shareText, setShareText] = useState("");
  const [traceOpen, setTraceOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const actionItems = actions.length ? actions : defaultActions;
  const receiptIds = useMemo(() => collectReceiptIds(trace), [trace]);
  const doneSummary = useMemo(() => buildDoneSummary(trace, Boolean(routePlan)), [trace, routePlan]);
  const completedTraceCount = trace.filter((step) => step.status === "success").length;
  const progressPercent = executionStatus === "running" ? Math.round(((runningStep + 1) / runningSteps.length) * 100) : executionStatus === "done" ? 100 : 0;

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
    const text = (shareStep?.response as { shareText?: string } | undefined)?.shareText ?? "";

    setTrace(result);
    setShareText(text);
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
    <section className="rounded-2xl border border-black/8 bg-white p-4 shadow-soft">
      {executionStatus === "idle" ? (
        <div>
          <h2 className="text-lg font-extrabold text-meituan-ink">确认并执行</h2>
          <p className="mt-1 text-sm text-black/58">AI 将模拟完成订座、下单、路线生成和计划发送。</p>

          <ul className="mt-4 space-y-2">
            {actionItems.map((action) => (
              <li key={action.id} className="flex items-center gap-2 rounded-lg bg-meituan-gray/80 px-3 py-2 text-sm text-black/70">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-meituan-yellow/70 text-[10px] font-bold text-meituan-ink">✓</span>
                {action.label}
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="mt-5 w-full rounded-lg bg-meituan-yellow px-4 py-3 text-sm font-extrabold text-meituan-ink transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
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
              <h2 className="text-lg font-extrabold text-meituan-ink">正在执行方案</h2>
              <p className="mt-1 text-sm text-black/55">请稍候，正在为你完成订座与路线安排。</p>
            </div>
          </div>

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
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500 text-sm font-bold text-white">✓</span>
            <h2 className="text-lg font-extrabold text-meituan-ink">执行完成</h2>
          </div>

          <ul className="mt-4 space-y-2">
            {doneSummary.map((line) => (
              <li key={line} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                {line}
              </li>
            ))}
          </ul>

          {Object.keys(receiptIds).length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(receiptIds).map(([key, value]) => (
                <span key={key} className="rounded-full bg-meituan-gray px-2.5 py-1 text-[11px] font-bold text-black/60">
                  {key}: {value}
                </span>
              ))}
            </div>
          ) : null}

          {shareText ? (
            <div className="mt-4 rounded-xl border border-meituan-yellow/40 bg-yellow-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-extrabold text-black/80">可转发文案</p>
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

      <div className="mt-4 rounded-xl border border-black/10 bg-meituan-gray/70">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          onClick={() => setTraceOpen((open) => !open)}
          aria-expanded={traceOpen}
        >
          <span>
            <span className="block text-sm font-extrabold text-black/78">查看工具调用记录</span>
            <span className="mt-1 block text-xs leading-5 text-black/50">
              包含可订检查、排队判断、订座/下单、路线生成和消息发送等 mock tool 调用。
            </span>
            {trace.length ? (
              <span className="mt-1 inline-block text-xs font-bold text-emerald-700">已完成 {completedTraceCount} 项调用</span>
            ) : null}
          </span>
          <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-black/60 shadow-sm">
            {traceOpen ? "收起" : "展开"}
          </span>
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
              <p className="rounded-lg bg-white px-3 py-3 text-sm text-black/55">确认执行后，这里会显示完整 mock tool 调用记录。</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
