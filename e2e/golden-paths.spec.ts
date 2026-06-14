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

async function completeExecutionFlow(page: Page) {
  await page.getByTestId("confirm-execute-button").click();
  await expect(page.getByTestId("execution-screen")).toBeVisible();
  await page.getByTestId("execution-start-button").click();
  await expect(page.getByTestId("execution-done")).toBeVisible({ timeout: 15_000 });
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
    await completeExecutionFlow(page);
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
    await completeExecutionFlow(page);
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
    await completeExecutionFlow(page);
  });

  test("can plan from fixture goal text directly", async ({ page }) => {
    const fixture = getScenarioFixture("friendsEvening");
    expect(fixture).toBeTruthy();

    await runPlanningWithGoal(page, fixture!.goal);
    await waitForResultScreen(page);
    await assertResultStructure(page);
  });
});
