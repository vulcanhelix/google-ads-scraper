# Google Ads Transparency Center Scraper

A zero-cost scraper that extracts all Google Ads a company is running from the [Google Ads Transparency Center](https://adstransparency.google.com).

## Features

- 🔍 Search by domain name (e.g., `tesla.com`)
- 📊 Extract all active ads for any advertiser
- 💾 Store results in SQLite database
- 📁 Export to JSON or CSV
- 🔄 Handles pagination/infinite scroll automatically
- 🛡️ Anti-detection measures built-in

## Installation

```bash
cd Google_Ads_Scraper

# Install dependencies
npm install

# Install Playwright browser (required)
npx playwright install chromium
```

## Usage

### Scrape ads for a domain

```bash
# Basic usage
npm run scrape -- tesla.com

# With visible browser (for debugging)
npm run scrape -- tesla.com --no-headless

# With filters
npm run scrape -- nike.com --region US --format video --max 50

# Export as both JSON and CSV
npm run scrape -- apple.com --output both
```

### List scraped advertisers

```bash
npx ts-node src/index.ts list
```

### Export existing data

```bash
npx ts-node src/index.ts export tesla.com --output csv
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-r, --region <code>` | Filter by region (US, GB, DE, etc.) | All regions |
| `-f, --format <type>` | Filter by format (text, image, video) | All formats |
| `-p, --platform <name>` | Filter by platform (youtube, google_search) | All platforms |
| `-m, --max <number>` | Maximum number of ads to scrape | Unlimited |
| `--headless` | Run browser in headless mode | `true` |
| `--no-headless` | Show browser window | `false` |
| `-o, --output <format>` | Output format (json, csv, both) | `json` |
| `-d, --output-dir <path>` | Output directory | `./data/exports` |

## Output

### JSON Format

```json
{
  "success": true,
  "advertiser": {
    "id": "AR17828074650563772417",
    "name": "Tesla Inc.",
    "verificationStatus": "VERIFIED",
    "domain": "tesla.com"
  },
  "ads": [
    {
      "id": "CR03335465984256376833",
      "advertiserId": "AR17828074650563772417",
      "format": "video",
      "platforms": ["youtube"],
      "firstShown": "2025-01-17",
      "lastShown": "2025-02-03",
      "detailsUrl": "https://adstransparency.google.com/advertiser/AR.../creative/CR..."
    }
  ],
  "totalAdsFound": 156,
  "scrapedAt": "2025-02-03T12:00:00.000Z"
}
```

### CSV Format

```csv
creative_id,advertiser_id,advertiser_name,format,platforms,target_domain,first_shown,last_shown,total_days_shown,headline,description,details_url
CR03335465984256376833,AR17828074650563772417,Tesla Inc.,video,youtube,tesla.com,2025-01-17,2025-02-03,17,,,https://...
```

## Project Structure

```
Google_Ads_Scraper/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── config.ts             # Configuration
│   ├── types/                # TypeScript types
│   ├── scraper/              # Scraping logic
│   │   ├── browser.ts        # Playwright setup
│   │   ├── advertiser.ts     # Advertiser lookup
│   │   ├── ads.ts            # Ads scraping
│   │   └── parser.ts         # HTML parsing
│   ├── database/             # SQLite storage
│   ├── export/               # JSON/CSV export
│   ├── commands/             # CLI commands
│   └── utils/                # Utilities
├── data/
│   ├── ads.db                # SQLite database
│   └── exports/              # Exported files
└── package.json
```

## Data Source

This scraper uses the [Google Ads Transparency Center](https://adstransparency.google.com), which is:
- Publicly accessible (no authentication required)
- Free to use
- Shows all active ads for any verified advertiser

## Limitations

- Rate limiting: Add delays between requests to avoid blocks
- Dynamic content: Requires JavaScript rendering (handled by Playwright)
- Data freshness: Ads data may be slightly delayed from real-time

## License

MIT
