import { ScraperConfig } from './types';

export const DEFAULT_CONFIG: ScraperConfig = {
  headless: true,
  delays: {
    betweenPages: 2000,
    betweenScrolls: 1500,
    afterSearch: 3000,
  },
  retries: {
    maxAttempts: 3,
    backoffMs: 1000,
  },
  output: {
    format: 'json',
    directory: './data/exports',
  },
};

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export const URLS = {
  BASE: 'https://adstransparency.google.com',
  SEARCH: 'https://adstransparency.google.com/?text=',
  ADVERTISER: 'https://adstransparency.google.com/advertiser/',
};

export const REGIONS: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  CA: 'Canada',
  AU: 'Australia',
  JP: 'Japan',
  BR: 'Brazil',
  IN: 'India',
  MX: 'Mexico',
};
