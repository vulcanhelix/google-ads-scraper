import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { getRandomUserAgent } from '../config';
import { Actor } from 'apify';

export interface BrowserConfig {
  headless: boolean;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  userAgent?: string;
  useApifyProxy?: boolean;
}

export async function createBrowser(config: BrowserConfig): Promise<Browser> {
  let proxySettings = config.proxy;

  if (config.useApifyProxy) {
    try {
      const proxyConfig = await Actor.createProxyConfiguration();
      if (proxyConfig) {
        const proxyUrl = await proxyConfig.newUrl();
        if (proxyUrl) {
          // Parse the URL to get server and credentials if needed,
          // but Playwright accepts the full URL in the server field too.
          proxySettings = {
            server: proxyUrl,
          };
          console.log('Using Apify Proxy');
        }
      }
    } catch (error) {
      console.warn('Failed to configure Apify proxy:', error);
    }
  }

  const browser = await chromium.launch({
    headless: config.headless,
    proxy: proxySettings,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  });

  return browser;
}

export async function createContext(
  browser: Browser,
  config: BrowserConfig
): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent: config.userAgent || getRandomUserAgent(),
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    proxy: config.proxy,
    javaScriptEnabled: true,
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    (window as unknown as Record<string, unknown>).chrome = {
      runtime: {},
    };
  });

  return context;
}

export async function createPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  });

  return page;
}
