"use client";

import { buildQrSeed } from "@/lib/qrSeed";

type MockQrCodeProps = {
  seed: string;
  size?: number;
  className?: string;
};

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isInFinderPattern(x: number, y: number, gridSize: number) {
  const inTopLeft = x < 7 && y < 7;
  const inTopRight = x >= gridSize - 7 && y < 7;
  const inBottomLeft = x < 7 && y >= gridSize - 7;
  return inTopLeft || inTopRight || inBottomLeft;
}

function isFinderModuleFilled(x: number, y: number, gridSize: number) {
  const localX = x >= gridSize - 7 ? x - (gridSize - 7) : x;
  const localY = y >= gridSize - 7 ? y - (gridSize - 7) : y;
  const inOuter = localX === 0 || localY === 0 || localX === 6 || localY === 6;
  const inInner = localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4;
  return inOuter || inInner;
}

function isInLogoArea(x: number, y: number, gridSize: number) {
  const center = (gridSize - 1) / 2;
  return Math.abs(x - center) <= 2.5 && Math.abs(y - center) <= 2.5;
}

function buildQrGrid(seed: string, gridSize: number) {
  const hash = hashSeed(seed || "demo-voucher");
  const grid: boolean[][] = [];

  for (let y = 0; y < gridSize; y += 1) {
    const row: boolean[] = [];
    for (let x = 0; x < gridSize; x += 1) {
      if (isInFinderPattern(x, y, gridSize)) {
        row.push(isFinderModuleFilled(x, y, gridSize));
        continue;
      }
      if (isInLogoArea(x, y, gridSize)) {
        row.push(false);
        continue;
      }
      const mixed = (hash + x * 92837111 + y * 689287499 + x * y * 17) >>> 0;
      row.push(mixed % 5 < 2 || mixed % 11 === 3);
    }
    grid.push(row);
  }

  return grid;
}

export function MockQrCode({ seed, size = 21, className }: MockQrCodeProps) {
  const grid = buildQrGrid(seed, size);
  const moduleSize = 100 / size;

  return (
    <div className={className}>
      <div className="relative mx-auto w-[168px] max-w-full rounded-xl border border-black/8 bg-white p-3 shadow-sm">
        <svg viewBox="0 0 100 100" className="h-auto w-full" aria-hidden="true">
          <rect x="0" y="0" width="100" height="100" fill="#ffffff" />
          {grid.map((row, y) =>
            row.map((filled, x) =>
              filled ? (
                <rect
                  key={`${x}-${y}`}
                  x={x * moduleSize}
                  y={y * moduleSize}
                  width={moduleSize}
                  height={moduleSize}
                  fill="#111111"
                />
              ) : null,
            ),
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-md bg-meituan-yellow px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-meituan-ink shadow-sm">
            美团
          </span>
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] font-bold text-black/45">Demo 凭证码</p>
    </div>
  );
}
