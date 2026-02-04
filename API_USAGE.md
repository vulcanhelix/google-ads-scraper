# Google Ads Scraper API - Usage Guide

## 🚀 Quick Start

Your API is live at: **https://google-ads-scraper-cgqj.onrender.com**

### Health Check
```bash
curl https://google-ads-scraper-cgqj.onrender.com/health
# Response: {"status":"ok"}
```

---

## 📡 API Endpoints

### 1. Trigger a Scrape
Scrape Google Ads Transparency Center for a specific domain.

**Endpoint:** `POST /api/scrape`

**Request Body:**
```json
{
  "domain": "tesla.com",
  "region": "US",
  "maxResults": 10
}
```

**Example:**
```bash
curl -X POST https://google-ads-scraper-cgqj.onrender.com/api/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "tesla.com",
    "region": "US",
    "maxResults": 10
  }'
```

**Response:**
```json
{
  "success": true,
  "advertiser": {
    "id": "AR17828074650563772417",
    "name": "Tesla",
    "domain": "tesla.com",
    "verificationStatus": "verified"
  },
  "ads": [...],
  "totalAdsFound": 10,
  "scrapedAt": "2026-02-03T19:30:00.000Z"
}
```

---

### 2. List All Advertisers
Get all advertisers in the database.

**Endpoint:** `GET /api/advertisers`

**Example:**
```bash
curl https://google-ads-scraper-cgqj.onrender.com/api/advertisers
```

**Response:**
```json
[
  {
    "id": "AR17828074650563772417",
    "name": "Tesla",
    "domain": "tesla.com",
    "verificationStatus": "verified",
    "location": "United States",
    "createdAt": "2026-02-03T19:30:00.000Z",
    "updatedAt": "2026-02-03T19:30:00.000Z"
  }
]
```

---

### 3. Get Advertiser by ID
Fetch a specific advertiser by their ID.

**Endpoint:** `GET /api/advertisers/:id`

**Example:**
```bash
curl https://google-ads-scraper-cgqj.onrender.com/api/advertisers/AR17828074650563772417
```

---

### 4. Get Advertiser by Domain
Fetch an advertiser by their domain name.

**Endpoint:** `GET /api/advertisers/domain/:domain`

**Example:**
```bash
curl https://google-ads-scraper-cgqj.onrender.com/api/advertisers/domain/tesla.com
```

---

### 5. Get Ads for an Advertiser
Retrieve all ads for a specific advertiser.

**Endpoint:** `GET /api/ads/advertiser/:advertiserId`

**Example:**
```bash
curl https://google-ads-scraper-cgqj.onrender.com/api/ads/advertiser/AR17828074650563772417
```

**Response:**
```json
[
  {
    "id": "CR03335465984256376833",
    "advertiserId": "AR17828074650563772417",
    "format": "image",
    "platforms": ["YouTube", "Google Display Network"],
    "headline": "Model 3 - Now Available",
    "description": "Experience the future of driving",
    "imageUrl": "https://...",
    "firstShown": "2026-01-15",
    "lastShown": "2026-02-03",
    "totalDaysShown": 19,
    "detailsUrl": "https://adstransparency.google.com/..."
  }
]
```

---

### 6. Get Specific Ad
Fetch a single ad by its ID.

**Endpoint:** `GET /api/ads/:id`

**Example:**
```bash
curl https://google-ads-scraper-cgqj.onrender.com/api/ads/CR03335465984256376833
```

---

## 🔒 Authentication

⚠️ **IMPORTANT: No authentication is currently implemented**

This means:
- Anyone with the URL can access your data
- Anyone can trigger scrapes
- No rate limiting is in place

### Recommended for Production:
1. **Add API Key Authentication** - Require `X-API-Key` header
2. **Implement Rate Limiting** - Prevent abuse
3. **IP Whitelisting** - Restrict access to known IPs
4. **CORS Configuration** - Control which domains can access the API

---

## 🛠️ Troubleshooting

### Issue: Database endpoints return 500 errors

**Possible causes:**
1. Database is empty (no scrapes have been run yet)
2. `DATABASE_URL` environment variable not set correctly in Render

**Solution:**
1. Check environment variables in Render dashboard
2. Run a test scrape to populate the database
3. Check Render logs for detailed error messages

### Issue: Scrape returns HTML instead of JSON

**Possible causes:**
1. Google Ads Transparency Center changed their page structure
2. Playwright selectors need updating
3. Rate limiting or bot detection

**Solution:**
1. Check the scraper logic in `src/scraper/ads.ts`
2. Update selectors if Google changed their UI
3. Add delays or randomization to avoid detection

### Issue: Scrape times out

**Possible causes:**
1. `maxResults` is too high
2. Network latency on Render
3. Google's page is slow to load

**Solution:**
1. Reduce `maxResults` to 5-10 for testing
2. Increase timeout values in scraper config
3. Run scrapes during off-peak hours

---

## 📊 Monitoring

### View Logs
```bash
# Via Render dashboard
https://dashboard.render.com/web/srv-d614hvvgi27c7397majg

# Or use Render CLI
render logs -s srv-d614hvvgi27c7397majg
```

### Check Deployment Status
```bash
# Via dashboard
https://dashboard.render.com/web/srv-d614hvvgi27c7397majg/deploys
```

---

## 🔄 Deployment

### Auto-Deploy
Every push to the `main` branch automatically triggers a new deployment.

```bash
# Make changes
git add .
git commit -m "feat: Add new feature"
git push origin main

# Render will automatically build and deploy
```

### Manual Deploy
You can also trigger a manual deploy from the Render dashboard.

---

## 💡 Tips

1. **Start Small**: Test with `maxResults: 3` before running larger scrapes
2. **Monitor Costs**: Render Starter plan has usage limits
3. **Database Backups**: Set up automated backups in NeonDB dashboard
4. **Error Handling**: Check logs regularly for scraping errors
5. **Rate Limiting**: Google may rate-limit if you scrape too frequently

---

## 📝 Example Workflow

```bash
# 1. Scrape Tesla ads
curl -X POST https://google-ads-scraper-cgqj.onrender.com/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"domain": "tesla.com", "maxResults": 5}'

# 2. List all advertisers
curl https://google-ads-scraper-cgqj.onrender.com/api/advertisers

# 3. Get Tesla's ads
curl https://google-ads-scraper-cgqj.onrender.com/api/advertisers/domain/tesla.com

# 4. Get specific ad details
curl https://google-ads-scraper-cgqj.onrender.com/api/ads/CR03335465984256376833
```

---

## 🔗 Useful Links

- **API URL**: https://google-ads-scraper-cgqj.onrender.com
- **Render Dashboard**: https://dashboard.render.com/web/srv-d614hvvgi27c7397majg
- **GitHub Repo**: https://github.com/vulcanhelix/google_ads_scraper
- **NeonDB Dashboard**: https://console.neon.tech

---

## 🆘 Support

If you encounter issues:
1. Check Render logs for error details
2. Verify environment variables are set correctly
3. Test endpoints with small `maxResults` values first
4. Review the scraper code in `src/scraper/` for logic errors

---

**Last Updated**: 2026-02-03
