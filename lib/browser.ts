import { Builder, type ThenableWebDriver } from "selenium-webdriver";

let driver: ThenableWebDriver | undefined;

function recorderScript(endpoint: string, token: string) {
  return `
    (() => {
      if (window.__sentinelRecorderInstalled) return;
      window.__sentinelRecorderInstalled = true;
      const emit = (kind, target, value, isRedacted) => fetch(${JSON.stringify(endpoint)}, {
        method: 'POST', mode: 'cors', headers: {'content-type':'application/json', 'x-recording-token': ${JSON.stringify(token)}},
        body: JSON.stringify({kind, target, value, isRedacted, timestamp: new Date().toISOString()})
      }).catch(() => undefined);
      const describe = (element) => ({ tag: element.tagName.toLowerCase(), name: element.getAttribute('aria-label') || element.getAttribute('name') || '', text: element instanceof HTMLInputElement && element.type === 'password' ? '[REDACTED]' : (element.innerText || element.value || '').trim().slice(0, 120), testId: element.getAttribute('data-testid') || '' });
      document.addEventListener('click', (event) => { const element = event.target.closest('button,a,input,select,textarea,[role="button"]'); if (element) emit('CLICK', describe(element)); }, true);
      document.addEventListener('change', (event) => { const element = event.target; if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) return; const secret = element instanceof HTMLInputElement && element.type === 'password'; emit('TEXT_ENTRY', describe(element), secret ? '[REDACTED]' : element.value, secret); }, true);
      const originalPush = history.pushState; history.pushState = function(...args) { const result = originalPush.apply(this, args); emit('NAVIGATION', {url: location.href, title: document.title}); return result; };
    })();`;
}

export async function launchBrowser(targetUrl: string, token: string) {
  if (driver) await driver.quit().catch(() => undefined);
  const launchedDriver = await new Builder().usingServer(process.env.BROWSER_SELENIUM_URL ?? "http://browser:4444/wd/hub").forBrowser("chrome").build();
  driver = launchedDriver;
  try {
    await launchedDriver.get(targetUrl);
    await launchedDriver.executeScript(recorderScript("http://sentinel:3000/api/internal/events", token));
    return launchedDriver;
  } catch (error) {
    await launchedDriver.quit().catch(() => undefined);
    driver = undefined;
    throw error;
  }
}
