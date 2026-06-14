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

function artifactLocator(page: Page, kinds: ArtifactKind[]) {
  return kinds.reduce(
    (locator, kind, index) =>
      index === 0 ? page.getByTestId(`execution-artifact-${kind}`) : locator.or(page.getByTestId(`execution-artifact-${kind}`)),
    page.getByTestId(`execution-artifact-${kinds[0]}`),
  );
}

async function completeExecutionFlow(
  page: Page,
  options?: {
    expectQueueArtifact?: boolean;
    expectRestaurantArtifact?: boolean;
    expectArtifactKinds?: ArtifactKind[];
    expectTitles?: string[];
  },
) {
  await page.getByTestId("confirm-execute-button").click();
  await expect(page.getByTestId("result-screen")).toBeVisible();
  await expect(page.getByTestId("execution-modal")).toBeVisible();
  await expect(page.getByTestId("execution-idle")).toBeVisible();
  await expect(page.getByTestId("execution-modal-confirm-button")).toBeVisible();
  await page.getByTestId("execution-start-button").click();
  await expect(page.getByTestId("execution-running")).toBeVisible();
  await expect(page.getByTestId("execution-done")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("execution-complete-title")).toBeVisible();

  const kinds = options?.expectArtifactKinds ?? ["queue", "reservation", "share", "voucher"];
  await expect(page.getByTestId("execution-artifact-list")).toBeVisible();
  await expect(artifactLocator(page, kinds).first()).toBeVisible();

  if (options?.expectTitles?.length) {
    let titleLoc = page.getByText(options.expectTitles[0], { exact: true });
    for (let i = 1; i < options.expectTitles.length; i += 1) {
      titleLoc = titleLoc.or(page.getByText(options.expectTitles[i], { exact: true }));
    }
    await expect(titleLoc.first()).toBeVisible();
  }

  if (options?.expectQueueArtifact) {
    await expect(page.getByTestId("execution-artifact-queue")).toBeVisible();
    await expect(page.getByText("排队详情")).toBeVisible();
    await expect(page.getByTestId("execution-queue-number")).toBeVisible();
    await expect(page.getByTestId("execution-queue-ahead-count")).toBeVisible();
    await expect(page.getByTestId("execution-queue-progress")).toBeVisible();
    await expect(page.getByTestId("execution-artifact-queue")).not.toContainText("已模拟预约");
    await expect(page.getByTestId("execution-cancel-queue-button")).toBeVisible();
  }

  if (options?.expectRestaurantArtifact) {
    await expect(page.getByTestId("execution-artifact-voucher")).toHaveCount(0);
    const queueCard = page.getByTestId("execution-artifact-queue");
    const reservationCard = page.getByTestId("execution-artifact-reservation");
    await expect(queueCard.or(reservationCard).first()).toBeVisible();
  }

  await expect(page.getByTestId("execution-view-plan-button")).not.toHaveText("查看核销码");
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
    await completeExecutionFlow(page, { expectRestaurantArtifact: true });
  });

  test("friends evening: queue details after execute", async ({ page }) => {
    const fixture = getScenarioFixture("friendsEvening");
    expect(fixture).toBeTruthy();

    await runPlanningFromChip(page, "scenario-chip-friendsEvening");
    await waitForResultScreen(page);
    await assertResultStructure(page);

    await expect(page.getByTestId("confirm-execute-button")).toBeEnabled();
    await completeExecutionFlow(page, { expectQueueArtifact: true });
  });

  test("friends evening: select fallback plan and execute", async ({ page }) => {
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
    await expect(page.getByTestId("route-step-list")).toBeVisible();
    await expect(page.getByTestId("confirm-execute-button")).toBeEnabled();
    await completeExecutionFlow(page, { expectQueueArtifact: true });
  });

  test("date evening: reservation artifact after execute", async ({ page }) => {
    const fixture = getScenarioFixture("dateEvening");
    expect(fixture).toBeTruthy();

    await runPlanningFromChip(page, "scenario-chip-dateEvening");
    await waitForResultScreen(page);
    await assertResultStructure(page);

    await completeExecutionFlow(page, {
      expectArtifactKinds: ["queue", "reservation"],
      expectTitles: ["排队详情", "已模拟预约"],
    });
    await expect(page.getByTestId("execution-artifact-voucher")).toHaveCount(0);
  });

  test("family weekend: share or voucher artifact after execute", async ({ page }) => {
    const fixture = getScenarioFixture("familyWeekend");
    expect(fixture).toBeTruthy();

    await runPlanningFromChip(page, "scenario-chip-familyWeekend");
    await waitForResultScreen(page);
    await assertResultStructure(page);

    await completeExecutionFlow(page, {
      expectArtifactKinds: ["share", "voucher"],
      expectTitles: ["已生成可分享计划", "已生成核销码"],
    });
    await expect(page.getByTestId("execution-artifact-reservation")).toHaveCount(0);
    await expect(page.getByTestId("execution-artifact-queue")).toHaveCount(0);
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
    await completeExecutionFlow(page, {
      expectArtifactKinds: ["reservation", "share"],
      expectTitles: ["已模拟预约", "已生成可分享计划"],
    });
    await expect(page.getByTestId("execution-artifact-voucher")).toHaveCount(0);
  });

  test("can plan from fixture goal text directly", async ({ page }) => {
    const fixture = getScenarioFixture("friendsEvening");
    expect(fixture).toBeTruthy();

    await runPlanningWithGoal(page, fixture!.goal);
    await waitForResultScreen(page);
    await assertResultStructure(page);
  });
});
