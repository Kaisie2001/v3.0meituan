import type { ExecutionAction, Intent, ItineraryPlan, RoutePlan, RouteSlot, RouteStep, ScoredPoi } from "./types";

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

function buildRationaleNotes(params: { slotType: RouteSlot["slotType"]; poi?: ScoredPoi; intent: Intent; queueLimit: number }) {
  const notes: string[] = [];
  const poi = params.poi;
  const intent = params.intent;
  const dims = intent.semantic?.dims;
  if (!poi) return notes;

  notes.push(`通勤 ${poi.routeEtaMinutes} 分钟（≤${intent.maxCommuteMinutes ?? 30}）`);
  if (poi.queueMinutes <= params.queueLimit) notes.push("排队可控");
  if (poi.reservationAvailable && poi.category === "restaurant") notes.push("支持订位");
  if (intent.preferLightDinner && (poi.sceneTags.includes("清淡") || poi.sceneTags.includes("轻食"))) notes.push("更符合清淡偏好");
  if (intent.needTags.includes("亲子") && (poi.category === "mall" || poi.sceneTags.includes("亲子"))) notes.push("更适合亲子同行");

  if (dims) {
    if (dims.quietPreference > 0.6 && poi.sceneTags.includes("安静")) notes.push("符合偏安静画像");
    if (dims.indoorPreference > 0.6 && (poi.category === "mall" || poi.sceneTags.includes("室内"))) notes.push("符合偏室内画像");
    if (dims.activityFirst > 0.55 && (params.slotType === "activity" || params.slotType === "extra")) notes.push("符合活动优先画像");
    if (dims.activityFirst <= 0.55 && params.slotType === "food") notes.push("符合吃饭优先画像");
  }

  return notes.slice(0, 4);
}

function buildSlot(params: {
  slotType: RouteSlot["slotType"];
  poi?: ScoredPoi;
  intent: Intent;
  startTime: string;
  durationMinutes: number;
  rationaleNotes?: string[];
  riskNotes?: string[];
}): { slot: RouteSlot; endTime: string } {
  const baseEta = params.poi?.routeEtaMinutes ?? 0;
  const transport = params.intent.routePrefs?.transport ?? "transit";
  const etaMultiplier = transport === "driving" ? 0.82 : transport === "walking" ? 1.6 : 1;
  const etaMinutes = Math.max(0, Math.round(baseEta * etaMultiplier));
  const waitMinutes = params.poi?.queueMinutes ?? 0;
  const endTime = toTime(toMinutes(params.startTime) + etaMinutes + waitMinutes + params.durationMinutes);

  return {
    slot: {
      slotType: params.slotType,
      poi: params.poi,
      startTime: params.startTime,
      endTime,
      etaMinutes,
      waitMinutes,
      rationaleNotes: params.rationaleNotes ?? [],
      riskNotes: params.riskNotes ?? [],
    },
    endTime,
  };
}

function buildStepsFromSlots(slots: RouteSlot[]): RouteStep[] {
  const steps: RouteStep[] = [];
  if (!slots.length) return steps;

  const first = slots[0];
  steps.push({
    time: first.startTime,
    title: "从当前位置出发",
    detail: first.poi ? `前往 ${first.poi.name}，预计通勤 ${first.etaMinutes} 分钟` : "等待推荐点位",
    poiId: first.poi?.id,
  });

  slots.forEach((slot) => {
    const title = slot.slotType === "activity" ? "活动" : slot.slotType === "food" ? "用餐" : "加餐/散步";
    const poiLabel = slot.poi ? `${slot.poi.name}` : "推荐点位";
    const riskText = slot.riskNotes.length ? `（风险：${slot.riskNotes.slice(0, 2).join(" / ")}）` : "";
    steps.push({
      time: `${slot.startTime}-${slot.endTime}`,
      title: `${title}：${poiLabel}`,
      detail: slot.poi
        ? `ETA ${slot.etaMinutes} 分钟，等待 ${slot.waitMinutes} 分钟，人均 ${slot.poi.pricePerPerson} 元${riskText}`
        : `待补充点位${riskText}`,
      poiId: slot.poi?.id,
    });
  });

  return steps;
}

function sumSlots(slots: RouteSlot[]) {
  return slots.reduce(
    (acc, slot) => {
      acc.totalCommuteMinutes += slot.etaMinutes;
      acc.totalWaitMinutes += slot.waitMinutes;
      if (slot.poi) acc.totalBudget += slot.poi.pricePerPerson;
      return acc;
    },
    { totalCommuteMinutes: 0, totalWaitMinutes: 0, totalBudget: 0 },
  );
}

export function planRoute(rankedPois: ScoredPoi[], intent: Intent): RoutePlan {
  const startTime = intent.startTime ?? intent.timeWindow.start;
  const durationMinutes = intent.durationMinutes ?? 300;
  const maxCommuteMinutes = intent.maxCommuteMinutes ?? 30;
  const partySize = intent.partySize ?? 2;
  const dims = intent.semantic?.dims;
  const derivedQueueLimit = Math.round(10 + (dims?.queueTolerance ?? 0.5) * 30);
  const queueLimit = intent.avoidTags.includes("排队长") ? Math.min(15, derivedQueueLimit) : derivedQueueLimit;
  const needKidFriendly = intent.needTags.includes("亲子") || /孩子|儿童|亲子/.test(`${intent.rawGoal} ${intent.wechatConstraint}`);
  const goal = intent.routePrefs?.goal ?? "time";
  const customGoal = intent.routePrefs?.customGoal ?? "";
  const normalizedGoal =
    goal !== "custom"
      ? goal
      : /省钱|便宜|预算|人均|优惠/.test(customGoal)
        ? "cost"
        : /距离|就近|少走|不折返|绕路/.test(customGoal)
          ? "distance"
          : "time";

  const eligible = rankedPois.filter((poi) => poi.openNow && poi.routeEtaMinutes <= maxCommuteMinutes);
  const objectiveScore = (poi: ScoredPoi) => {
    if (normalizedGoal === "distance") return poi.distanceMeters;
    if (normalizedGoal === "cost") return poi.pricePerPerson * 10 + poi.queueMinutes;
    return poi.routeEtaMinutes * 3 + poi.queueMinutes * 2;
  };

  const activityCandidates = eligible
    .filter((poi) => poi.category === "activity" || poi.category === "mall")
    .sort((a, b) => objectiveScore(a) - objectiveScore(b));
  const restaurantCandidates = eligible
    .filter((poi) => poi.category === "restaurant")
    .sort((a, b) => objectiveScore(a) - objectiveScore(b));

  const activity = activityCandidates[0];
  const fallbackActivity = activityCandidates.find((poi) => poi.id !== activity?.id);

  const restaurant = restaurantCandidates.find((poi) => {
    if (partySize >= 4) return poi.reservationAvailable;
    if (poi.queueMinutes > queueLimit) return false;
    if (intent.preferLightDinner) return poi.sceneTags.includes("清淡") || poi.sceneTags.includes("轻食") || poi.name.toLowerCase().includes("green");
    return true;
  }) ?? restaurantCandidates[0];

  const fallbackRestaurant = restaurantCandidates.find((poi) => poi.id !== restaurant?.id);

  const activityRisk: string[] = [];
  if (activity && activity.queueMinutes > queueLimit) activityRisk.push(`排队可能超过 ${queueLimit} 分钟`);
  if (needKidFriendly && activity && activity.category === "activity" && activity.riskTags.includes("不可用")) activityRisk.push("亲子可用性存在风险");

  const restaurantRisk: string[] = [];
  if (restaurant && restaurant.queueMinutes > queueLimit) restaurantRisk.push(`排队可能超过 ${queueLimit} 分钟`);
  if (partySize >= 4 && restaurant && !restaurant.reservationAvailable) restaurantRisk.push("多人位不支持订位");
  if (intent.preferLightDinner && restaurant && !restaurant.sceneTags.includes("清淡") && !restaurant.sceneTags.includes("轻食")) restaurantRisk.push("未发现明显清淡/轻食信号");

  const activityDuration = Math.min(150, Math.max(90, Math.round(durationMinutes * 0.4)));
  const foodDuration = 75;
  const extraDuration = Math.max(0, durationMinutes - activityDuration - foodDuration);

  const slotA = buildSlot({
    slotType: "activity",
    poi: activity,
    intent,
    startTime,
    durationMinutes: activityDuration,
    rationaleNotes: buildRationaleNotes({ slotType: "activity", poi: activity, intent, queueLimit }),
    riskNotes: activityRisk,
  });
  const slotB = buildSlot({
    slotType: "food",
    poi: restaurant,
    intent,
    startTime: slotA.endTime,
    durationMinutes: foodDuration,
    rationaleNotes: buildRationaleNotes({ slotType: "food", poi: restaurant, intent, queueLimit }),
    riskNotes: restaurantRisk,
  });

  const slots: RouteSlot[] = [slotA.slot, slotB.slot];
  if (extraDuration >= 45) {
    const extra = buildSlot({
      slotType: "extra",
      poi: fallbackActivity,
      intent,
      startTime: slotB.endTime,
      durationMinutes: Math.min(90, extraDuration),
      rationaleNotes: buildRationaleNotes({ slotType: "extra", poi: fallbackActivity, intent, queueLimit }),
    });
    slots.push(extra.slot);
  }

  const totals = sumSlots(slots);
  const totalBudget = totals.totalBudget * partySize;
  const totalWaitMinutes = totals.totalWaitMinutes;
  const totalCommuteMinutes = totals.totalCommuteMinutes;

  const fitsTimeWindow = totalWaitMinutes <= queueLimit + 10 && totalCommuteMinutes <= maxCommuteMinutes * slots.length;
  const steps = buildStepsFromSlots(slots);

  const mainPlan: ItineraryPlan = {
    id: "main",
    title: "主方案",
    slots,
    steps,
    totalMinutes: durationMinutes + totalWaitMinutes,
    totalBudget,
    totalWaitMinutes,
    totalCommuteMinutes,
  };

  const fallbackPlans: ItineraryPlan[] = [];
  if (fallbackRestaurant && restaurant && fallbackRestaurant.id !== restaurant.id) {
    const fbB = buildSlot({
      slotType: "food",
      poi: fallbackRestaurant,
      intent,
      startTime: slotA.endTime,
      durationMinutes: foodDuration,
      rationaleNotes: buildRationaleNotes({ slotType: "food", poi: fallbackRestaurant, intent, queueLimit }),
      riskNotes: ["主餐厅不可订/排队过长时切换"],
    });
    const fbSlots: RouteSlot[] = [slotA.slot, fbB.slot];
    if (extraDuration >= 45) {
      const extra = buildSlot({
        slotType: "extra",
        poi: fallbackActivity,
        intent,
        startTime: fbB.endTime,
        durationMinutes: Math.min(90, extraDuration),
        rationaleNotes: buildRationaleNotes({ slotType: "extra", poi: fallbackActivity, intent, queueLimit }),
      });
      fbSlots.push(extra.slot);
    }
    const fbTotals = sumSlots(fbSlots);
    fallbackPlans.push({
      id: "fallback-restaurant",
      title: "备选：替换餐厅",
      trigger: "订位失败 / 排队超阈值 / 超预算 / 不符合饮食偏好",
      diffFromMain: {
        deltaBudget: fbTotals.totalBudget * partySize - mainPlan.totalBudget,
        deltaWaitMinutes: fbTotals.totalWaitMinutes - mainPlan.totalWaitMinutes,
        deltaCommuteMinutes: fbTotals.totalCommuteMinutes - mainPlan.totalCommuteMinutes,
      },
      slots: fbSlots,
      steps: buildStepsFromSlots(fbSlots),
      totalMinutes: durationMinutes + fbTotals.totalWaitMinutes,
      totalBudget: fbTotals.totalBudget * partySize,
      totalWaitMinutes: fbTotals.totalWaitMinutes,
      totalCommuteMinutes: fbTotals.totalCommuteMinutes,
    });
  }

  if (fallbackActivity && activity && fallbackActivity.id !== activity.id) {
    const fbA = buildSlot({
      slotType: "activity",
      poi: fallbackActivity,
      intent,
      startTime,
      durationMinutes: activityDuration,
      rationaleNotes: buildRationaleNotes({ slotType: "activity", poi: fallbackActivity, intent, queueLimit }),
      riskNotes: ["主活动不可用/排队过长时切换"],
    });
    const fbSlots: RouteSlot[] = [fbA.slot, slotB.slot];
    if (extraDuration >= 45) {
      const extra = buildSlot({
        slotType: "extra",
        poi: activity,
        intent,
        startTime: slotB.endTime,
        durationMinutes: Math.min(90, extraDuration),
        rationaleNotes: buildRationaleNotes({ slotType: "extra", poi: activity, intent, queueLimit }),
      });
      fbSlots.push(extra.slot);
    }
    const fbTotals = sumSlots(fbSlots);
    fallbackPlans.push({
      id: "fallback-activity",
      title: "备选：替换活动",
      trigger: "活动关闭 / 排队超阈值 / 不适合人群",
      diffFromMain: {
        deltaBudget: fbTotals.totalBudget * partySize - mainPlan.totalBudget,
        deltaWaitMinutes: fbTotals.totalWaitMinutes - mainPlan.totalWaitMinutes,
        deltaCommuteMinutes: fbTotals.totalCommuteMinutes - mainPlan.totalCommuteMinutes,
      },
      slots: fbSlots,
      steps: buildStepsFromSlots(fbSlots),
      totalMinutes: durationMinutes + fbTotals.totalWaitMinutes,
      totalBudget: fbTotals.totalBudget * partySize,
      totalWaitMinutes: fbTotals.totalWaitMinutes,
      totalCommuteMinutes: fbTotals.totalCommuteMinutes,
    });
  }

  return {
    activity,
    fallbackActivity,
    restaurant,
    fallbackRestaurant,
    totalMinutes: mainPlan.totalMinutes,
    totalBudget: mainPlan.totalBudget,
    totalWaitMinutes: mainPlan.totalWaitMinutes,
    fitsTimeWindow,
    steps: mainPlan.steps,
    mainPlan,
    fallbackPlans,
  };
}

export function generateExecutionActions(routePlan: RoutePlan): ExecutionAction[] {
  return [
    { id: "activity", label: routePlan.activity ? `预约/核销 ${routePlan.activity.name}` : "预约活动" },
    { id: "reserve", label: routePlan.restaurant ? `预订 ${routePlan.restaurant.name}` : "预订餐厅" },
    { id: "order", label: "锁定套餐/券" },
    { id: "share", label: "生成转发文案" },
  ];
}
