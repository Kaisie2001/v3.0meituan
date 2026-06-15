"use client";

import { useState, type ReactNode } from "react";

export type HomeSheetState = "collapsed" | "mid" | "expanded";

const SHEET_NEXT: Record<HomeSheetState, HomeSheetState> = {
  collapsed: "mid",
  mid: "expanded",
  expanded: "collapsed",
};

const SHEET_HEIGHT_CLASS: Record<HomeSheetState, string> = {
  collapsed: "h-[38%]",
  mid: "h-[52%]",
  expanded: "h-[78%]",
};

type HomeBottomSheetProps = {
  children: ReactNode;
  initialState?: HomeSheetState;
};

export function HomeBottomSheet({ children, initialState = "mid" }: HomeBottomSheetProps) {
  const [sheetState, setSheetState] = useState<HomeSheetState>(initialState);

  return (
    <div
      data-testid="home-bottom-sheet"
      data-sheet-state={sheetState}
      className={`pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex max-h-[88%] flex-col overflow-hidden rounded-t-[28px] border-t border-white/90 bg-white shadow-[0_-12px_40px_rgba(15,23,42,0.12)] transition-[height] duration-300 ease-out ${SHEET_HEIGHT_CLASS[sheetState]}`}
    >
      <button
        type="button"
        data-testid="home-sheet-handle"
        className="flex shrink-0 touch-none items-center justify-center py-3 active:opacity-70"
        onClick={() => setSheetState((state) => SHEET_NEXT[state])}
        aria-label="调整规划面板高度"
      >
        <span className="h-1 w-12 rounded-full bg-black/15" aria-hidden="true" />
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pb-4">
        {children}
      </div>
    </div>
  );
}
