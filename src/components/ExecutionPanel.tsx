"use client";

import { useState } from "react";
import type { ExecutionAction, ExecutionTraceStep, Intent, RoutePlan } from "@/lib/types";
import { executePlan } from "@/lib/executor/executePlan";

type ExecutionPanelProps = {
  actions: ExecutionAction[];
  routePlan?: RoutePlan;
  intent: Intent;
};

function formatTraceStep(step: ExecutionTraceStep) {
  if (step.summary) return step.summary;
  if (step.status === "skipped") return `${step.toolName} 跳过`;
  if (step.status === "failed") return `${step.toolName} 失败：${step.error?.message ?? "unknown"}`;
  return `${step.toolName} 成功`;
}

function toReceiptLines(trace: ExecutionTraceStep[]) {
  const receipts: string[] = [];
  const failures: string[] = [];

  for (const step of trace) {
    if (step.status === "failed") {
      failures.push(`${step.toolName}：${step.error?.message ?? "unknown"}`);
      continue;
    }
    if (step.status !== "success") continue;

    const response = step.response as Record<string, unknown> | undefined;
    if (!response) {
      receipts.push(formatTraceStep(step));
      continue;
    }

    if (typeof response.reservationId === "string") receipts.push(`餐厅订位成功（reservationId: ${response.reservationId}）`);
    if (typeof response.orderId === "string") receipts.push(`下单成功（orderId: ${response.orderId}）`);
    if (typeof response.ticketId === "string") receipts.push(`活动票务成功（ticketId: ${response.ticketId}）`);
    if (typeof response.receiptId === "string") receipts.push(`预约/核销成功（receiptId: ${response.receiptId}）`);
    if (typeof response.messageId === "string") receipts.push(`发送成功（messageId: ${response.messageId}）`);
  }

  const uniqueReceipts = Array.from(new Set(receipts));
  const uniqueFailures = Array.from(new Set(failures));

  return { receipts: uniqueReceipts, failures: uniqueFailures };
}

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

async function copyTextSafely(text: string) {
  try {
    const permission = await navigator.permissions?.query?.({ name: "clipboard-write" as PermissionName });
    if (permission?.state !== "denied") {
      await navigator.clipboard?.writeText(text);
      return;
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
  } catch {}
}

export function ExecutionPanel({ actions, routePlan, intent }: ExecutionPanelProps) {
  const [trace, setTrace] = useState<ExecutionTraceStep[]>([]);
  const [running, setRunning] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [shareText, setShareText] = useState<string>("");
  const [receipts, setReceipts] = useState<string[]>([]);
  const [failures, setFailures] = useState<string[]>([]);
  const completedTraceCount = trace.filter((step) => step.status === "success").length;

  return (
    <section className="rounded-lg border border-black/5 bg-white p-4 shadow-soft">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">确认并执行</h2>
          <p className="text-sm text-black/58">AI 将模拟完成订座、下单、路线生成和计划发送。</p>
        </div>
        <button
          className="rounded-lg bg-meituan-yellow px-5 py-2.5 text-sm font-bold text-meituan-ink transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={!routePlan || running}
          onClick={async () => {
            if (!routePlan) return;
            setRunning(true);
            setTrace([]);
            setShareText("");
            setReceipts([]);
            setFailures([]);
            const result = await executePlan({ routePlan, intent, shareTo: "对方" });
            setTrace(result);
            const { receipts: nextReceipts, failures: nextFailures } = toReceiptLines(result);
            setReceipts(nextReceipts);
            setFailures(nextFailures);
            const shareStep = result.find((step) => step.toolName === "GenerateShareText" && step.status === "success");
            const text = (shareStep?.response as { shareText?: string } | undefined)?.shareText ?? "";
            setShareText(text);
            setRunning(false);
          }}
        >
          {running ? "执行中..." : "确认并执行"}
        </button>
      </div>

      {shareText ? (
        <div className="mb-4 rounded-lg border border-meituan-yellow/40 bg-yellow-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-extrabold text-black/80">可转发文案</p>
            <button
              type="button"
              className="rounded-lg bg-meituan-yellow px-3 py-1.5 text-xs font-bold text-meituan-ink hover:brightness-95"
              onClick={() => copyTextSafely(shareText)}
            >
              复制
            </button>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-black/70">{shareText}</p>
        </div>
      ) : null}

      {trace.length ? (
        <div className="mb-4 rounded-lg border border-black/10 bg-meituan-gray p-4">
          <p className="mb-2 font-bold text-black/80">执行结果</p>
          {receipts.length ? (
            <ul className="space-y-1 text-sm text-black/70">
              {receipts.map((line) => (
                <li key={line}>✓ {line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-black/60">已执行（暂无可展示凭证）。</p>
          )}
          {failures.length ? (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-sm font-bold text-rose-800">部分步骤失败（已尽量回退处理）：</p>
              <ul className="mt-2 space-y-1 text-sm text-rose-800">
                {failures.map((line) => (
                  <li key={line}>- {line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-black/10 bg-meituan-gray/70">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          onClick={() => setTraceOpen((open) => !open)}
          aria-expanded={traceOpen}
        >
          <span>
            <span className="block text-sm font-extrabold text-black/78">查看工具调用记录</span>
            <span className="mt-1 block text-xs leading-5 text-black/50">
              包含 CheckAvailability、ReserveTable、BuyDeal、GenerateShareText 等 mock tool 调用
            </span>
            {trace.length ? (
              <span className="mt-1 inline-block text-xs font-bold text-emerald-700">已完成 {completedTraceCount} 项执行动作，可展开查看详情</span>
            ) : null}
          </span>
          <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-black/60 shadow-sm">
            {traceOpen ? "收起" : "+ 展开"}
          </span>
        </button>

        {traceOpen ? (
          <div className="space-y-3 px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {(actions.length ? actions : [
                { id: "coffee", label: "购买咖啡套餐" },
                { id: "reserve", label: "预订餐厅" },
                { id: "route", label: "生成路线" },
                { id: "share", label: "发送给朋友" },
              ]).map((action) => (
                <span key={action.id} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-semibold text-black/68">
                  {action.label}
                </span>
              ))}
            </div>

            {trace.length ? (
              <div className="space-y-2">
                {trace.map((step) => {
                  const receiptIds = extractReceiptIds(step);
                  return (
                    <div key={step.stepId} className="rounded-lg bg-white p-3 text-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-extrabold text-black/80">{step.toolName}</p>
                          <p className="text-xs font-bold uppercase text-black/38">
                            {step.phase} · {step.status}
                          </p>
                        </div>
                        <span
                          className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${
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
                      <div className="mt-3 grid gap-2 text-xs text-black/62 lg:grid-cols-2">
                        <div className="rounded-md bg-meituan-gray px-3 py-2">
                          <span className="font-bold text-black/70">Request：</span>
                          {summarizePayload(step.request)}
                        </div>
                        <div className="rounded-md bg-meituan-gray px-3 py-2">
                          <span className="font-bold text-black/70">Response：</span>
                          {step.error?.message ?? summarizePayload(step.response)}
                        </div>
                      </div>
                      {receiptIds.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {receiptIds.map((id) => (
                            <span key={`${step.stepId}-${id}`} className="rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-bold text-black/65">
                              {id}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg bg-white px-3 py-3 text-sm text-black/55">确认执行后，这里会显示完整 mock tool 调用记录。</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
