type HomeHeaderProps = {
  onResetDemo: () => void;
  className?: string;
};

export function HomeHeader({ onResetDemo, className = "" }: HomeHeaderProps) {
  return (
    <header
      data-testid="home-header"
      className={`pointer-events-auto bg-gradient-to-b from-white/85 via-white/35 to-transparent px-4 pb-2 pt-2 ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-black/45">美团 · 本地生活</p>
          <h1 className="mt-0.5 text-lg font-extrabold tracking-tight text-meituan-ink">成行地图</h1>
          <p className="mt-0.5 text-[11px] leading-4 text-black/55">说出你想怎么过这几小时，帮你安排路线</p>
        </div>
        <button
          type="button"
          onClick={onResetDemo}
          className="shrink-0 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-black/45 shadow-sm transition hover:bg-white hover:text-black/65"
        >
          清空
        </button>
      </div>
    </header>
  );
}
