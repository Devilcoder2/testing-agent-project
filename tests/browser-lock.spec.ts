import { expect, test } from "@playwright/test";
import { Builder } from "selenium-webdriver";
import { closeBrowser, launchBrowser } from "../lib/browser";

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

test("reclaims an untracked Selenium session before launching the live browser", async () => {
  await closeBrowser();
  const staleDriver = await new Builder()
    .usingServer(process.env.BROWSER_SELENIUM_URL ?? "http://browser:4444/wd/hub")
    .withCapabilities({ browserName: "chrome" })
    .build();

  try {
    const recoveredDriver = await launchBrowser("http://demo-target", "browser-session-recovery-test");
    await expect.poll(async () => recoveredDriver.executeScript("return Boolean(document.querySelector('#sign-in-form'))")).toBe(true);
  } finally {
    await closeBrowser();
    await staleDriver.quit().catch(() => undefined);
  }
});
