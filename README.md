# Google Ads Transparency Scraper

A robust Apify Actor required to scrape competitor ads from the [Google Ads Transparency Center](https://adstransparency.google.com).

## Features

- **Domain Search**: Scrape all active ads for a specific advertiser domain (e.g., `monday.com`, `tesla.com`).
- **format Support**: Filter by ad format (Text, Image, Video).
- **Platform Support**: Filter by network (Google Search, YouTube).
- **Region Targeting**: Specify the region for the search (e.g., `US`, `GB`, `anywhere`).
- **Stealth**: Uses smart browser fingerprinting and Apify Proxy (Residential recommended) to avoid detection.
- **Output**: Returns structured JSON data including:
  - Ad Creative IDs
  - Headlines & Descriptions (for search ads)
  - Image/Video asset URLs
  - Landing Page URLs

## Input Parameters

| Field | Type | Default | Description |
|---|---|---|---|
| `domain` | String | **Required** | The target advertiser's domain (e.g. `nike.com`). |
| `region` | String | `anywhere` | The region code to search from (e.g. `US`, `GB`). |
| `maxResults` | Integer | `20` | Maximum number of ads to scrape. |
| `format` | String | `any` | Filter by `image`, `video`, `text`, or `any`. |
| `platform` | String | `any` | Filter by `youtube`, `google_search`, or `any`. |

## Output Example

The actor stores results in the default dataset.

```json
[
  {
    "id": "CR03335465984256376833",
    "advertiserId": "AR17828074650563772417",
    "format": "text",
    "platforms": ["google_search"],
    "targetDomain": "monday.com",
    "headline": "Manage Your Projects - The Visual Project Management",
    "description": "Plan, Track And Collaborate On Projects. Try monday.com For Free Today!",
    "displayUrl": "monday.com/project-management",
    "previewUrl": "https://adstransparency.google.com/...",
    "imageUrl": null,
    "videoUrl": null
  },
  {
    "id": "CR123...",
    "format": "image",
    "imageUrl": "https://tpc.googlesyndication.com/simgad/...",
    ...
  }
]
```

## Proxy Configuration

This actor requires a proxy to function correctly, as Google aggressively blocks data center IPs.
**Residential Proxies** are highly recommended for stability.

## Running Locally

To run this actor locally for development:

1.  Clone the repo.
2.  Install dependencies: `npm install`.
3.  Run the full stack app (Dashboard + API): `npm run dev:all`.

*Note: This repository contains both the Apify Actor logic (`src/actor.ts`) and a full-stack dashboard (`client/`). The Actor builds specifically from `src/actor.ts`.*
