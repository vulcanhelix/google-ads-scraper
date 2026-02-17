# ![Icon](icon.png) Free Google Ads Scraper

**The most robust, domain-focused Google Ads Scraper on Apify. Extract active ads, creative details, and landing pages with built-in OCR and stealth technology.**

[![Apify](https://img.shields.io/badge/apify-platform-ff9000.svg)](https://apify.com)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/your-repo)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/your-repo/blob/master/LICENSE)

---

## 🚀 Why this Scraper?

Unlike generic scrapers, this tool is engineered for **Competitor Intelligence**. It allows you to target specific domains (e.g., `tesla.com`, `monday.com`) and extract their entire ad portfolio, including text within images using our **Advanced OCR** engine.

### ✨ Key Features

-   🔍 **Domain Intelligence**: Scrape all active ads for a specific advertiser domain.
-   🧠 **Built-in OCR**: Automatically extract text from Image and Video ads (headlines, descriptions).
-   🌍 **Global Coverage**: Scrape active ads from any region (US, EU, UK, CA, and more).
-   🖼️ **Multi-Format**: Supports **Text**, **Image**, and **Video** ad formats.
-   🛡️ **Stealth Mode**: Optimized for **Residential Proxies** to evade detection and blocking.
-   🎯 **Platform Targeting**: Filter ads by **Google Search** or **YouTube**.

---

## 📖 How to Use

### 1. Simple Domain Search (Recommended)
The easiest way to start is by providing the target domain.

1.  Enter the domain (e.g., `nike.com`) in the `domain` field.
2.  Select your target `region` (default: `anywhere`).
3.  Click **Start**.

### 2. Advanced Configuration
Customize your scrape with precision filters:

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `domain` | String | **Required** | The target advertiser's domain (e.g. `monday.com`). |
| `region` | String | `anywhere` | The region code to search from (e.g. `US`, `GB`, `DE`). |
| `maxResults` | Integer | `20` | Maximum number of ads to scrape (Max: 500). |
| `format` | String | `any` | Filter by `image`, `video`, `text`, or `any`. |
| `platform` | String | `any` | Filter by `youtube`, `google_search`, or `any`. |
| `extractHeadlines`| Boolean| `true` | **Enable OCR** to read text from ad images. |
| `proxyConfiguration`| Object | `Residential` | **Required**. Use Residential proxies for best results. |

---

## 📊 Output Example

The scraper returns structured JSON data for each ad. Here is a sample of what you get:

```json
{
  "id": "CR03335465984256376833",
  "advertiserId": "AR17828074650563772417",
  "creativeId": "CR03335465984256376833",
  "format": "image",
  "platform": ["google_search"],
  "domain": "monday.com",
  "originalUrl": "https://adstransparency.google.com/advertiser/AR17828.../creative/CR033...",
  "media_urls": [
    "https://tpc.googlesyndication.com/simgad/1058291827483...",
    "https://tpc.googlesyndication.com/simgad/847382910293..."
  ],
  "ocr_text": [
    "Manage Your Projects",
    "The Visual Project Management",
    "Try monday.com For Free"
  ],
  "landing_page": "https://monday.com/project-management?utm_source=google...",
  "last_seen": "2023-10-27T10:00:00.000Z"
}
```

---

## 🔌 Integrations

Connect your data to your favorite tools:

-   **Clay**: Enrich your CRM with competitor ad copy.
-   **n8n / Make**: Automate daily competitor monitoring reports.
-   **LangChain / LLMs**: Feed ad copy into AI to analyze sentiment and messaging strategy.

---

## ❓ FAQ

### 1. Why do I need Residential Proxies?
Google aggressively blocks data center IPs (like standard AWS/Google Cloud IPs). To ensure you get results and don't get blocked, **Residential Proxies** are essential. They mimic real user traffic.

### 2. Can I search by keyword?
Currently, this scraper is optimized for **Domain Intelligence** (finding ads by a specific advertiser). Keyword search is on our roadmap!

### 3. Does it scrape historical data?
The Google Ads Transparency Center shows currently active ads and some recently inactive ones. We scrape what is currently visible in the transparency center for the selected region.

### 4. How fast is the OCR?
Our optimized OCR engine adds only ~2-3 seconds per ad. It allows you to search and analyze text that is otherwise "trapped" inside images.

---

## 🛠 Troubleshooting

-   **0 Results?**:
    -   Check if the `domain` is correct (e.g., use `nike.com`, not `https://nike.com`).
    -   Try a different `region`. Some advertisers only run ads in specific countries.
    -   Ensure you are using **Residential Proxies**.
-   **Timeout?**:
    -   Reduce `maxResults` or increase the timeout setting in Apify if you are scraping a massive advertiser.

---

### Support
Found a bug or have a feature request? Please [open an issue](https://github.com/your-repo/issues) or contact us directly.
