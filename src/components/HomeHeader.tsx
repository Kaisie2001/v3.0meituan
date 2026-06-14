type HomeHeaderProps = {
  onResetDemo: () => void;
};

export function HomeHeader({ onResetDemo }: HomeHeaderProps) {
  return (
    <header
      data-testid="home-header"
      className="relative z-20 shrink-0 border-b border-white/60 bg-white/88 px-4 py-3 backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-black/40">美团 · 本地生活</p>
          <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-meituan-ink">成行地图</h1>
          <p className="mt-1 text-xs leading-5 text-black/55">说出你想怎么过这几小时，帮你安排路线</p>
        </div>
        <button
          type="button"
          onClick={onResetDemo}
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-black/40 transition hover:bg-black/5 hover:text-black/60"
        >
          清空
        </button>
      </div>
    </header>
  );
}
