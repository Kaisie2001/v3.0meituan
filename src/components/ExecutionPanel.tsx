"use client";

import { useMemo, useState } from "react";
import { appendVoucherShareLine } from "@/components/BookingVoucherCard";
import { ExecutionArtifactCard } from "@/components/ExecutionArtifactCard";
import {
  buildExecutionArtifacts,
  getExecutionArtifactPrimaryActionLabel,
} from "@/lib/executionArtifacts";
import {
  buildContextualIdleActions,
  buildContextualRunningSteps,
  buildEnhancedShareText,
  buildExecutionScopeLabel,
  type SelectedPlanSummary,
  type SelectedPlanType,
} from "@/lib/executionContext";
import type { TravelSettings } from "@/lib/preferenceSummary";
import type { ExecutionTraceStep, Intent, RoutePlan } from "@/lib/types";
import { executePlan } from "@/lib/executor/executePlan";

export type ExecutionPanelProps = {
  routePlan?: RoutePlan;
  intent: Intent;
  selectedPlanType: SelectedPlanType;
  selectedFallbackIndex: number | null;
  travelSettings: TravelSettings;
  currentPlanLabel: string;
  selectedPlanSummary: SelectedPlanSummary;
  onViewFinalPlan?: () => void;
  onClose?: () => void;
  variant?: "page" | "modal";
};

type ExecutionPanelBodyProps = ExecutionPanelProps & {
  executionStatus: ExecutionStatus;
  runningStep: number;
  trace: ExecutionTraceStep[];
  shareText: string;
  copied: boolean;
  sharePreviewOpen: boolean;
  queueCancelled: boolean;
  onExecute: () => void;
  onCopy: () => void;
  onOpenSharePreview: () => void;
  onCancelQueue: () => void;
};

type ExecutionStatus = "idle" | "running" | "done";

const RUNNING_STEP_MS = 450;
const DEMO_EXECUTION_NOTE =
  "当前为 demo 模拟执行，真实产品可接入美团/点评预订、排队、购票与地图导航服务。";

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

export function getExecutionModalTitle(status: ExecutionStatus) {
  if (status === "done") return "已为你安排好";
  if (status === "running") return "正在安排";
  return "确认并模拟执行";
}

export function ExecutionPanelBody({
  routePlan,
  intent,
  selectedPlanType,
  selectedFallbackIndex,
  travelSettings,
  currentPlanLabel,
  selectedPlanSummary,
  onViewFinalPlan,
  onClose,
  variant = "page",
  executionStatus,
  runningStep,
  trace,
  shareText,
  copied,
  sharePreviewOpen,
  queueCancelled,
  onExecute,
  onCopy,
  onOpenSharePreview,
  onCancelQueue,
}: ExecutionPanelBodyProps) {
  const isModal = variant === "modal";

  const scopeLabel = useMemo(
    () => buildExecutionScopeLabel(selectedPlanType, currentPlanLabel),
    [selectedPlanType, currentPlanLabel],
  );

  const idleActions = useMemo(
    () => buildContextualIdleActions({ travelSettings, selectedPlanType }),
    [travelSettings, selectedPlanType],
  );

  const { steps: runningSteps, hints: runningHints } = useMemo(
    () => buildContextualRunningSteps({ travelSettings, selectedPlanType }),
    [travelSettings, selectedPlanType],
  );

  const receiptIds = useMemo(() => collectReceiptIds(trace), [trace]);

  const executionArtifact = useMemo(() => {
    if (executionStatus !== "done" || !routePlan) return null;
    return buildExecutionArtifacts({
      routePlan,
      travelSettings,
      selectedPlanType,
      selectedFallbackIndex,
      currentPlanLabel,
      partySize: intent.partySize ?? travelSettings.partySize,
      shareText,
      planSummary: selectedPlanSummary.nodePreview,
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
    shareText,
    selectedPlanSummary.nodePreview,
    receiptIds,
  ]);

  const primaryActionLabel = executionArtifact
    ? getExecutionArtifactPrimaryActionLabel(executionArtifact.type)
    : "查看最终行程";

  const progressPercent =
    executionStatus === "running"
      ? Math.round(((runningStep + 1) / runningSteps.length) * 100)
      : executionStatus === "done"
        ? 100
        : 0;

  const summaryBlock = (
    <div className={isModal ? "rounded-xl bg-meituan-gray/40 px-3 py-2.5" : "border-b border-black/5 bg-meituan-gray/30 px-3.5 py-3"}>
      {!isModal ? (
        <p className="text-[10px] font-bold uppercase tracking-wide text-black/38">
          {executionStatus === "idle" ? "已准备执行" : executionStatus === "running" ? "正在安排" : "执行完成"}
        </p>
      ) : null}
      <p className="text-sm font-extrabold text-meituan-ink">{scopeLabel.scope}</p>
      {selectedPlanType === "fallback" ? (
        <p className="mt-0.5 text-xs font-semibold text-black/58">{scopeLabel.planDetail}</p>
      ) : null}
      <p className="mt-1.5 text-[11px] leading-5 text-black/52">{selectedPlanSummary.travelSummary}</p>
      {selectedPlanSummary.planNote ? (
        <p className="mt-1 text-[11px] leading-5 text-black/45">{selectedPlanSummary.planNote}</p>
      ) : null}
    </div>
  );

  return (
    <>
      {!isModal ? summaryBlock : null}

      <div className={isModal ? "" : "p-3.5"}>
        {isModal && executionStatus !== "done" ? summaryBlock : null}

        {executionStatus === "idle" ? (
          <div data-testid="execution-idle">
            <p className="text-sm font-semibold text-black/62">确认后将完成 4 件事</p>

            <ol className="mt-2.5 space-y-1.5">
              {idleActions.map((action, index) => (
                <li key={action.id} className="flex items-start gap-2 text-[13px] leading-5 text-black/62">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-black/6 text-[10px] font-bold text-black/45">
                    {index + 1}
                  </span>
                  {action.label}
                </li>
              ))}
            </ol>

            <div data-testid="execution-modal-confirm-button">
              <button
                type="button"
                data-testid="execution-start-button"
                className="mt-4 w-full rounded-xl bg-meituan-yellow px-4 py-3 text-sm font-extrabold text-meituan-ink shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!routePlan}
                onClick={onExecute}
              >
                确认并模拟执行
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-black/38">{DEMO_EXECUTION_NOTE}</p>
          </div>
        ) : null}

        {executionStatus === "running" ? (
          <div data-testid="execution-running">
            <h2 className="text-base font-extrabold text-meituan-ink">{runningSteps[runningStep] ?? "正在为你锁定安排…"}</h2>
            {runningHints[0] ? <p className="mt-1 text-xs leading-5 text-black/48">{runningHints[0]}</p> : null}

            <div className="mt-3 h-1 overflow-hidden rounded-full bg-black/6">
              <div
                className="h-full rounded-full bg-meituan-yellow/80 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <ul className="mt-3 space-y-1">
              {runningSteps.map((label, index) => {
                const active = index === runningStep;
                const done = index < runningStep;
                return (
                  <li
                    key={label}
                    className={`text-xs leading-5 ${active ? "font-semibold text-black/70" : done ? "text-black/40" : "text-black/28"}`}
                  >
                    {done ? "✓ " : active ? "· " : "  "}
                    {label}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {executionStatus === "done" ? (
          <div data-testid="execution-done">
            <div className="mb-3">
              {!isModal ? (
                <h2 data-testid="execution-complete-title" className="text-base font-extrabold text-meituan-ink">
                  已为你安排好
                </h2>
              ) : null}
              <p className={`text-[11px] leading-5 text-black/50 ${isModal ? "" : "mt-1"}`}>
                {selectedPlanSummary.travelSummary}
              </p>
            </div>

            {executionArtifact ? <ExecutionArtifactCard artifact={executionArtifact} compactTop /> : null}

            {queueCancelled ? (
              <p className="mt-2 rounded-lg bg-meituan-gray/50 px-2.5 py-2 text-xs text-black/55">
                已取消排队（demo 模拟，未接入真实取消接口）
              </p>
            ) : null}

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                data-testid="execution-view-plan-button"
                className="w-full rounded-xl bg-meituan-yellow px-4 py-3 text-sm font-extrabold text-meituan-ink shadow-sm transition hover:brightness-95"
                onClick={onViewFinalPlan ?? onClose}
              >
                {primaryActionLabel}
              </button>
              {executionArtifact?.type === "queue" && !queueCancelled ? (
                <button
                  type="button"
                  data-testid="execution-cancel-queue-button"
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-bold text-black/65 transition hover:bg-meituan-gray/50"
                  onClick={onCancelQueue}
                >
                  取消排队
                </button>
              ) : null}
              {executionArtifact?.type !== "queue" && shareText ? (
                <button
                  type="button"
                  data-testid="execution-copy-share-button"
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-bold text-black/65 transition hover:bg-meituan-gray/50"
                  onClick={onCopy}
                >
                  {copied ? "已复制分享文案" : "复制分享文案"}
                </button>
              ) : null}
              <button
                type="button"
                data-testid="execution-back-plan-button"
                className="w-full py-2 text-sm font-semibold text-black/45 transition hover:text-black/65"
                onClick={onClose ?? onViewFinalPlan}
              >
                返回方案
              </button>
            </div>

            <p className="mt-3 text-[10px] leading-4 text-black/38">{DEMO_EXECUTION_NOTE}</p>

            {executionArtifact?.type === "share" && shareText && sharePreviewOpen ? (
              <p className="mt-3 whitespace-pre-wrap rounded-lg bg-meituan-gray/50 px-3 py-2 text-xs leading-5 text-black/55">
                {shareText}
              </p>
            ) : executionArtifact?.type === "share" && shareText ? (
              <button
                type="button"
                className="mt-2 text-[11px] font-semibold text-black/40 underline-offset-2 hover:underline"
                onClick={onOpenSharePreview}
              >
                预览分享文案
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

export function useExecutionPanelState(props: ExecutionPanelProps) {
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>("idle");
  const [runningStep, setRunningStep] = useState(0);
  const [trace, setTrace] = useState<ExecutionTraceStep[]>([]);
  const [shareText, setShareText] = useState("");
  const [copied, setCopied] = useState(false);
  const [sharePreviewOpen, setSharePreviewOpen] = useState(false);
  const [queueCancelled, setQueueCancelled] = useState(false);

  const { steps: runningSteps } = useMemo(
    () => buildContextualRunningSteps({ travelSettings: props.travelSettings, selectedPlanType: props.selectedPlanType }),
    [props.travelSettings, props.selectedPlanType],
  );

  async function handleExecute() {
    const { routePlan, intent, travelSettings, currentPlanLabel, selectedPlanType, selectedFallbackIndex } = props;
    if (!routePlan || executionStatus === "running") return;

    setExecutionStatus("running");
    setRunningStep(0);
    setTrace([]);
    setShareText("");
    setCopied(false);
    setSharePreviewOpen(false);
    setQueueCancelled(false);

    const executePromise = executePlan({ routePlan, intent, shareTo: "对方" });

    for (let i = 0; i < runningSteps.length; i += 1) {
      setRunningStep(i);
      await delay(RUNNING_STEP_MS);
    }

    const result = await executePromise;
    const shareStep = result.find((step) => step.toolName === "GenerateShareText" && step.status === "success");
    const originalShareText = (shareStep?.response as { shareText?: string } | undefined)?.shareText ?? "";
    let enhancedShareText = buildEnhancedShareText({
      originalShareText,
      travelSettings,
      currentPlanLabel,
      selectedPlanType,
      routePlan,
      selectedFallbackIndex,
    });

    const artifactPreview = buildExecutionArtifacts({
      routePlan,
      travelSettings,
      selectedPlanType,
      selectedFallbackIndex,
      currentPlanLabel,
      partySize: intent.partySize ?? travelSettings.partySize,
      shareText: enhancedShareText,
      planSummary: props.selectedPlanSummary.nodePreview,
      receiptIds: collectReceiptIds(result),
    });
    if (artifactPreview.type === "voucher") {
      enhancedShareText = appendVoucherShareLine(enhancedShareText);
    }

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

  function handleCancelQueue() {
    setQueueCancelled(true);
    window.setTimeout(() => {
      props.onClose?.();
    }, 600);
  }

  return {
    executionStatus,
    runningStep,
    trace,
    shareText,
    copied,
    sharePreviewOpen,
    queueCancelled,
    handleExecute,
    handleCopy,
    handleCancelQueue,
    setSharePreviewOpen,
  };
}

export function ExecutionPanel(props: ExecutionPanelProps) {
  const state = useExecutionPanelState(props);
  const body = (
    <ExecutionPanelBody
      {...props}
      executionStatus={state.executionStatus}
      runningStep={state.runningStep}
      trace={state.trace}
      shareText={state.shareText}
      copied={state.copied}
      sharePreviewOpen={state.sharePreviewOpen}
      queueCancelled={state.queueCancelled}
      onExecute={state.handleExecute}
      onCopy={state.handleCopy}
      onOpenSharePreview={() => state.setSharePreviewOpen(true)}
      onCancelQueue={state.handleCancelQueue}
    />
  );

  if (props.variant === "modal") {
    return body;
  }

  return <section className="overflow-hidden rounded-2xl border border-black/6 bg-white shadow-soft">{body}</section>;
}
