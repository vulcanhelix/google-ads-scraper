/**
 * Debug: compare API responses with and without region=anywhere
 */
import { chromium } from 'playwright';
import { ApiInterceptor } from '../src/scraper/api-interceptor';
import { URLS } from '../src/config';

async function testWithUrl(url: string, label: string) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  
  const interceptor = new ApiInterceptor();
  interceptor.attach(page);
  
  // Also log ALL response URLs containing 'SearchCreatives'
  page.on('response', async (resp) => {
    if (resp.url().includes('SearchCreatives')) {
      try {
        const body = await resp.text();
        const data = JSON.parse(body);
        const items = data['1'];
        const count = Array.isArray(items) ? items.length : 'not array';
        console.log(`  [${label}] SearchCreatives response: ${count} items, status=${resp.status()}`);
      } catch (e) {
        console.log(`  [${label}] SearchCreatives response parse error: ${e}`);
      }
    }
  });
  
  console.log(`\n[${label}] Loading: ${url}`);
  
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('SearchService/SearchCreatives'),
      { timeout: 30000 }
    ).catch(() => null),
    page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }),
  ]);
  
  await new Promise((r) => setTimeout(r, 3000));
  await page.waitForLoadState('networkidle').catch(() => {});
  await new Promise((r) => setTimeout(r, 2000));
  
  console.log(`[${label}] Interceptor captured: ${interceptor.size} creatives`);
  
  // Show first 3
  for (const c of interceptor.getCreatives().slice(0, 3)) {
    console.log(`  ${c.creativeId} | format=${c.formatType} | img=${c.imageUrl ? 'yes' : 'no'} | text=${c.textPreviewUrl ? 'yes' : 'no'}`);
  }
  
  await browser.close();
}

async function main() {
  const advId = 'AR07942299600172351489';
  
  // Test without region
  await testWithUrl(`${URLS.ADVERTISER}${advId}`, 'NO_REGION');
  
  // Test with region=anywhere
  await testWithUrl(`${URLS.ADVERTISER}${advId}?region=anywhere`, 'ANYWHERE');
  
  // Test with region=US
  await testWithUrl(`${URLS.ADVERTISER}${advId}?region=US`, 'US');
}

main().catch(console.error);
