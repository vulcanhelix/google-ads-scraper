# API Testing Guide

## Quick Start

### 1. Set up your `.env` file
```bash
cp .env.example .env
# Then edit .env and add your DATABASE_URL from NeonDB
```

### 2. Start the API
```bash
npm run api
```

Server runs on `http://localhost:3000`

---

## Available Endpoints

### Health Check
```bash
curl http://localhost:3000/health
# Response: {"status":"ok"}
```

### List All Advertisers
```bash
curl http://localhost:3000/api/advertisers
```

### Get Advertiser by ID
```bash
curl http://localhost:3000/api/advertisers/AR17828074650563772417
```

### Get Advertiser by Domain
```bash
curl http://localhost:3000/api/advertisers/domain/tesla.com
```

### Get Ads for an Advertiser
```bash
curl http://localhost:3000/api/ads/advertiser/AR17828074650563772417
```

### Get Specific Ad
```bash
curl http://localhost:3000/api/ads/CR03335465984256376833
```

### Trigger a Scrape
```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "tesla.com",
    "region": "US",
    "maxResults": 10
  }'
```

---

## Authentication

⚠️ **No authentication is currently implemented**

Anyone with the URL can:
- View all scraped data
- Trigger new scrapes

### Recommended for Production:
1. **API Key Authentication** - Simple header-based auth
2. **Rate Limiting** - Prevent abuse
3. **IP Whitelisting** - If only you need access

Would you like me to add authentication?

---

## Testing with Real Data

First, run a scrape to populate the database:
```bash
npm run scrape -- tesla.com --max 5
```

Then test the API endpoints above.
