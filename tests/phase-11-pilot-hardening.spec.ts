import { expect, test } from "@playwright/test";

const baseUrl = process.env.SENTINEL_BASE_URL ?? "http://localhost:3000";

test("shows authenticated local-pilot readiness without exposing service secrets", async ({ page }) => {
  await page.goto(baseUrl);
  await page.getByLabel("Email").fill("ava.tester@example.test");
  await page.getByLabel("Password").fill("sentinel-dev");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Pilot readiness" })).toBeVisible();
  await expect(page.getByText("Local Docker services and seeded named users only.")).toBeVisible();
  await expect(page.getByText("Sentinel database", { exact: true })).toBeVisible();
  await expect(page.getByText("Background worker", { exact: true })).toBeVisible();
  await expect(page.getByText("Evidence retention", { exact: true })).toBeVisible();
  await expect(page.getByText("Unconfigured by design for the local pilot.")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("postgresql://");
  await expect(page.locator("body")).not.toContainText("sentinel-minio-development-only");
});
