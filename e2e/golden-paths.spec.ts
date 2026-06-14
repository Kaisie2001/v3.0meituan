import { test, expect, type Page } from "@playwright/test";
import { getScenarioFixture } from "../src/lib/scenarioFixtures";

async function gotoHome(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("goal-input")).toBeVisible();
}

async function runPlanningFromChip(page: Page, chipTestId: string) {
  await page.getByTestId(chipTestId).click();
  await page.getByTestId("run-agent-button").click();
}

async function runPlanningWithGoal(page: Page, goal: string) {
  await page.getByTestId("goal-input").fill(goal);
  await page.getByTestId("run-agent-button").click();
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

type ArtifactKind = "queue" | "reservation" | "voucher" | "share";

const ARTIFACT_CARD_TEST_IDS = [
  "execution-artifact-queue",
  "execution-artifact-reservation",
  "execution-artifact-voucher",
  "execution-artifact-share",
] as const;

function artifactCards(page: Page) {
  return page
    .getByTestId("execution-artifact-list")
    .locator(ARTIFACT_CARD_TEST_IDS.map((id) => `[data-testid="${id}"]`).join(", "));
}

function artifactLocator(page: Page, kinds: ArtifactKind[]) {
  return kinds.reduce(
    (locator, kind, index) =>
      index === 0 ? page.getByTestId(`execution-artifact-${kind}`) : locator.or(page.getByTestId(`execution-artifact-${kind}`)),
    page.getByTestId(`execution-artifact-${kinds[0]}`),
  );
}

function diningArtifactLocator(page: Page) {
  return artifactLocator(page, ["queue", "reservation"]);
}

function activityArtifactLocator(page: Page) {
  return artifactLocator(page, ["voucher", "share"]);
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

async function assertQueueArtifactDetails(page: Page) {
  await expect(page.getByTestId("execution-artifact-queue")).toBeVisible();
  await expect(page.getByTestId("execution-queue-number")).toBeVisible();
  await expect(page.getByTestId("execution-queue-ahead-count")).toBeVisible();
  await expect(page.getByTestId("execution-queue-progress")).toBeVisible();
  await expect(page.getByTestId("execution-cancel-queue-button")).toBeVisible();
}

async function assertNoArtifactKinds(page: Page, kinds: ArtifactKind[]) {
  for (const kind of kinds) {
    await expect(page.getByTestId(`execution-artifact-${kind}`)).toHaveCount(0);
  }
}

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
    await assertDiningArtifactVisible(page);
    await assertArtifactCountAtLeast(page, 2);
    await assertAnyArtifactVisible(page, ["share"]);
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
    await assertAnyArtifactVisible(page, ["voucher", "share"]);
    await assertArtifactCountAtLeast(page, 2);

    const queueVisible = await page.getByTestId("execution-artifact-queue").isVisible();
    const reservationVisible = await page.getByTestId("execution-artifact-reservation").isVisible();
    expect(queueVisible || reservationVisible).toBe(true);

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
    await assertDiningArtifactVisible(page);
    await assertArtifactCountAtLeast(page, 2);
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
    await assertActivityArtifactVisible(page);
    await assertNoArtifactKinds(page, ["queue", "reservation"]);
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
    await assertDiningArtifactVisible(page);
    await assertArtifactCountAtLeast(page, 2);
    await assertAnyArtifactVisible(page, ["share"]);
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

    await assertArtifactCountAtLeast(page, 3);
    await expect(page.getByTestId("execution-artifact-queue").or(page.getByTestId("execution-artifact-reservation")).first()).toBeVisible();
    await expect(page.getByTestId("execution-artifact-voucher").or(page.getByTestId("execution-artifact-share")).first()).toBeVisible();
    await expect(page.getByTestId("execution-artifact-share")).toBeVisible();
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
