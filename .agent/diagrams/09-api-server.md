# API Server Architecture

```mermaid
flowchart TB
    subgraph Fastify_Server["Fastify Server"]
        Server["FastifyInstance"]
        Plugins["Plugins:<br/>- @fastify/cors<br/>- @fastify/static"]
    end

    subgraph Middleware["Middleware"]
        Auth["Auth Middleware<br/>(x-api-key)"]
        RateLimit["Rate Limit Middleware<br/>(scrape: 5/min, ocr: 5/min)"]
        ErrorHandler["Global Error Handler"]
    end

    subgraph Routes["API Routes"]
        Advertisers["/api/advertisers"]
        Ads["/api/ads"]
        Scrape["/api/scrape"]
        OCR["/api/ocr"]
        Health["/health"]
    end

    subgraph Advertisers_Routes["Advertisers Routes"]
        AdvList["GET /"]
        AdvGet["GET /:id"]
        AdvSummary["GET /:id/summary"]
        AdvDomain["GET /domain/:domain"]
    end

    subgraph Ads_Routes["Ads Routes"]
        AdsByAdv["GET /advertiser/:advertiserId"]
        AdsWithCopy["GET /advertiser/:advertiserId/with-copy"]
        AdsIntel["GET /advertiser/:advertiserId/intelligence"]
        AdById["GET /:id"]
    end

    subgraph Scrape_Routes["Scrape Routes"]
        ScrapePost["POST /"]
    end

    subgraph OCR_Routes["OCR Routes"]
        OCRPost["POST /"]
        OCRGet["GET /:jobId"]
        OCRCombined["POST /combined"]
    end

    Server --> Plugins
    Plugins --> Middleware
    Middleware --> Routes

    Routes --> Advertisers_Routes
    Routes --> Ads_Routes
    Routes --> Scrape_Routes
    Routes --> OCR_Routes

    subgraph Intelligence["Ad Intelligence Features"]
        ExtractThemes["extractThemes()"]
        ExtractCTAs["extractCTAs()"]
        ExtractAngles["extractMessagingAngles()"]
    end

    Ads_Routes --> Intelligence

    style Fastify_Server fill:#e1f5fe
    style Middleware fill:#fff3e0
    style Routes fill:#e8f5e9
    style Intelligence fill:#fce4ec
```

## Source Files

- `src/api/server.ts` - Fastify server setup
- `src/api/routes/scrape.ts` - Scrape API routes
- `src/api/routes/ads.ts` - Ads API routes (including intelligence)
- `src/api/routes/ocr.ts` - OCR API routes
- `src/api/routes/advertisers.ts` - Advertisers API routes
- `src/api/middleware/auth.ts` - Authentication middleware
- `src/api/middleware/rateLimit.ts` - Rate limiting middleware

