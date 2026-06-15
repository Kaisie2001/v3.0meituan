import {
  getDateLabel,
  getDurationLabel,
  type TravelSettings,
} from "./preferenceSummary";

function pushUnique(chips: string[], seen: Set<string>, chip: string) {
  const value = chip.trim();
  if (!value || seen.has(value)) return;
  seen.add(value);
  chips.push(value);
}

export function extractRecognizedConstraints(
  goal: string,
  wechat: string,
  travelSettings: TravelSettings,
): string[] {
  const text = `${goal} ${wechat}`;
  const chips: string[] = [];
  const seen = new Set<string>();

  pushUnique(chips, seen, `${getDateLabel(travelSettings.date)} ${travelSettings.startTime}`);
  pushUnique(chips, seen, getDurationLabel(travelSettings.duration));

  const transportShort: Record<TravelSettings["transportMode"], string | null> = {
    transit: "地铁公交",
    walking: "步行优先",
    driving: "打车出行",
    auto: null,
  };
  const priorityShort: Record<TravelSettings["routePriority"], string | null> = {
    queue: "少排队",
    distance: "少走路",
    detour: "少绕路",
    experience: "重体验",
    time: "省时",
    cost: "控预算",
  };

  const transport = transportShort[travelSettings.transportMode];
  if (transport) pushUnique(chips, seen, transport);

  const priority = priorityShort[travelSettings.routePriority];
  if (priority && !/少排队|别排太久|不想排太久/.test(text)) {
    pushUnique(chips, seen, priority);
  }

  if (/两个朋友|2个朋友|两位朋友/.test(text)) {
    pushUnique(chips, seen, "3人");
  } else if (/三个朋友|3个朋友/.test(text)) {
    pushUnique(chips, seen, "4人");
  } else if (/四个朋友|4个朋友/.test(text)) {
    pushUnique(chips, seen, "5人");
  } else {
    pushUnique(chips, seen, `${travelSettings.partySize}人`);
  }

  if (/人均\d+/.test(text)) {
    const budgetMatch = text.match(/人均\s*(\d+)\s*以内/);
    if (budgetMatch) pushUnique(chips, seen, `人均${budgetMatch[1]}以内`);
  } else if (travelSettings.budget > 0) {
    pushUnique(chips, seen, `人均${travelSettings.budget}以内`);
  }

  if (/不吃辣|不辣|勿辣|不吃辛辣/.test(text)) pushUnique(chips, seen, "不吃辣");
  if (/少排队|别排太久|不想排太久|不想排队/.test(text)) pushUnique(chips, seen, "少排队");
  if (/饭后聊天|找地方聊天|聊聊天|续摊/.test(text)) pushUnique(chips, seen, "饭后聊天");
  if (/亲子|带孩子|儿童/.test(text)) pushUnique(chips, seen, "亲子友好");
  if (/地铁方便|地铁/.test(text)) pushUnique(chips, seen, "地铁方便");
  if (/安静/.test(text)) pushUnique(chips, seen, "安静");
  if (/插座|久坐|办公/.test(text)) pushUnique(chips, seen, "可久坐");
  if (/别太远|不要太远/.test(text)) pushUnique(chips, seen, "距离适中");

  return chips;
}
