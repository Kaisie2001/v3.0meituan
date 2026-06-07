import type { ExecutionTraceStep, Intent, RoutePlan, ScoredPoi } from "@/lib/types";
import {
  bookActivity,
  bookTickets,
  checkDietFriendly,
  checkKidFriendly,
  checkOpenStatus,
  checkReservationAvailability,
  estimateCommuteMinutes,
  estimateQueueMinutes,
  generateShareText,
  placeOrder,
  reserveTable,
  sendMessage,
} from "@/lib/tools/mockTools";

function createStepId(prefix: string, index: number) {
  return `${prefix}-${String(index + 1).padStart(2, "0")}`;
}

async function callTool<T>(
  trace: ExecutionTraceStep[],
  phase: ExecutionTraceStep["phase"],
  toolName: string,
  request: unknown,
  runner: () => Promise<T>,
  index: number,
  summary?: string,
): Promise<T | undefined> {
  const step: ExecutionTraceStep = {
    stepId: createStepId("tool", index),
    phase,
    toolName,
    request,
    summary,
    status: "success",
    retryCount: 0,
  };

  try {
    const response = await runner();
    step.response = response;
    trace.push(step);
    return response;
  } catch (error) {
    step.status = "failed";
    step.error = {
      code: error instanceof Error ? error.message : "UNKNOWN",
      message: error instanceof Error ? error.message : "unknown error",
    };
    trace.push(step);
    return undefined;
  }
}

function pickActivity(routePlan: RoutePlan): ScoredPoi | undefined {
  return routePlan.activity ?? routePlan.fallbackActivity;
}

function pickRestaurant(routePlan: RoutePlan): ScoredPoi | undefined {
  return routePlan.restaurant ?? routePlan.fallbackRestaurant;
}

export async function executePlan(params: { routePlan: RoutePlan; intent: Intent; shareTo?: string }): Promise<ExecutionTraceStep[]> {
  const trace: ExecutionTraceStep[] = [];
  const activity = pickActivity(params.routePlan);
  let restaurant = pickRestaurant(params.routePlan);
  const dims = params.intent.semantic?.dims;
  const profileHint = dims
    ? [
        dims.quietPreference > 0.6 ? "偏安静" : "偏热闹",
        dims.indoorPreference > 0.6 ? "偏室内" : "偏户外",
        dims.activityFirst > 0.55 ? "活动优先" : "吃饭优先",
      ].join(" / ")
    : "";

  let index = 0;

  if (activity) {
    await callTool(trace, "check", "CheckOpenStatus", { poiId: activity.id }, () => checkOpenStatus({ poiId: activity.id }), index);
    index += 1;
    await callTool(trace, "check", "EstimateCommuteMinutes", { poiId: activity.id }, () => estimateCommuteMinutes({ poiId: activity.id }), index);
    index += 1;
    await callTool(trace, "check", "EstimateQueueMinutes", { poiId: activity.id }, () => estimateQueueMinutes({ poiId: activity.id }), index);
    index += 1;

    if (params.intent.needTags.includes("亲子") || /孩子|儿童|亲子/.test(`${params.intent.rawGoal} ${params.intent.wechatConstraint}`)) {
      await callTool(trace, "check", "CheckKidFriendly", { poiId: activity.id }, () => checkKidFriendly({ poiId: activity.id }), index);
      index += 1;
    }

    await callTool(
      trace,
      "execute",
      "BookActivity",
      { poiId: activity.id, time: params.intent.timeWindow.start },
      () => bookActivity({ poi: activity, time: params.intent.timeWindow.start }),
      index,
    );
    index += 1;

    await callTool(
      trace,
      "execute",
      "BookTickets",
      { poiId: activity.id, partySize: params.intent.partySize, time: params.intent.timeWindow.start },
      () => bookTickets({ poi: activity, partySize: params.intent.partySize ?? 2, time: params.intent.timeWindow.start }),
      index,
    );
    index += 1;
  } else {
    trace.push({
      stepId: createStepId("tool", index),
      phase: "execute",
      toolName: "BookActivity",
      request: { skipped: true },
      status: "skipped",
      retryCount: 0,
    });
    index += 1;
  }

  if (restaurant) {
    const restaurantId = restaurant.id;
    await callTool(trace, "check", "CheckOpenStatus", { poiId: restaurantId }, () => checkOpenStatus({ poiId: restaurantId }), index);
    index += 1;
    await callTool(
      trace,
      "check",
      "EstimateCommuteMinutes",
      { poiId: restaurantId },
      () => estimateCommuteMinutes({ poiId: restaurantId }),
      index,
    );
    index += 1;
    await callTool(trace, "check", "EstimateQueueMinutes", { poiId: restaurantId }, () => estimateQueueMinutes({ poiId: restaurantId }), index);
    index += 1;

    const dietCheck = await callTool(
      trace,
      "check",
      "CheckDietFriendly",
      { poiId: restaurantId, preferLight: params.intent.preferLightDinner },
      () => checkDietFriendly({ poiId: restaurantId, preferLight: params.intent.preferLightDinner }),
      index,
    );
    index += 1;

    if (dietCheck && params.intent.preferLightDinner && !dietCheck.dietFriendly && params.routePlan.fallbackRestaurant) {
      trace.push({
        stepId: createStepId("tool", index),
        phase: "plan",
        toolName: "Decision",
        request: { reason: "饮食偏好不匹配，切换备选餐厅", from: restaurant.id, to: params.routePlan.fallbackRestaurant.id },
        response: { selectedRestaurantId: params.routePlan.fallbackRestaurant.id },
        summary: "饮食偏好不匹配，启用备选餐厅",
        status: "success",
        retryCount: 0,
      });
      index += 1;
      restaurant = params.routePlan.fallbackRestaurant;
    }

    const selectedRestaurant = restaurant;
    const selectedRestaurantId = selectedRestaurant.id;

    await callTool(
      trace,
      "check",
      "CheckReservationAvailability",
      { poiId: selectedRestaurantId, partySize: params.intent.partySize, time: "18:00" },
      () => checkReservationAvailability({ poiId: selectedRestaurantId, partySize: params.intent.partySize ?? 2, time: "18:00" }),
      index,
    );
    index += 1;

    const reservation = await callTool(
      trace,
      "execute",
      "ReserveTable",
      { poiId: selectedRestaurantId, partySize: params.intent.partySize, time: "18:00" },
      () => reserveTable({ poi: selectedRestaurant, partySize: params.intent.partySize ?? 2, time: "18:00" }),
      index,
    );
    index += 1;

    if (!reservation && params.routePlan.fallbackRestaurant && params.routePlan.fallbackRestaurant.id !== selectedRestaurantId) {
      await callTool(
        trace,
        "execute",
        "ReserveTable",
        { poiId: params.routePlan.fallbackRestaurant.id, partySize: params.intent.partySize, time: "18:00", fallback: true },
        () => reserveTable({ poi: params.routePlan.fallbackRestaurant as ScoredPoi, partySize: params.intent.partySize ?? 2, time: "18:00" }),
        index,
      );
      index += 1;
    }

    await callTool(
      trace,
      "execute",
      "PlaceOrder",
      { poiId: selectedRestaurantId, item: "到店套餐/代金券" },
      () => placeOrder({ poi: selectedRestaurant, item: "到店套餐/代金券" }),
      index,
    );
    index += 1;
  } else {
    trace.push({
      stepId: createStepId("tool", index),
      phase: "execute",
      toolName: "ReserveTable",
      request: { skipped: true },
      status: "skipped",
      retryCount: 0,
    });
    index += 1;
  }

  const share = await callTool(
    trace,
    "share",
    "GenerateShareText",
    { startTime: params.intent.timeWindow.start, partySize: params.intent.partySize, maxCommuteMinutes: params.intent.maxCommuteMinutes },
    () =>
      generateShareText({
        startTime: params.intent.timeWindow.start,
        durationMinutes: params.intent.durationMinutes ?? 300,
        maxCommuteMinutes: params.intent.maxCommuteMinutes ?? 30,
        partySize: params.intent.partySize ?? 2,
        activityName: activity?.name,
        restaurantName: restaurant?.name,
        fallbackHint: params.routePlan.fallbackPlans?.[0]?.title,
        profileHint,
      }),
    index,
  );
  index += 1;

  if (params.shareTo) {
    await callTool(
      trace,
      "share",
      "SendMessage",
      { to: params.shareTo },
      () => sendMessage({ to: params.shareTo as string, content: share?.shareText ?? "已生成计划" }),
      index,
    );
  } else {
    trace.push({
      stepId: createStepId("tool", index),
      phase: "share",
      toolName: "SendMessage",
      request: { skipped: true },
      status: "skipped",
      retryCount: 0,
    });
  }

  return trace;
}
