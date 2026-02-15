# Google Ads Transparency Center Scraper

A powerful, full-stack solution for monitoring competitor ads on the [Google Ads Transparency Center](https://adstransparency.google.com).

**New in v2.0:** Now features a complete Web Dashboard for managing scrapes, viewing results, and running OCR pipelines visually.

![Dashboard Preview](docs/dashboard-preview.png)

## Features

- **Web Dashboard**: Modern React UI to manage scrapes, view ads, and analyze results.
- **Full API Server**: Fastify-based REST API for programmatic access.
- **Advanced Scraping**:
  - 🔍 Search by domain (e.g., `tesla.com`)
  - 🔄 Handles infinite scroll & dynamic loading
  - 🛡️ Anti-detection measures tailored for Google
- **Intelligent Processing**:
  - 🧠 programmatic ad preview extraction
  - 📝 **OCR Pipeline**: Extract text overlay from ad images/videos using Tesseract.js
- **Data Persistence**:
  - 💾 Postgres storage (via Prisma)
  - 📊 JSON/CSV export capabilities

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL Database (e.g., local or NeonDB)
- API Key (for securing backend endpoints)

### 1. Installation

```bash
# 1. Clone the repository
git clone https://github.com/vulcanhelix/google_ads_scraper.git
cd google_ads_scraper

# 2. Install Backend Dependencies
npm install
npx playwright install chromium

# 3. Install Frontend Dependencies
cd client
npm install
cd ..
```

### 2. Configuration

Create a `.env` file in the root directory:

```env
# Database Connection
DATABASE_URL="postgres://user:pass@host:5432/db"

# API Security
API_SECRET_KEY="your-super-secret-key"

# Optional: Port Configuration
PORT=3000
```

### 3. Database Setup

```bash
# Push schema to database
npm run db:push

# (Optional) View data in Prisma Studio
npm run db:studio
```

### 4. Run the App

Run both the Backend API and Frontend Client concurrently:

```bash
npm run dev:all
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

---

## Usage Mode

### 🖥️ Web Dashboard (Recommended)
Navigate to `http://localhost:5173`.
1. **Scrape**: Enter a domain (e.g., `monday.com`) and start a scrape.
2. **View**: Browse captured ads in a grid view.
3. **Analyze**: Click "Run OCR" on specific ads to extract text.

### 💻 CLI & Headless
You can still run the scraper directly from the command line:

```bash
# Basic Scrape
npm run scrape -- tesla.com

# With Options
npm run scrape -- nike.com --region US --format video --max 20
```

### 🔌 API Endpoints
The backend exposes a REST API for integration:

- `POST /api/scrape`: Trigger a background scrape job
- `GET /api/ads`: List captured ads with filtering
- `POST /api/ocr/combined`: Run scrape + OCR in sequence

## OCR Architecture

The system uses a 2-stage process for detailed ad analysis:
1. **Scrape Phase**: Captures the Ad Creative ID and Preview URL.
2. **OCR Phase**: Fetches the high-res asset from the Preview URL and processes it through `tesseract.js` to extract text overlays, headlines, and calls-to-action.

## Project Structure

```
├── src/                  # Backend Source
│   ├── api/              # Fastify Server & Routes
│   ├── scraper/          # Playwright Logic
│   ├── database/         # Prisma Client
│   └── commands/         # CLI Tools
├── client/               # Frontend Source (React + Vite)
│   ├── src/
│   │   ├── components/   # UI Components
│   │   └── hooks/        # API Integration Hooks
└── prisma/               # Database Schema
```

## License

MIT
