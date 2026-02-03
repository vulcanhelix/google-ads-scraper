# Google Ads Scraper - Development Guide

## Commands

```bash
# Build
npm run build

# Type check
npx tsc --noEmit

# Run scraper
npm run scrape -- <domain> [options]

# Development mode
npx ts-node src/index.ts <command>
```

## Project Structure

- `src/index.ts` - CLI entry point (commander.js)
- `src/commands/` - CLI command handlers
- `src/scraper/` - Playwright scraping logic
- `src/database/` - JSON file-based storage
- `src/export/` - JSON/CSV export functions
- `src/types/` - TypeScript interfaces
- `src/utils/` - Delay, retry, logging utilities

## Key Files

- `src/scraper/advertiser.ts` - Looks up advertiser ID from domain
- `src/scraper/ads.ts` - Scrapes ads with scroll pagination
- `src/database/db.ts` - JSON file persistence (data/ads.json)

## Testing

Run against a known domain:
```bash
npx ts-node src/index.ts scrape tesla.com --max 5 --no-headless
```

Use `--no-headless` for debugging to see the browser.
