"use client";

import type { ReactNode } from "react";

type ExecutionModalProps = {
  open: boolean;
  title: string;
  titleTestId?: string;
  onClose: () => void;
  closeDisabled?: boolean;
  children: ReactNode;
};

export function ExecutionModal({ open, title, titleTestId, onClose, closeDisabled = false, children }: ExecutionModalProps) {
  if (!open) return null;

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-[13000] flex items-end justify-center bg-black/35"
      data-testid="execution-modal"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="execution-modal-title"
        className="mx-0 flex max-h-[72%] w-full flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-black/12" aria-hidden="true" />

        <div className="flex shrink-0 items-start justify-between gap-2 px-4 pb-2 pt-2">
          <h2 id="execution-modal-title" data-testid={titleTestId} className="text-base font-extrabold text-meituan-ink">
            {title}
          </h2>
          <button
            type="button"
            data-testid="execution-modal-close"
            className="shrink-0 rounded-lg px-2 py-1 text-sm font-bold text-black/45 transition hover:bg-black/5 hover:text-black/70 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="关闭"
          >
            关闭
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}
