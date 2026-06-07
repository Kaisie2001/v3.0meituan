import type { Poi, ScoredPoi } from "@/lib/types";
import { mockPois } from "@/lib/mockPois";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createReceiptId(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

export async function searchPois(params: { categories: string[]; openNowOnly: boolean }): Promise<Poi[]> {
  await sleep(120);
  const set = new Set(params.categories);
  return mockPois.filter((poi) => set.has(poi.category) && (!params.openNowOnly || poi.openNow));
}

export async function estimateCommuteMinutes(params: { poiId: string }): Promise<{ commuteMinutes: number }> {
  await sleep(80);
  const poi = mockPois.find((item) => item.id === params.poiId);
  if (!poi) throw new Error("POI_NOT_FOUND");
  return { commuteMinutes: poi.routeEtaMinutes };
}

export async function checkOpenStatus(params: { poiId: string }): Promise<{ openNow: boolean }> {
  await sleep(60);
  const poi = mockPois.find((item) => item.id === params.poiId);
  if (!poi) throw new Error("POI_NOT_FOUND");
  return { openNow: poi.openNow };
}

export async function estimateQueueMinutes(params: { poiId: string }): Promise<{ queueMinutes: number }> {
  await sleep(80);
  const poi = mockPois.find((item) => item.id === params.poiId);
  if (!poi) throw new Error("POI_NOT_FOUND");
  return { queueMinutes: poi.queueMinutes };
}

export async function checkReservationAvailability(params: { poiId: string; partySize: number; time: string }): Promise<{ reservable: boolean }> {
  await sleep(110);
  const poi = mockPois.find((item) => item.id === params.poiId);
  if (!poi) throw new Error("POI_NOT_FOUND");
  if (poi.category !== "restaurant") return { reservable: false };
  if (params.partySize >= 4 && poi.crowdLevel === "high") return { reservable: false };
  return { reservable: poi.reservationAvailable };
}

export async function checkDietFriendly(params: { poiId: string; preferLight: boolean }): Promise<{ dietFriendly: boolean; reason: string }> {
  await sleep(70);
  const poi = mockPois.find((item) => item.id === params.poiId);
  if (!poi) throw new Error("POI_NOT_FOUND");
  if (!params.preferLight) return { dietFriendly: true, reason: "无清淡约束" };
  const ok = poi.sceneTags.includes("清淡") || poi.sceneTags.includes("轻食") || poi.name.toLowerCase().includes("green");
  return { dietFriendly: ok, reason: ok ? "包含清淡/轻食信号" : "未发现清淡/轻食信号" };
}

export async function checkKidFriendly(params: { poiId: string; kidAges?: number[] }): Promise<{ kidFriendly: boolean; reason: string }> {
  await sleep(70);
  const poi = mockPois.find((item) => item.id === params.poiId);
  if (!poi) throw new Error("POI_NOT_FOUND");
  const ok = poi.category === "mall" || poi.sceneTags.includes("亲子") || poi.name.includes("书店");
  return { kidFriendly: ok, reason: ok ? "更适合亲子/儿童同行" : "未发现亲子友好信号" };
}

export async function bookTickets(params: { poi: ScoredPoi; partySize: number; time: string }): Promise<{ ticketId: string }> {
  await sleep(160);
  if (!params.poi.openNow) throw new Error("ACTIVITY_CLOSED");
  return { ticketId: createReceiptId("ticket") };
}

export async function generateShareText(params: {
  startTime: string;
  durationMinutes: number;
  maxCommuteMinutes: number;
  partySize: number;
  activityName?: string;
  restaurantName?: string;
  fallbackHint?: string;
  profileHint?: string;
}): Promise<{ shareText: string }> {
  await sleep(60);
  const parts = [
    `搞定了！${params.startTime} 出发，计划玩 ${Math.round(params.durationMinutes / 60)} 小时左右。`,
    params.activityName ? `先去 ${params.activityName}。` : "先去一个就近活动点。",
    params.restaurantName ? `然后去 ${params.restaurantName} 吃饭。` : "然后安排一顿就近用餐。",
    `通勤尽量控制在 ${params.maxCommuteMinutes} 分钟内，人数 ${params.partySize}。`,
    params.profileHint ? `偏好：${params.profileHint}` : "",
    params.fallbackHint ? `备选：${params.fallbackHint}` : "",
  ].filter(Boolean);
  return { shareText: parts.join("") };
}

export async function reserveTable(params: { poi: ScoredPoi; partySize: number; time: string }): Promise<{ reservationId: string }> {
  await sleep(180);
  if (params.poi.category !== "restaurant") throw new Error("NOT_RESTAURANT");
  if (!params.poi.reservationAvailable) throw new Error("RESERVATION_UNAVAILABLE");
  if (params.partySize >= 4 && params.poi.crowdLevel === "high") throw new Error("PARTY_TOO_LARGE");
  return { reservationId: createReceiptId("rsv") };
}

export async function bookActivity(params: { poi: ScoredPoi; time: string }): Promise<{ receiptId: string }> {
  await sleep(150);
  if (!params.poi.openNow) throw new Error("ACTIVITY_CLOSED");
  return { receiptId: createReceiptId("activity") };
}

export async function placeOrder(params: { poi: ScoredPoi; item: string }): Promise<{ orderId: string }> {
  await sleep(140);
  if (!params.poi.dealAvailable) throw new Error("DEAL_UNAVAILABLE");
  return { orderId: createReceiptId("order") };
}

export async function sendMessage(params: { to: string; content: string }): Promise<{ messageId: string }> {
  await sleep(90);
  return { messageId: createReceiptId("msg") };
}
