# Apify Actor

```mermaid
flowchart TB
    Start([Actor Start]) --> Init["Actor.init()"]
    Init --> Input["Actor.getInput()"]
    Input --> Validate{Input valid?<br/>domain required}

    Validate -->|No| InputError[Throw: domain required]
    InputError --> Exit1[Actor.exit<br/>exitCode: 1]

    Validate -->|Yes| Extract[Extract input params:<br/>- domain<br/>- region<br/>- format<br/>- platform<br/>- maxResults<br/>- proxyConfig]

    Extract --> CreateBrowser["createBrowser()"]
    CreateBrowser --> Config["Configure:<br/>- headless: true<br/>- proxyConfiguration"]
    Config --> CreateContext["createContext()"]
    CreateContext --> CreatePage["createPage()"]

    CreatePage --> Lookup[lookupAdvertiserByDomain()]
    Lookup --> Success{Success?}

    Success -->|No| LookupError["Throw: Advertiser<br/>not found"]
    LookupError --> Close1[Close browser]
    Close1 --> Fail[Actor.fail()]
    Fail --> Exit2[Actor.exit()]

    Success -->|Yes| LogAdv["Log advertiser info"]
    LogAdv --> BuildFilters["Build ScrapeFilters"]
    BuildFilters --> Scrape["scrapeAdvertiserAds()"]

    Scrape --> PushData["Actor.pushData()"]
    PushData --> LogSuccess["Log: Successfully<br/>scraped N ads"]
    LogSuccess --> Close2[Close browser]
    Close2 --> ExitSuccess[Actor.exit()]

    subgraph Actor_Methods["Actor API Methods"]
        Init["Actor.init()"]
        GetInput["Actor.getInput()"]
        PushData["Actor.pushData()"]
        SetValue["Actor.setValue()"]
        Fail["Actor.fail()"]
        Exit["Actor.exit()"]
    end

    style Start fill:#4caf50
    style Success fill:#ff9800
    style Actor_Methods fill:#e1f5fe
```

## Source Files

- `src/actor.ts` - Apify Actor entry point

