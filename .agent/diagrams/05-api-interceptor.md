# API Interceptor

```mermaid
flowchart TB
    subgraph ApiInterceptor["ApiInterceptor Class"]
        direction TB
        creatives["creatives: Map&lt;string, InterceptedCreative&gt;"]
        attached["_attached: boolean"]
    end

    Start([Attach Interceptor]) --> Attach[page.on('response')<br/>listener]
    Attach --> ListenResponse[Listen for<br/>response events]

    ListenResponse --> CheckURL{URL includes<br/>SearchService/<br/>SearchCreatives?}
    CheckURL -->|No| Continue[Continue]
    CheckURL -->|Yes| ParseBody[Parse Response Body<br/>as JSON]

    ParseBody --> ExtractItems[Extract items<br/>from data['1']]
    ExtractItems --> LoopItems{For each item}

    LoopItems --> ParseCreative[parseCreative()]
    ParseCreative --> ExtractFields["Extract:<br/>- advertiserId (field 1)<br/>- creativeId (field 2)<br/>- formatType (field 4)<br/>- advertiserName (field 12)<br/>- timestamps (fields 6,7)<br/>- content (field 3)"]

    ExtractFields --> IsValid{Valid<br/>IDs?}

    IsValid -->|No| SkipItem[Skip]
    IsValid -->|Yes| CheckContent{content<br/>exists?}

    CheckContent -->|Text ad| ExtractText["Extract<br/>textPreviewUrl"]
    CheckContent -->|Image ad| ExtractImage["Extract imageUrl,<br/>width, height"]
    CheckContent -->|No content| SkipItem

    ExtractText --> Dedupe{Creative ID<br/>already exists?}
    ExtractImage --> Dedupe

    Dedupe -->|Yes| SkipItem
    Dedupe -->|No| Store[Store in Map]
    Store --> LoopItems

    LoopItems -->|Done| Return[Return creatives]

    subgraph Methods["Public Methods"]
        getSize["get size(): number"]
        getCreatives["getCreatives():<br/>InterceptedCreative[]"]
    end

    style ApiInterceptor fill:#e1f5fe
    style Methods fill:#fff3e0
```

## Source Files

- `src/scraper/api-interceptor.ts` - API response interception and parsing

