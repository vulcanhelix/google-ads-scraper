# Database Repository Operations

```mermaid
flowchart TB
    subgraph Advertiser_Ops["Advertiser Operations"]
        UpsertAdv["upsertAdvertiser()"]
        GetByDomain["getAdvertiserByDomain()"]
        GetById["getAdvertiserById()"]
        GetAll["getAllAdvertisers()"]
    end

    subgraph AdCreative_Ops["AdCreative Operations"]
        UpsertAds["upsertAdCreatives()"]
        GetByAdv["getAdsByAdvertiser()"]
        UpdateText["updateAdCreativeText()"]
        GetCount["getAdCount()"]
    end

    subgraph Session_Ops["Scrape Session Operations"]
        StartSession["startScrapeSession()"]
        CompleteSession["completeScrapeSession()"]
    end

    subgraph Prisma_Trans["Prisma Execution"]
        UpsertAdv --> PrismaUpsert["prisma.advertiser.upsert()"]
        UpsertAds --> Transaction["prisma.$transaction()"]
        Transaction --> MapUpserts["Map ads to<br/>individual upserts"]
        MapUpserts --> Batch["Execute batch"]
    end

    subgraph Database["Database Tables"]
        AdvTable["advertisers"]
        CreativeTable["ad_creatives"]
        SessionTable["scrape_sessions"]
    end

    UpsertAdv --> AdvTable
    GetByDomain --> AdvTable
    GetById --> AdvTable
    GetAll --> AdvTable

    UpsertAds --> CreativeTable
    GetByAdv --> CreativeTable
    UpdateText --> CreativeTable
    GetCount --> CreativeTable

    StartSession --> SessionTable
    CompleteSession --> SessionTable

    style Advertiser_Ops fill:#e1f5fe
    style AdCreative_Ops fill:#fff3e0
    style Session_Ops fill:#e8f5e9
    style Prisma_Trans fill:#fce4ec
    style Database fill:#f3e5f5
```

## Source Files

- `src/database/repository.ts` - All database operations
- `src/database/prisma.ts` - Prisma client setup
- `src/database/schema.ts` - Database schema definitions

