# Skills Integration Examples for Google Ads Scraper

This guide demonstrates how to use the newly installed OpenSkills in your Google Ads Scraper workflows.

## 🎯 Quick Reference

| Workflow | Skill Command | Use Case |
|----------|---------------|----------|
| **Frontend Dashboard** | `npx openskills read frontend-design` | Build data visualization UI |
| **Excel Reports** | `npx openskills read xlsx` | Export scraped data to spreadsheets |
| **API Documentation** | `npx openskills read doc-coauthoring` | Create technical specs |
| **Browser Testing** | `npx openskills read webapp-testing` | Test scraper automation |
| **PDF Reports** | `npx openskills read pdf` | Generate PDF reports from data |
| **Presentations** | `npx openskills read pptx` | Create slide decks from findings |

## 🛠️ Practical Workflow Examples

### 1. **Data Export to Excel**
When stakeholders request Excel reports of scraped ad data:

```bash
# Load the Excel skill
npx openskills read xlsx

# Then ask: "Create an Excel report from my scraped Google Ads data with:
# - Summary sheet with key metrics
# - Raw data sheet with all ads
# - Charts showing performance trends
# - Formulas for calculating CPC, CTR, etc."
```

**Expected output**: Professional Excel file with formatted sheets, formulas, and charts.

### 2. **Dashboard Development**
When you need a web interface to view scraping results:

```bash
# Load frontend design skill  
npx openskills read frontend-design

# Then ask: "Create a dashboard for my Google Ads scraper with:
# - Real-time scraping status
# - Data visualization charts
# - Domain search interface
# - Export functionality
# - Dark mode support"
```

**Expected output**: React/Vue components with Tailwind styling, responsive design, and interactive charts.

### 3. **Technical Documentation**
When documenting API changes or new features:

```bash
# Load documentation skill
npx openskills read doc-coauthoring

# Then ask: "Help me write technical documentation for:
# - New OCR integration for image-based ads
# - API rate limiting improvements  
# - Database schema changes
# - Deployment procedures"
```

**Expected output**: Structured docs with clear sections, examples, and reader testing.

### 4. **Scraper Testing**
When troubleshooting browser automation:

```bash
# Load web testing skill
npx openskills read webapp-testing

# Then ask: "Help me test my Google Ads scraper:
# - Verify it handles dynamic content loading
# - Test rate limiting compliance
# - Check data extraction accuracy
# - Debug headless vs headed mode issues"
```

**Expected output**: Playwright test scripts with proper waits, selectors, and error handling.

### 5. **Automated Reporting**
When generating weekly PDF reports:

```bash
# Load PDF skill
npx openskills read pdf

# Then ask: "Create a PDF report from my scraping data that includes:
# - Executive summary with key insights
# - Top performing ads analysis
# - Trend charts and visualizations
# - Recommendations for optimization"
```

**Expected output**: Professional PDF with charts, tables, and formatted content.

## 🔄 Integration with Existing Workflows

### In Your CI/CD Pipeline
```yaml
# .github/workflows/scraper.yml
- name: Generate Excel Report
  run: |
    npx openskills read xlsx
    # Generate reports from latest scrape data
    
- name: Update Documentation  
  run: |
    npx openskills read doc-coauthoring
    # Update API docs with new endpoints
```

### In Development Tasks
```bash
# When starting new feature
npx openskills read skill-creator

# When building UI components  
npx openskills read frontend-design

# When writing tests
npx openskills read webapp-testing
```

### In Data Analysis
```bash
# When analyzing scraped data
npx openskills read xlsx

# When creating presentations for stakeholders
npx openskills read pptx

# When generating PDF reports
npx openskills read pdf
```

## 📊 Enhanced Data Processing Examples

### From JSON to Professional Excel
```bash
# Your current export function exports to JSON
# Now enhance it with professional Excel formatting

npx openskills read xlsx

# Ask: "Convert my JSON export to a professional Excel workbook with:
# - Formatted headers with company branding
# - Conditional formatting for performance metrics  
# - Pivot tables for summarization
# - Charts showing trends over time
# - Data validation for input cells"
```

### Automated Dashboard Updates
```bash
# Combine skills for complete workflow
npx openskills read frontend-design,xlsx

# Ask: "Create a workflow that:
# 1. Reads latest Excel report (xlsx skill)
# 2. Updates dashboard components (frontend-design skill)  
# 3. Generates PDF summary (pdf skill)
# 4. Creates presentation deck (pptx skill)"
```

## 🚀 Getting Started

1. **Install any additional skills**:
   ```bash
   npx openskills install <skill-name> --universal
   ```

2. **Use multiple skills at once**:
   ```bash
   npx openskills read frontend-design,xlsx,pptx
   ```

3. **Check available skills**:
   ```bash
   npx openskills list
   ```

4. **Update skills regularly**:
   ```bash
   npx openskills update
   ```

## 💡 Pro Tips

- **Progressive Loading**: Skills load on-demand, keeping your context clean
- **Resource Bundling**: Each skill includes scripts, references, and assets
- **Version Control**: Skills are project-local and can be versioned
- **Team Collaboration**: All team members get the same skill set

## 🎯 Next Steps

Try these common scenarios:

1. **"Create a dashboard showing my scraper performance metrics"** → `frontend-design`
2. **"Export my scraped data to Excel with charts and formulas"** → `xlsx`  
3. **"Document my new OCR integration feature"** → `doc-coauthoring`
4. **"Test my scraper against different browser scenarios"** → `webapp-testing`
5. **"Create a PDF report from this week's scraping results"** → `pdf`

The skills are now integrated into your AGENTS.md and ready to use!