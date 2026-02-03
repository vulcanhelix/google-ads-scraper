import { initDatabase, getAllAdvertisers, getAdCount, closeDatabase } from '../database/db';
import { logger } from '../utils/logger';

export async function listAdvertisers(): Promise<void> {
  initDatabase();

  try {
    const advertisers = getAllAdvertisers();

    if (advertisers.length === 0) {
      logger.info('No advertisers found. Run a scrape first.');
      return;
    }

    logger.info('');
    logger.info('='.repeat(80));
    logger.info('Scraped Advertisers');
    logger.info('='.repeat(80));
    logger.info('');

    console.log(
      'ID'.padEnd(25) +
        'Name'.padEnd(30) +
        'Domain'.padEnd(20) +
        'Ads'.padEnd(8) +
        'Last Updated'
    );
    console.log('-'.repeat(95));

    for (const adv of advertisers) {
      const adCount = getAdCount(adv.id);
      console.log(
        adv.id.substring(0, 23).padEnd(25) +
          (adv.name || 'Unknown').substring(0, 28).padEnd(30) +
          (adv.domain || '-').substring(0, 18).padEnd(20) +
          adCount.toString().padEnd(8) +
          adv.updated_at
      );
    }

    logger.info('');
    logger.info(`Total: ${advertisers.length} advertisers`);
  } finally {
    closeDatabase();
  }
}
