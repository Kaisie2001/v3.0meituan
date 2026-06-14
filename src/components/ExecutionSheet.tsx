"use client";

import { ExecutionModal } from "@/components/ExecutionModal";
import {
  ExecutionPanelBody,
  getExecutionModalTitle,
  useExecutionPanelState,
  type ExecutionPanelProps,
} from "@/components/ExecutionPanel";

type ExecutionSheetProps = ExecutionPanelProps & {
  open: boolean;
  onClose: () => void;
};

export function ExecutionSheet({ open, onClose, ...panelProps }: ExecutionSheetProps) {
  const state = useExecutionPanelState({ ...panelProps, variant: "modal" });
  const modalTitle = getExecutionModalTitle(state.executionStatus);

  function handleClose() {
    if (state.executionStatus === "running") return;
    onClose();
  }

  function handleViewFinalPlan() {
    panelProps.onViewFinalPlan?.();
    onClose();
  }

  return (
    <ExecutionModal
      open={open}
      title={modalTitle}
      titleTestId={state.executionStatus === "done" ? "execution-complete-title" : undefined}
      onClose={handleClose}
      closeDisabled={state.executionStatus === "running"}
    >
      <ExecutionPanelBody
        {...panelProps}
        variant="modal"
        executionStatus={state.executionStatus}
        runningStep={state.runningStep}
        trace={state.trace}
        shareText={state.shareText}
        copied={state.copied}
        onExecute={state.handleExecute}
        onCopy={state.handleCopy}
        onCancelQueue={state.handleCancelQueue}
        onViewFinalPlan={handleViewFinalPlan}
        onClose={handleClose}
      />
    </ExecutionModal>
  );
}
