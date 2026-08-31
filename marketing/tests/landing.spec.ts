import { expect, test } from '@playwright/test';

test('presents the product story and defers the walkthrough player', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: 'Know before you ship.',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: /Sanitized Sentinel dashboard/ }),
  ).toBeVisible();
  await expect(page.locator('.video-dialog iframe')).toHaveCount(0);

  await page.getByRole('button', { name: 'Watch the walkthrough' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Sentinel walkthrough',
    }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close walkthrough' }).click();

  await expect(
    page.getByRole('heading', {
      name: 'Replay with boundaries.',
    }),
  ).toBeVisible();
});

test('submits the pilot qualifier and shows an address-safe confirmation', async ({
  page,
}) => {
  await page.route('**/turnstile/v0/api.js*', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `window.turnstile={render:(element,options)=>{element.textContent='Verified for test';setTimeout(()=>options.callback('test-token'),0);return 'test-widget'},remove:()=>{},reset:()=>{}};`,
    });
  });

  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/public/pilot-waitlist', async (route) => {
    const headers = {
      'access-control-allow-origin': 'http://127.0.0.1:4173',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 202,
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ accepted: true }),
    });
  });

  await page.goto('/');
  await page
    .getByRole('heading', { name: /Bring one real journey/ })
    .scrollIntoViewIfNeeded();
  await expect(page.getByText('Verification complete.')).toBeVisible();

  await page.getByLabel('Name').fill('Riley Chen');
  await page.getByLabel('Work email').fill('riley@example.test');
  await page.getByLabel('Company').fill('Northstar Labs');
  await page.getByLabel('QA team size').selectOption('2-5');
  await page.getByRole('button', { name: 'Apply for the pilot' }).click();

  await expect(page.getByText('Application received')).toBeVisible();
  expect(submitted).toMatchObject({
    name: 'Riley Chen',
    email: 'riley@example.test',
    company: 'Northstar Labs',
    qaTeamSize: '2-5',
    companyWebsite: '',
    turnstileToken: 'test-token',
  });
});

test('keeps keyboard, reduced-motion, zoom, and narrow layouts usable', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
  ).toBe(true);

  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);

  await page.goto('/privacy');
  await expect(
    page.getByRole('heading', { name: 'Small form. Clear boundary.' }),
  ).toBeVisible();
});
