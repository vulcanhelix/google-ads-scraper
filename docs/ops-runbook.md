# Ops Runbook

## Overview

This service scrapes the Google Ads Transparency Center and stores results in NeonDB. It exposes a Fastify API and optional OCR pipeline.

## Environments

- Local dev: `npm run dev` / `npm run api`
- Production: Render web service

## Required Environment Variables

- `DATABASE_URL`: NeonDB connection string
- `API_KEY` or `GOOGLE_ADS_SCRAPER_API_KEY`: API key for write endpoints

### Optional Rate Limiting

- `SCRAPE_RATE_LIMIT` (default: 5 per window)
- `OCR_RATE_LIMIT` (default: 5 per window)
- `RATE_LIMIT_WINDOW_MS` (default: 60000)

## Core Endpoints

- `POST /api/scrape` (protected)
- `POST /api/ocr` (protected)
- `POST /api/ocr/combined` (protected)
- `GET /api/ocr/:jobId` (protected)
- `GET /api/advertisers`
- `GET /api/ads/advertiser/:id`

## Deploy (Render)

1. Push to `main`.
2. Render auto-deploys.
3. Verify `DATABASE_URL` and `API_KEY` are set in Render env.
4. Health check: `GET /health` returns `database: connected`.

## Database Schema Updates

Whenever Prisma schema changes:

1. Run `npm run db:push` locally (or in build pipeline) to sync NeonDB.
2. Ensure Prisma client is regenerated.

## OCR Queue Notes

- OCR uses an in-memory queue.
- Queue state resets on server restart.
- OCR jobs are capped at 10 creatives per run.

## Common Operations

### Trigger Scrape

```bash
curl -X POST https://google-ads-scraper-cgqj.onrender.com/api/scrape \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"domain":"hubstaff.com","region":"US","maxResults":10}'
```

### Trigger OCR

```bash
curl -X POST https://google-ads-scraper-cgqj.onrender.com/api/ocr \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"domain":"hubstaff.com","limit":5,"force":false}'
```

### Combined Scrape + OCR

```bash
curl -X POST https://google-ads-scraper-cgqj.onrender.com/api/ocr/combined \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"domain":"hubstaff.com","region":"US","maxResults":10,"limit":5}'
```

## Troubleshooting

### 401 Unauthorized
- Confirm `API_KEY` is set in Render env.
- Confirm client sends `x-api-key` header.

### 429 Rate Limit
- Check `SCRAPE_RATE_LIMIT`, `OCR_RATE_LIMIT`, `RATE_LIMIT_WINDOW_MS`.
- Reduce request frequency.

### 500 Errors on Scrape
- Check Render logs for Playwright errors.
- Validate Google Ads selectors in `src/scraper/ads.ts`.

### OCR Poor Quality
- Use high-resolution preview URLs.
- OCR runs on list page preview images; consider improving image selectors.

## Monitoring

- Render logs: `https://dashboard.render.com`
- NeonDB console: `https://console.neon.tech`
