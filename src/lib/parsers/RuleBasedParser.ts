import type { IntentParser } from "./IntentParser";
import type { Intent, IntentDraft, MissingField, ParseResult } from "@/lib/types";
import { buildSemanticProfile } from "@/lib/semanticHash";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function normalizeTime(hour: number, minute = 0) {
  return `${pad2(hour)}:${pad2(minute)}`;
}

function inferStartTime(text: string): string | undefined {
  const match = text.match(/(上午|中午|下午|晚上)?\s*(\d{1,2})\s*点\s*(\d{1,2})?\s*分?/);
  if (!match) return undefined;

  const period = match[1] ?? "";
  const hourRaw = Number(match[2]);
  const minute = match[3] ? Number(match[3]) : 0;

  if (!Number.isFinite(hourRaw) || !Number.isFinite(minute)) return undefined;

  let hour = hourRaw;
  if (period === "下午" || period === "晚上") {
    if (hour < 12) hour += 12;
  }
  if (period === "上午") {
    if (hour === 12) hour = 0;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return undefined;
  return normalizeTime(hour, minute);
}

function inferDurationMinutes(text: string): number | undefined {
  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(小时|h)/i);
  if (rangeMatch) {
    const a = Number(rangeMatch[1]);
    const b = Number(rangeMatch[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) {
      return Math.round(((a + b) / 2) * 60);
    }
  }

  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(小时|h)/i);
  if (hourMatch) {
    const hours = Number(hourMatch[1]);
    if (Number.isFinite(hours) && hours > 0) return Math.round(hours * 60);
  }

  const minuteMatch = text.match(/(\d+)\s*(分钟|min)/i);
  if (minuteMatch) {
    const minutes = Number(minuteMatch[1]);
    if (Number.isFinite(minutes) && minutes > 0) return minutes;
  }

  if (/4\s*-\s*6\s*小时/.test(text) || /四\s*-\s*六\s*小时/.test(text)) return 300;

  return undefined;
}

function inferPartySize(text: string): number | undefined {
  const match = text.match(/(\d+)\s*(人|个人|位)/);
  if (match) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  if (/老婆|孩子|家庭|一家/.test(text)) return 3;
  if (/朋友|同学|同事/.test(text)) return 4;

  return undefined;
}

function inferMaxCommuteMinutes(text: string): number | undefined {
  const match = text.match(/(\d+)\s*(分钟|min)\s*(以内|之内|左右)?/i);
  if (match) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  if (/别离家太远|不要太远|附近|别跑太远/.test(text)) return 30;
  return undefined;
}

function inferBudget(text: string): number | undefined {
  const match = text.match(/人均\s*(\d+)/);
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

function buildIntent(draft: IntentDraft, text: string): Intent {
  const semantic = buildSemanticProfile(text);
  const startTime = draft.startTime ?? "14:00";
  const durationMinutes = draft.durationMinutes ?? 300;
  const endHour = Math.min(23, Math.floor((Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5)) + durationMinutes) / 60));
  const endMinute = (Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5)) + durationMinutes) % 60;
  const endTime = normalizeTime(endHour, endMinute);

  const explicitNoSpicy = /不吃辣|不要辣|不太能吃辣|不能吃辣/.test(text);
  const explicitSpicy = !explicitNoSpicy && /麻辣|火锅|重口|辣|川菜|湘菜/.test(text);
  const explicitLight = /清淡|减肥|减脂|轻食|低卡|沙拉|少油/.test(text);

  const preferLightDinner =
    draft.preferLightDinner ??
    (explicitLight ? true : explicitSpicy ? false : (explicitNoSpicy || semantic.dims.budgetLevel < 0.55));
  const preferQuiet =
    draft.preferQuiet ??
    (/安静|不要太吵|不吵|小朋友午睡/.test(text) || semantic.dims.quietPreference > 0.6);
  const preferMetro =
    draft.preferMetro ??
    (/地铁|少走路/.test(text) || semantic.dims.activityFirst < 0.45);

  const needTags = [
    preferLightDinner ? "清淡" : "",
    preferLightDinner ? "轻食" : "",
    explicitSpicy ? "麻辣" : "",
    explicitSpicy ? "火锅" : "",
    explicitSpicy ? "重口" : "",
    explicitSpicy ? "吃辣" : "",
    preferQuiet ? "安静" : "",
    preferMetro ? "地铁近" : "",
    /亲子|孩子|儿童/.test(text) ? "亲子" : "",
    /展览|美术馆|博物馆/.test(text) ? "展览" : "",
    /citywalk|散步|小吃街/.test(text) ? "散步" : "",
    /可订位|订位|预约/.test(text) ? "可订位" : "",
    semantic.dims.indoorPreference > 0.62 ? "室内" : "户外",
    semantic.dims.queueTolerance < 0.35 ? "不排队" : "",
  ].filter(Boolean);

  const avoidTags = [
    /不排队|别排队/.test(text) ? "排队长" : "",
    explicitNoSpicy ? "吃辣" : "",
    /不想吵|不要太吵/.test(text) ? "太吵" : "",
    semantic.dims.quietPreference > 0.7 ? "太吵" : "",
  ].filter(Boolean);

  const derivedBudget =
    draft.budgetPerPerson ??
    Math.round(90 + semantic.dims.budgetLevel * 160);
  const derivedCommute =
    draft.maxCommuteMinutes ??
    Math.round(20 + semantic.dims.activityFirst * 35);
  const derivedPartySize =
    draft.partySize ??
    (semantic.dims.activityFirst > 0.78 ? 4 : semantic.dims.activityFirst < 0.25 ? 2 : 3);

  const categoryMix: Intent["desiredCategories"] = explicitSpicy
    ? ["restaurant", "activity", "mall"]
    : semantic.dims.activityFirst > 0.55
      ? ["activity", "restaurant", "mall"]
      : ["restaurant", "activity", "mall"];

  return {
    rawGoal: draft.rawGoal,
    wechatConstraint: draft.wechatConstraint,
    seedContent: draft.seedContent,
    timeWindow: {
      start: startTime,
      end: endTime,
    },
    startTime,
    durationMinutes,
    partySize: derivedPartySize,
    maxCommuteMinutes: derivedCommute,
    budgetPerPerson: derivedBudget,
    desiredCategories: categoryMix,
    needTags,
    avoidTags,
    preferMetro,
    preferQuiet,
    preferLightDinner,
    seededNames: [],
    semantic,
    routePrefs: {
      transport: "transit",
      goal: explicitSpicy ? "distance" : "time",
    },
  };
}

function computeMissing(draft: IntentDraft): MissingField[] {
  const missing: MissingField[] = [];
  if (!draft.startTime) missing.push("startTime");
  if (!draft.durationMinutes) missing.push("durationMinutes");
  if (!draft.partySize) missing.push("partySize");
  if (!draft.maxCommuteMinutes) missing.push("maxCommuteMinutes");
  return missing;
}

export const ruleBasedParser: IntentParser = {
  parse(rawGoal: string, wechatConstraint: string, seedContent: string): ParseResult {
    const text = `${rawGoal} ${wechatConstraint} ${seedContent}`;
    const draft: IntentDraft = {
      rawGoal,
      wechatConstraint,
      seedContent,
      startTime: inferStartTime(text),
      durationMinutes: inferDurationMinutes(text),
      partySize: inferPartySize(text),
      maxCommuteMinutes: inferMaxCommuteMinutes(text),
      budgetPerPerson: inferBudget(text),
    };

    const missingFields = computeMissing(draft);
    const fieldScore = 1 - missingFields.length / 4;
    const confidence = clamp(0.35 + fieldScore * 0.6, 0, 0.98);

    return {
      intent: buildIntent(draft, text),
      draft,
      missingFields,
      confidence,
      source: "rule",
    };
  },
};
