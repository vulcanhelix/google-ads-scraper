#!/usr/bin/env node

import { Command } from 'commander';
import { scrape } from './commands/scrape';
import { exportData } from './commands/export';
import { listAdvertisers } from './commands/list';
import { logger } from './utils/logger';

const program = new Command();

program
  .name('google-ads-scraper')
  .description('Scrape Google Ads Transparency Center for competitor ads')
  .version('1.0.0');

program
  .command('scrape <domain>')
  .description('Scrape all ads for a given domain')
  .option('-r, --region <code>', 'Filter by region (e.g., US, GB, DE)')
  .option('-f, --format <type>', 'Filter by format (text, image, video)')
  .option('-p, --platform <name>', 'Filter by platform (youtube, google_search, etc.)')
  .option('-m, --max <number>', 'Maximum number of ads to scrape', parseInt)
  .option('--headless', 'Run browser in headless mode', true)
  .option('--no-headless', 'Run browser with visible window (for debugging)')
  .option('-o, --output <format>', 'Output format: json, csv, or both', 'json')
  .option('-d, --output-dir <path>', 'Output directory', './data/exports')
  .action(async (domain: string, options) => {
    try {
      await scrape(domain, options);
    } catch (error) {
      logger.error('Scrape failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('export <domain>')
  .description('Export previously scraped data')
  .option('-o, --output <format>', 'Output format: json, csv, or both', 'json')
  .option('-d, --output-dir <path>', 'Output directory', './data/exports')
  .action(async (domain: string, options) => {
    try {
      await exportData(domain, options);
    } catch (error) {
      logger.error('Export failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all scraped advertisers')
  .action(async () => {
    try {
      await listAdvertisers();
    } catch (error) {
      logger.error('List failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
