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
  const [shareText, setShareText] = useState<string>("");
  const [receipts, setReceipts] = useState<string[]>([]);
  const [failures, setFailures] = useState<string[]>([]);

  return (
    <section className="rounded-lg border border-black/5 bg-white p-4 shadow-soft">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">执行面板</h2>
          <p className="text-sm text-black/58">按工具调用链路模拟订位/预约/下单/发送。</p>
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

      <div className="mb-4 flex flex-wrap gap-2">
        {(actions.length ? actions : [
          { id: "coffee", label: "购买咖啡套餐" },
          { id: "reserve", label: "预订餐厅" },
          { id: "route", label: "生成路线" },
          { id: "share", label: "发送给朋友" },
        ]).map((action) => (
          <span key={action.id} className="rounded-full border border-black/10 bg-meituan-gray px-3 py-1.5 text-sm font-semibold text-black/68">
            {action.label}
          </span>
        ))}
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
        <div className="rounded-lg border border-black/10 bg-meituan-gray p-4">
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
    </section>
  );
}
