# Export Pipeline

```mermaid
flowchart TB
    subgraph Export_Entry["Export Entry Points"]
        CLI["CLI: export command"]
        API["API: /api/export"]
        Scrape["Scrape: auto-export"]
    end

    subgraph Export_Data["Export Data Flow"]
        GetAdv[Get Advertiser<br/>by Domain]
        GetAds[Get Ads by<br/>Advertiser]
        MapData[Map DB objects to<br/>AdCreative type]
        BuildResult[Build ScrapeResult]
    end

    subgraph JSON_Export["JSON Export"]
        JSON_CheckDir{"outputDir<br/>exists?"}
        JSON_Create[Create directory<br/>recursive]
        JSON_Build["Build filename:<br/>{domain}_{timestamp}.json"]
        JSON_Write[Write JSON.stringify<br/>data, null, 2]
        JSON_Return[Return filepath]
    end

    subgraph CSV_Export["CSV Export"]
        CSV_CheckDir{"outputDir<br/>exists?"}
        CSV_Create[Create directory<br/>recursive]
        CSV_Build["Build filename:<br/>{domain}_{timestamp}.csv"]
        CSV_Headers[Define headers:<br/>creative_id, advertiser_id,<br/>headline, description, etc.]
        CSV_Map[Map ads to rows]
        CSV_Escape[Escape CSV values<br/>(quotes, commas)]
        CSV_Join[Join headers + rows]
        CSV_Write[Write CSV content]
        CSV_Return[Return filepath]
    end

    CLI --> GetAdv
    API --> GetAdv
    Scrape --> GetAdv

    GetAdv --> GetAds
    GetAds --> MapData
    MapData --> JSON_Export
    MapData --> CSV_Export

    JSON_CheckDir -->|No| JSON_Create
    JSON_CheckDir -->|Yes| JSON_Build
    JSON_Create --> JSON_Build
    JSON_Build --> JSON_Write
    JSON_Write --> JSON_Return

    CSV_CheckDir -->|No| CSV_Create
    CSV_CheckDir -->|Yes| CSV_Build
    CSV_Create --> CSV_Build
    CSV_Build --> CSV_Headers
    CSV_Headers --> CSV_Map
    CSV_Map --> CSV_Escape
    CSV_Escape --> CSV_Join
    CSV_Join --> CSV_Write
    CSV_Write --> CSV_Return

    style Export_Entry fill:#e1f5fe
    style Export_Data fill:#fff3e0
    style JSON_Export fill:#e8f5e9
    style CSV_Export fill:#fce4ec
```

## Source Files

- `src/commands/export.ts` - Export command handler
- `src/export/index.ts` - Export entry points
- `src/export/json.ts` - JSON export implementation
- `src/export/csv.ts` - CSV export implementation

