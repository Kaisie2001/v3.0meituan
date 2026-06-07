import type { Intent, IntentDraft, MissingField, ParseResult } from "@/lib/types";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toMinutes(time: string) {
  const [h, m] = time.split(":").map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function toTime(minutes: number) {
  const value = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(value / 60))}:${pad2(value % 60)}`;
}

function computeMissing(draft: IntentDraft): MissingField[] {
  const missing: MissingField[] = [];
  if (!draft.startTime) missing.push("startTime");
  if (!draft.durationMinutes) missing.push("durationMinutes");
  if (!draft.partySize) missing.push("partySize");
  if (!draft.maxCommuteMinutes) missing.push("maxCommuteMinutes");
  return missing;
}

function applyToIntent(intent: Intent, patch: Partial<IntentDraft>): Intent {
  const next: Intent = {
    ...intent,
    startTime: patch.startTime ?? intent.startTime,
    durationMinutes: patch.durationMinutes ?? intent.durationMinutes,
    partySize: patch.partySize ?? intent.partySize,
    maxCommuteMinutes: patch.maxCommuteMinutes ?? intent.maxCommuteMinutes,
    budgetPerPerson: patch.budgetPerPerson ?? intent.budgetPerPerson,
  };

  const start = next.startTime ?? next.timeWindow.start;
  const duration = next.durationMinutes ?? 300;
  const end = toTime(toMinutes(start) + duration);
  next.timeWindow = { ...next.timeWindow, start, end };
  return next;
}

export function applyParseOverrides(parseResult: ParseResult, patch: Partial<IntentDraft>): ParseResult {
  const draft = { ...parseResult.draft, ...patch };
  const missingFields = computeMissing(draft);
  const intent = applyToIntent(parseResult.intent, patch);

  return {
    ...parseResult,
    draft,
    missingFields,
    intent,
    confidence: Math.max(parseResult.confidence, 0.7),
  };
}

