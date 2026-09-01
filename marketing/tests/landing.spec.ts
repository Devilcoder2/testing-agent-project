import { expect, test } from '@playwright/test';

test('offers a navigation-only sample workspace and defers the walkthrough player', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: 'Know before you ship.',
    }),
  ).toBeVisible();
  const preview = page.getByRole('region', {
    name: 'Interactive Sentinel product preview',
  });
  await expect(preview.getByText('Interactive preview')).toBeVisible();
  await expect(preview.getByText('Sample data')).toBeVisible();
  await expect(preview.getByText('Read only')).toBeVisible();
  await preview.getByRole('button', { name: 'Runs' }).click();
  await expect(preview.getByRole('heading', { name: 'Checkout regression' })).toBeVisible();
  await expect(preview.getByText('Step 3 evidence')).toBeVisible();
  await preview.getByRole('button', { name: 'Releases' }).click();
  await expect(preview.getByRole('heading', { name: 'September release' })).toBeVisible();
  await expect(preview.getByRole('button', { name: /^(create|new recording|start run|approve)$/i })).toHaveCount(0);
  await expect(page.locator('.video-dialog iframe')).toHaveCount(0);

  await page
    .getByRole('button', { name: 'Watch the walkthrough', exact: true })
    .or(page.getByRole('button', { name: 'Read the walkthrough', exact: true }))
    .first()
    .click();
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
  await expect(page.getByText('no launch-date or access promise')).toHaveCount(0);
});

test('explores features through a horizontal rail and focus-safe dialog', async ({
  page,
}, testInfo) => {
  await page.goto('/');

  const headingBox = await page.locator('.feature-heading').boundingBox();
  const firstCardBox = await page
    .getByRole('button', { name: 'Learn more about Recording' })
    .boundingBox();
  expect(headingBox && firstCardBox).toBeTruthy();
  expect(Math.abs((headingBox?.x ?? 0) - (firstCardBox?.x ?? 0))).toBeLessThan(2);

  const next = page.getByRole('button', { name: 'Next features' });
  await expect(next).toBeEnabled();
  await next.click();
  const featureTrigger = page.getByRole('button', { name: 'Learn more about Evidence timeline' });
  if (!testInfo.project.name.startsWith('mobile')) {
    await featureTrigger.hover();
    const borderWidth = await featureTrigger.evaluate(
      (element) => getComputedStyle(element).borderTopWidth,
    );
    expect(borderWidth).toBe('1px');
    const cardBox = await featureTrigger.boundingBox();
    const railBox = await page.locator('.feature-rail').boundingBox();
    expect(cardBox && railBox && cardBox.y >= railBox.y).toBe(true);
  }
  await featureTrigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Evidence timeline' })).toBeVisible();
  await expect(dialog.getByText('Step-linked screenshots')).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(dialogBox && viewport).toBeTruthy();
  expect(Math.abs((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0) / 2 - (viewport?.width ?? 0) / 2)).toBeLessThan(3);
  expect(Math.abs((dialogBox?.y ?? 0) + (dialogBox?.height ?? 0) / 2 - (viewport?.height ?? 0) / 2)).toBeLessThan(3);
  await page.getByRole('button', { name: 'Close feature detail' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(featureTrigger).toBeFocused();
});

test('centers the wordmark and reveals below-fold content as it enters view', async ({
  page,
}) => {
  await page.goto('/');

  const header = page.getByRole('banner');
  await expect(header.locator('.sentinel-logo-word')).toHaveCount(0);
  const headerName = header.getByRole('link', { name: 'Sentinel', exact: true });
  await expect(headerName).toBeVisible();
  const nameBox = await headerName.boundingBox();
  const viewport = page.viewportSize();
  expect(nameBox && viewport).toBeTruthy();
  expect(Math.abs((nameBox?.x ?? 0) + (nameBox?.width ?? 0) / 2 - (viewport?.width ?? 0) / 2)).toBeLessThan(3);
  await expect
    .poll(() => headerName.evaluate((element) => getComputedStyle(element).fontFamily))
    .toContain('Geist');

  const reveal = page.locator('.quiet-statement .scroll-reveal');
  await expect.poll(() => reveal.evaluate((element) => getComputedStyle(element).opacity)).toBe('0');
  await reveal.evaluate((element) => {
    document.documentElement.style.scrollBehavior = 'auto';
    const pageTop = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, pageTop - window.innerHeight * 0.85);
  });
  await page.waitForTimeout(200);
  await expect.poll(() => reveal.evaluate((element) => getComputedStyle(element).opacity)).toBe('0');
  await reveal.evaluate((element) => {
    const pageTop = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, pageTop - window.innerHeight * 0.72);
  });
  await expect.poll(() => reveal.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');

  const walkthroughWrapper = page.locator('.walkthrough-section > .scroll-reveal').nth(1);
  const walkthroughPoster = page.locator('.walkthrough-poster');
  const wrapperBox = await walkthroughWrapper.boundingBox();
  const posterBox = await walkthroughPoster.boundingBox();
  expect(wrapperBox && posterBox).toBeTruthy();
  expect(Math.abs((wrapperBox?.width ?? 0) - (posterBox?.width ?? 0))).toBeLessThan(2);
});

test('submits the pilot qualifier and shows an address-safe confirmation', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.IntersectionObserver = class ImmediateIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }

      private callback: IntersectionObserverCallback;

      observe(element: Element) {
        this.callback(
          [{ isIntersecting: true, target: element } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }

      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
      readonly root = null;
      readonly rootMargin = '0px';
      readonly thresholds = [0];
    } as unknown as typeof IntersectionObserver;
  });

  await page.route('**/turnstile/v0/api.js*', async (route) => {
    await route.fulfill({
      contentType: 'application/javascript',
      body: `window.turnstile={render:(element,options)=>{element.textContent='Verified for test';setTimeout(()=>options.callback('test-token'),0);return 'test-widget'},remove:()=>{},reset:()=>{}};`,
    });
  });

  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/public/pilot-waitlist', async (route) => {
    const headers = {
      'access-control-allow-origin': 'http://localhost:4173',
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
  await page.getByLabel('Name').scrollIntoViewIfNeeded();
  await expect(page.getByText('Verification complete.')).toBeVisible();

  await page.getByLabel('Name').fill('Riley Chen');
  await page.getByLabel('Work email').fill('riley@example.test');
  await page
    .getByRole('textbox', { name: 'Company', exact: true })
    .fill('Northstar Labs');
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

  await page.evaluate(() => {
    document.documentElement.style.removeProperty('zoom');
    if (!document.documentElement.style.length) {
      document.documentElement.removeAttribute('style');
    }
  });
  await page.goto('/privacy');
  await expect(
    page.getByRole('heading', { name: 'Small form. Clear boundary.' }),
  ).toBeVisible();
});
