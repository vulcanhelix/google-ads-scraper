# Utilities

```mermaid
flowchart TB
    subgraph Logger["Logger Utility"]
        direction TB
        Levels["Log Levels:<br/>debug, info, warn, error"]
        Format["Format:<br/>[timestamp] [LEVEL] message"]
        Colors["ANSI Colors:<br/>- debug: cyan<br/>- info: green<br/>- warn: yellow<br/>- error: red"]
        
        Methods["Methods:<br/>- setLevel(level)<br/>- debug(msg, ...args)<br/>- info(msg, ...args)<br/>- warn(msg, ...args)<br/>- error(msg, ...args)"]
    end

    subgraph Delay["Delay Utility"]
        direction TB
        Basic["delay(ms): Promise&lt;void&gt;"]
        Random["randomDelay(min, max)<br/>random between range"]
        Human["humanDelay(base)<br/>adds 50% variance"]
    end

    subgraph Retry["Retry Utility"]
        direction TB
        WithRetry["withRetry&lt;T&gt;(fn, options)<br/>Exponential backoff"]
        Options["Options:<br/>- maxAttempts: 3<br/>- initialDelayMs: 1000<br/>- maxDelayMs: 30000<br/>- backoffMultiplier: 2"]
        
        Flow{Attempt<br/>Execute} -->|Success| Return[Return result]
        Flow -->|Fail| CheckMax{Max<br/>attempts?}
        CheckMax -->|No| Wait[Wait with<br/>backoff]
        CheckMax -->|Yes| Throw[Throw last error]
        Wait --> Flow
        
        IsRetry["isRetryableError(error)<br/>Pattern matching:<br/>- timeout<br/>- network<br/>- ECONNRESET<br/>- rate limit<br/>- 429/503/502"]
    end

    subgraph Config["Configuration"]
        URLS["URLS:<br/>- BASE: adstransparency.google.com<br/>- SEARCH<br/>- ADVERTISER"]
        Regions["REGIONS map"]
        UserAgents["USER_AGENTS array"]
        DefaultConfig["DEFAULT_CONFIG"]
    end

    style Logger fill:#e1f5fe
    style Delay fill:#fff3e0
    style Retry fill:#e8f5e9
    style Config fill:#fce4ec
```

## Source Files

- `src/utils/logger.ts` - Logging utility
- `src/utils/delay.ts` - Delay/promise utilities
- `src/utils/retry.ts` - Retry logic with exponential backoff
- `src/config.ts` - Configuration constants (URLs, regions, user agents)

