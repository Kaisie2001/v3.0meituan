export type SemanticDims = {
  quietPreference: number;
  indoorPreference: number;
  queueTolerance: number;
  activityFirst: number;
  budgetLevel: number;
};

export type SemanticProfile = {
  seed: number;
  dims: SemanticDims;
};

function fnv1a32(input: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function u32ToUnit(hash: number, salt: number) {
  const mixed = (hash ^ salt) >>> 0;
  return mixed / 0xffffffff;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function buildSemanticProfile(text: string): SemanticProfile {
  const seed = fnv1a32(text);

  const quietPreference = clamp01(u32ToUnit(seed, 0xa11ce) * 0.9 + u32ToUnit(seed, 0x51a77) * 0.1);
  const indoorPreference = clamp01(u32ToUnit(seed, 0x19eaf) * 0.8 + u32ToUnit(seed, 0x7c0d1) * 0.2);
  const queueTolerance = clamp01(u32ToUnit(seed, 0x33b0f) * 0.85 + u32ToUnit(seed, 0x9d1a2) * 0.15);
  const activityFirst = clamp01(u32ToUnit(seed, 0x5f3759df) * 0.7 + u32ToUnit(seed, 0x6a09e667) * 0.3);
  const budgetLevel = clamp01(u32ToUnit(seed, 0x243f6a88) * 0.75 + u32ToUnit(seed, 0x85a308d3) * 0.25);

  return {
    seed,
    dims: {
      quietPreference,
      indoorPreference,
      queueTolerance,
      activityFirst,
      budgetLevel,
    },
  };
}

export function stableJitter(seed: number, key: string) {
  const hash = fnv1a32(`${seed}:${key}`);
  return hash / 0xffffffff * 2 - 1;
}

