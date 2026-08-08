import { expect, test } from "@playwright/test";
import { launchBrowser } from "../lib/browser";

test("locks the live browser to the approved Demo CRM target", async () => {
  const driver = await launchBrowser("http://demo-target", "browser-lock-test");

  try {
    await expect.poll(async () => driver.executeScript("return Boolean(document.querySelector('#sign-in-form'))")).toBe(true);
    await driver.get("http://sentinel:3000");
    await expect.poll(async () => String(await driver.executeScript("return document.body.innerText"))).toMatch(/blocked|not allowed/i);
  } finally {
    await driver.quit();
  }
});
