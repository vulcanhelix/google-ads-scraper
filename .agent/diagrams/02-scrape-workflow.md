# Scrape Command Workflow

```mermaid
flowchart TB
    Start([Start Scrape]) --> CheckCache{Check Cache<br/>&lt; 1 hour?}
    CheckCache -->|Yes| LoadCached[Load Cached Ads]
    LoadCached --> ExportCached[Export Data]
    ExportCached --> End([End])

    CheckCache -->|No| InitBrowser[Initialize Browser]
    InitBrowser --> LookupAdv[Lookup Advertiser<br/>by Domain]
    LookupAdv --> UpsertAdv[Upsert Advertiser<br/>to DB]
    UpsertAdv --> StartSession[Start Scrape Session]

    StartSession --> SetupInterceptor[Setup API Interceptor]
    SetupInterceptor --> NavigatePage[Navigate to<br/>Advertiser Page]
    NavigatePage --> WaitResponse[Wait for<br/>SearchCreatives API]
    WaitResponse --> InitialDelay[Initial Delay 3s]

    InitialDelay --> ExtractInitial[Extract Initial<br/>Creatives]
    ExtractInitial --> ScrollLoop{Scroll & Capture<br/>New Creatives}
    
    ScrollLoop -->|New creatives found| LogProgress[Log Progress]
    LogProgress --> CheckMax{Check maxResults<br/>limit}
    CheckMax -->|Not reached| ScrollLoop
    CheckMax -->|Reached| EndOfAds[End of Ads]

    ScrollLoop -->|No new creatives<br/>5x consecutive| EndOfAds
    ScrollLoop -->|At bottom| EndOfAds

    EndOfAds --> ConvertAds[Convert Intercepted<br/>to AdCreative]
    ConvertAds --> UpsertCreatives[Upsert Ad Creatives<br/>to DB]
    UpsertCreatives --> UpdateAdv[Update Advertiser<br/>Stats]

    UpdateAdv --> ExportResults[Export Data<br/>JSON/CSV]
    ExportResults --> CompleteSession[Complete Session]
    CompleteSession --> CloseBrowser[Close Browser]
    CloseBrowser --> End

    style Start fill:#4caf50
    style End fill:#f44336
    style CheckCache fill:#ff9800
    style ScrollLoop fill:#9c27b0
```

## Source Files

- `src/commands/scrape.ts` - Main scrape command orchestration
- `src/database/repository.ts` - Database operations (upsert, session tracking)
- `src/export/index.ts` - Export entry points

