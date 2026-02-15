import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { getRandomUserAgent } from '../config';
import { Actor } from 'apify';

export interface ProxyConfiguration {
  useApifyProxy?: boolean;
  apifyProxyGroups?: string[];
  apifyProxyCountry?: string;
  proxyUrls?: string[];
}

export interface BrowserConfig {
  headless: boolean;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  userAgent?: string;
  proxyConfiguration?: ProxyConfiguration;
}

export async function createBrowser(config: BrowserConfig): Promise<Browser> {
  let proxySettings = config.proxy;

  if (config.proxyConfiguration?.useApifyProxy !== false) {
    try {
      const proxyConfig = await Actor.createProxyConfiguration({
        groups: config.proxyConfiguration?.apifyProxyGroups,
        countryCode: config.proxyConfiguration?.apifyProxyCountry,
      });
      
      if (proxyConfig) {
        const proxyUrl = await proxyConfig.newUrl();
        if (proxyUrl) {
          const groups = config.proxyConfiguration?.apifyProxyGroups?.join(',') || 'auto';
          console.log(`Using Apify Proxy (groups: ${groups})`);
          
          const parsedUrl = new URL(proxyUrl);
          proxySettings = {
            server: `${parsedUrl.protocol}//${parsedUrl.hostname}:${parsedUrl.port}`,
            username: parsedUrl.username,
            password: parsedUrl.password,
          };
        }
      }
    } catch (error) {
      console.warn('Failed to configure Apify proxy:', error);
    }
  }

  const executablePath = process.env.APIFY_CHROME_EXECUTABLE_PATH || undefined;

  const browser = await chromium.launch({
    headless: config.headless,
    proxy: proxySettings,
    executablePath,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process,OptimizationGuideModelDownloading,OptimizationHintsFetching,OptimizationTargetPrediction,OptimizationHints',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-infobars',
      '--disable-breakpad',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-client-side-phishing-detection',
      '--disable-domain-reliability',
      '--disable-features=TranslateUI,BatteryStatus',
      '--disable-notifications',
      '--disable-offer-store-unmasked-wallet-cards',
      '--disable-offer-upload-credit-cards',
      '--disable-print-preview',
      '--disable-speech-api',
      '--disable-tab-for-desktop-share',
      '--hide-scrollbars',
      '--ignore-gpu-blacklist',
      '--no-pings',
      '--no-zygote',
      '--password-store=basic',
      '--use-mock-keychain',
      '--window-size=1920,1080',
    ],
    ignoreDefaultArgs: ['--enable-automation', '--enable-logging'],
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

    Object.defineProperty(navigator, 'permissions', {
      get: () => ({
        query: () => Promise.resolve({ state: 'granted' }),
      }),
    });

    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32',
    });

    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8,
    });

    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8,
    });

    const originalQuery = window.navigator.permissions.query;
    (window.navigator.permissions as any).query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(parameters);
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
