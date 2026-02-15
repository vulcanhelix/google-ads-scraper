/**
 * End-to-end test: focus on the text ads with extracted content
 */
import { chromium } from 'playwright';
import { scrapeAdvertiserAds } from '../src/scraper/ads';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  console.log('Testing API interception — showing text ads with extracted content...\n');
  const result = await scrapeAdvertiserAds(page, 'AR07942299600172351489', { maxResults: 50 });

  console.log('\n=== SUMMARY ===');
  console.log('Success:', result.success);
  console.log('Total found:', result.totalFound);
  console.log('Ads with headlines:', result.ads.filter(a => a.headline).length);
  console.log('Ads with image URLs:', result.ads.filter(a => a.imageUrl).length);

  // Show only ads WITH extracted text
  const textAds = result.ads.filter(a => a.headline);
  console.log(`\n=== TEXT ADS WITH EXTRACTED CONTENT (${textAds.length}) ===`);
  for (const ad of textAds) {
    console.log('\n---');
    console.log('  ID:', ad.id);
    console.log('  Format:', ad.format);
    console.log('  HEADLINE:', ad.headline);
    console.log('  DESCRIPTION:', ad.description?.substring(0, 200));
    console.log('  Days shown:', ad.totalDaysShown);
  }

  // Show first 3 image ads
  const imageAds = result.ads.filter(a => !a.headline && a.imageUrl);
  console.log(`\n=== IMAGE ADS (first 3 of ${imageAds.length}) ===`);
  for (const ad of imageAds.slice(0, 3)) {
    console.log('  ', ad.id, '| img:', ad.imageUrl?.substring(0, 80));
  }

  await browser.close();
}

main().catch(console.error);
