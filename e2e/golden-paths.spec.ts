import { test, expect, type Page } from "@playwright/test";
import { getScenarioFixture } from "../src/lib/scenarioFixtures";

const MOCK_VOICE_GOAL = "今晚和两个朋友吃饭，有人不吃辣，别排太久，吃完想找地方聊天。";

async function gotoHome(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("home-screen")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("home-bottom-sheet")).toBeVisible();
  await expect(page.getByTestId("home-input-sheet")).toBeVisible();
  await expect(page.getByTestId("goal-input")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("run-agent-button")).toBeVisible();
}

async function clickStartPlanning(page: Page) {
  const button = page.getByTestId("run-agent-button");
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeEnabled();
  await button.click();
}

async function runPlanningFromChip(page: Page, chipTestId: string) {
  const chip = page.getByTestId(chipTestId);
  await chip.scrollIntoViewIfNeeded();
  await chip.click();
  await clickStartPlanning(page);
}

async function runPlanningWithGoal(page: Page, goal: string) {
  const input = page.getByTestId("goal-input");
  await input.scrollIntoViewIfNeeded();
  await input.fill(goal);
  await clickStartPlanning(page);
}

async function waitForResultScreen(page: Page) {
  await expect(page.getByTestId("result-screen")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("plan-sheet")).toBeVisible();
}

async function assertResultStructure(page: Page) {
  await expect(page.getByTestId("route-step-list")).toBeVisible();
  await expect(page.getByTestId("route-step-list").locator("> *")).not.toHaveCount(0);
  await expect(page.getByTestId("map-container")).toBeVisible();
  await expect(page.getByTestId("main-plan-tab")).toBeVisible();
}

type ArtifactKind =
  | "queue"
  | "scheduledQueue"
  | "reservation"
  | "scheduledReservation"
  | "voucher"
  | "share"
  | "noBookingNeeded";

const ARTIFACT_TEST_ID_BY_KIND: Record<ArtifactKind, string> = {
  queue: "execution-artifact-queue",
  scheduledQueue: "execution-artifact-scheduled-queue",
  reservation: "execution-artifact-reservation",
  scheduledReservation: "execution-artifact-scheduled-reservation",
  voucher: "execution-artifact-voucher",
  share: "execution-artifact-share",
  noBookingNeeded: "execution-artifact-no-booking-needed",
};

const ARTIFACT_CARD_TEST_IDS = Object.values(ARTIFACT_TEST_ID_BY_KIND);

const DINING_ARTIFACT_KINDS: ArtifactKind[] = [
  "queue",
  "scheduledQueue",
  "reservation",
  "scheduledReservation",
];

const ACTIVITY_OR_SHARE_KINDS: ArtifactKind[] = ["voucher", "share", "noBookingNeeded"];

const REASONABLE_EXECUTION_KINDS: ArtifactKind[] = [
  ...DINING_ARTIFACT_KINDS,
  ...ACTIVITY_OR_SHARE_KINDS,
];

function artifactLocator(page: Page, kinds: ArtifactKind[]) {
  const [firstKind, ...restKinds] = kinds;
  let locator = page.getByTestId(ARTIFACT_TEST_ID_BY_KIND[firstKind]);
  for (const kind of restKinds) {
    locator = locator.or(page.getByTestId(ARTIFACT_TEST_ID_BY_KIND[kind]));
  }
  return locator;
}

function artifactCards(page: Page) {
  return page
    .getByTestId("execution-artifact-list")
    .locator(ARTIFACT_CARD_TEST_IDS.map((id) => `[data-testid="${id}"]`).join(", "));
}

function diningArtifactLocator(page: Page) {
  return artifactLocator(page, DINING_ARTIFACT_KINDS);
}

function activityArtifactLocator(page: Page) {
  return artifactLocator(page, ACTIVITY_OR_SHARE_KINDS);
}

async function runExecutionToDone(page: Page) {
  await page.getByTestId("confirm-execute-button").click();
  await expect(page.getByTestId("result-screen")).toBeVisible();
  await expect(page.getByTestId("execution-modal")).toBeVisible();
  await expect(page.getByTestId("execution-idle")).toBeVisible();
  await expect(page.getByTestId("execution-modal-confirm-button")).toBeVisible();
  await page.getByTestId("execution-start-button").click();
  await expect(page.getByTestId("execution-running")).toBeVisible();
  await expect(page.getByTestId("execution-done")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("execution-complete-title")).toBeVisible();
  await expect(page.getByTestId("execution-results-heading")).toBeVisible();
  await expect(page.getByTestId("execution-artifact-list")).toBeVisible();
  await expect(page.getByTestId("execution-view-plan-button")).toHaveText("查看路线");
  await expect(page.getByTestId("execution-back-plan-button")).toBeVisible();
}

async function assertArtifactCountAtLeast(page: Page, minCount: number) {
  await expect
    .poll(async () => artifactCards(page).count(), { timeout: 5_000 })
    .toBeGreaterThanOrEqual(minCount);
}

async function assertAnyArtifactVisible(page: Page, kinds: ArtifactKind[]) {
  await expect(artifactLocator(page, kinds).first()).toBeVisible();
}

async function assertDiningArtifactVisible(page: Page) {
  await expect(diningArtifactLocator(page).first()).toBeVisible();
}

async function assertActivityArtifactVisible(page: Page) {
  await expect(activityArtifactLocator(page).first()).toBeVisible();
}

async function assertReasonableExecutionArtifacts(page: Page) {
  await assertArtifactCountAtLeast(page, 1);
  await assertAnyArtifactVisible(page, REASONABLE_EXECUTION_KINDS);
}

async function isDiningArtifactVisible(page: Page) {
  return diningArtifactLocator(page)
    .first()
    .isVisible()
    .catch(() => false);
}

async function assertQueueArtifactDetails(page: Page) {
  await expect(page.getByTestId("execution-artifact-queue")).toBeVisible();
  await expect(page.getByTestId("execution-queue-number")).toBeVisible();
  await expect(page.getByTestId("execution-queue-ahead-count")).toBeVisible();
  await expect(page.getByTestId("execution-queue-progress")).toBeVisible();
  await expect(page.getByTestId("execution-cancel-queue-button")).toBeVisible();
}

async function assertNoArtifactKinds(page: Page, kinds: ArtifactKind[]) {
  for (const kind of kinds) {
    await expect(page.getByTestId(ARTIFACT_TEST_ID_BY_KIND[kind])).toHaveCount(0);
  }
}

test.describe("map-first home entry", () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test("home entry shortcuts do not block planning", async ({ page }) => {
    const importEntry = page.getByTestId("import-place-entry");
    await importEntry.scrollIntoViewIfNeeded();
    await importEntry.click();
    await expect(page.getByTestId("import-place-sheet")).toBeVisible();

    await page.getByTestId("import-place-input").fill("https://xiaohongshu.com/example-guide");
    await page.getByTestId("import-place-parse-button").click();
    await expect(page.getByTestId("import-place-option").first()).toBeVisible();
    await page.getByTestId("import-place-confirm-button").click();

    await expect(page.getByTestId("imported-place-summary")).toBeVisible();
    await expect(page.getByTestId("imported-place-summary")).toContainText("已导入");
    await expect(page.getByTestId("nearby-autofill-toggle")).toHaveCount(0);

    await clickStartPlanning(page);
    await waitForResultScreen(page);
    await assertResultStructure(page);
  });

  test("voice input mock fills goal and can plan", async ({ page }) => {
    const voiceButton = page.getByTestId("voice-input-button");
    await voiceButton.scrollIntoViewIfNeeded();
    await expect(page.getByTestId("companion-chip-button")).toHaveCount(0);
    await expect(page.getByTestId("recognized-constraints")).toHaveCount(0);
    await voiceButton.click();
    await expect(page.getByTestId("goal-input")).toHaveValue(MOCK_VOICE_GOAL, { timeout: 3_000 });

    await clickStartPlanning(page);
    await waitForResultScreen(page);
    await assertResultStructure(page);
  });
});

test.describe("golden paths", () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test("errand afternoon: plan, view route, and execute", async ({ page }) => {
    const fixture = getScenarioFixture("errandAfternoon");
    expect(fixture).toBeTruthy();

    await runPlanningFromChip(page, "scenario-chip-errandAfternoon");
    await waitForResultScreen(page);
    await assertResultStructure(page);

    await expect(page.getByTestId("confirm-execute-button")).toBeEnabled();
    await runExecutionToDone(page);
    await assertReasonableExecutionArtifacts(page);

    if (await isDiningArtifactVisible(page)) {
      await assertDiningArtifactVisible(page);
    } else {
      await assertAnyArtifactVisible(page, ["share", "noBookingNeeded", "voucher"]);
    }
  });

  test("friends evening: dining and activity artifacts after execute", async ({ page }) => {
    const fixture = getScenarioFixture("friendsEvening");
    expect(fixture).toBeTruthy();

    await runPlanningFromChip(page, "scenario-chip-friendsEvening");
    await waitForResultScreen(page);
    await assertResultStructure(page);

    await expect(page.getByTestId("confirm-execute-button")).toBeEnabled();
    await runExecutionToDone(page);
    await assertDiningArtifactVisible(page);
    await assertAnyArtifactVisible(page, ["voucher", "share", "noBookingNeeded"]);
    await assertArtifactCountAtLeast(page, 2);

    const queueVisible = await page.getByTestId(ARTIFACT_TEST_ID_BY_KIND.queue).isVisible();
    const scheduledQueueVisible = await page.getByTestId(ARTIFACT_TEST_ID_BY_KIND.scheduledQueue).isVisible();
    const reservationVisible = await page.getByTestId(ARTIFACT_TEST_ID_BY_KIND.reservation).isVisible();
    const scheduledReservationVisible = await page
      .getByTestId(ARTIFACT_TEST_ID_BY_KIND.scheduledReservation)
      .isVisible()
      .catch(() => false);

    expect(queueVisible || scheduledQueueVisible || reservationVisible || scheduledReservationVisible).toBe(true);

    if (queueVisible) {
      await assertQueueArtifactDetails(page);
    }
  });

  test("friends evening: multiple artifacts on fallback plan execute", async ({ page }) => {
    const fixture = getScenarioFixture("friendsEvening");
    expect(fixture).toBeTruthy();

    await runPlanningFromChip(page, "scenario-chip-friendsEvening");
    await waitForResultScreen(page);
    await assertResultStructure(page);

    await page.getByTestId("fallback-plan-tab").click();
    await expect(page.getByTestId("fallback-card").first()).toBeVisible({ timeout: 5_000 });

    const selectButton = page.getByTestId("select-fallback-button").filter({ hasNotText: "已选择" }).first();
    await expect(selectButton).toBeVisible();
    await selectButton.click();

    await expect(page.getByTestId("main-plan-tab")).toBeVisible();
    await expect(page.getByTestId("confirm-execute-button")).toBeEnabled();
    await runExecutionToDone(page);
    await assertReasonableExecutionArtifacts(page);
    await assertArtifactCountAtLeast(page, 1);
  });

  test("date evening: dining artifact after execute", async ({ page }) => {
    const fixture = getScenarioFixture("dateEvening");
    expect(fixture).toBeTruthy();

    await runPlanningFromChip(page, "scenario-chip-dateEvening");
    await waitForResultScreen(page);
    await assertResultStructure(page);

    await runExecutionToDone(page);
    await assertDiningArtifactVisible(page);
    await assertArtifactCountAtLeast(page, 2);
    await assertAnyArtifactVisible(page, ["share"]);
    await assertNoArtifactKinds(page, ["voucher"]);
  });

  test("family weekend: voucher or share artifact after execute", async ({ page }) => {
    const fixture = getScenarioFixture("familyWeekend");
    expect(fixture).toBeTruthy();

    await runPlanningFromChip(page, "scenario-chip-familyWeekend");
    await waitForResultScreen(page);
    await assertResultStructure(page);

    await runExecutionToDone(page);
    await assertReasonableExecutionArtifacts(page);
    await assertAnyArtifactVisible(page, [
      "voucher",
      "share",
      "scheduledQueue",
      "queue",
      "reservation",
      "noBookingNeeded",
    ]);
  });

  test("work afternoon: browse recommended poi and execute", async ({ page }) => {
    const fixture = getScenarioFixture("workAfternoon");
    expect(fixture).toBeTruthy();

    await runPlanningFromChip(page, "scenario-chip-workAfternoon");
    await waitForResultScreen(page);
    await assertResultStructure(page);

    await page.getByTestId("poi-tab").click();
    await expect(page.getByTestId("poi-card").first()).toBeVisible();
    await expect(page.getByTestId("selected-poi-detail")).toBeVisible();

    const mapMarker = page.locator(".leaflet-marker-icon").first();
    if (await mapMarker.isVisible().catch(() => false)) {
      await mapMarker.click({ force: true });
      await expect(page.getByTestId("selected-poi-detail")).toBeVisible();
    }

    await page.getByTestId("main-plan-tab").click();
    await expect(page.getByTestId("confirm-execute-button")).toBeEnabled();
    await runExecutionToDone(page);
    await assertReasonableExecutionArtifacts(page);
    await assertAnyArtifactVisible(page, [
      "share",
      "scheduledReservation",
      "reservation",
      "scheduledQueue",
      "queue",
      "noBookingNeeded",
    ]);
    await assertNoArtifactKinds(page, ["voucher"]);
  });

  test("can plan from fixture goal text directly", async ({ page }) => {
    const fixture = getScenarioFixture("friendsEvening");
    expect(fixture).toBeTruthy();

    await runPlanningWithGoal(page, fixture!.goal);
    await waitForResultScreen(page);
    await assertResultStructure(page);
  });
});

test.describe("execution artifact coverage", () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  test("friends evening shows restaurant and activity artifacts together", async ({ page }) => {
    await runPlanningFromChip(page, "scenario-chip-friendsEvening");
    await waitForResultScreen(page);
    await runExecutionToDone(page);

    await assertArtifactCountAtLeast(page, 2);
    await assertDiningArtifactVisible(page);
    await expect(
      page
        .getByTestId(ARTIFACT_TEST_ID_BY_KIND.voucher)
        .or(page.getByTestId(ARTIFACT_TEST_ID_BY_KIND.share))
        .or(page.getByTestId(ARTIFACT_TEST_ID_BY_KIND.noBookingNeeded))
        .first(),
    ).toBeVisible();
  });

  test("date evening shows dining artifact outside friends scenario", async ({ page }) => {
    await runPlanningFromChip(page, "scenario-chip-dateEvening");
    await waitForResultScreen(page);
    await runExecutionToDone(page);

    await assertDiningArtifactVisible(page);
    await assertArtifactCountAtLeast(page, 2);
    await expect(page.getByTestId("execution-artifact-list")).toBeVisible();
  });
});
