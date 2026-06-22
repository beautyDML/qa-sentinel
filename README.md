# QA Sentinel — Complete Architecture

---

## What It Is

A web-based QA automation platform where any QA engineer or developer can test a website — select specific modules or run a full audit — and get a clean health score report instead of raw terminal output. No installation required, just open the URL.

---

## Product Vision

```
Not this:                    This:
                             
node cli.js --url=...        QA Sentinel
↓                            ↓
Terminal logs                Enter URL
↓                            Select modules
Huge HTML file               ↓
somewhere on disk            Run Scan
                             ↓
                             Health Score: 78/100
                             Issues: 12 found
                             ↓
                             Per-module breakdown
                             ↓
                             Download Report
```

---

## Core Features

### Feature 1: Selective Module Scanning
User picks exactly what to test — not forced to run everything every time.

```
Available Modules:
□ Console Error Scanner
□ SEO Validator
□ Broken Link Scanner
□ Accessibility Scanner
□ Performance Checker
□ Navigation Tester
□ Form Tester
□ CTA Validator
□ Responsive Tester
□ Cross Browser Tester
□ Content Match Engine  (requires .docx upload)
□ Visual Regression     (requires baseline)
```

### Feature 2: Health Score
Instead of PASS/FAIL terminal logs — a single score with breakdown:

```
Website Health Score

82 / 100

● Critical Issues:   2
● Warnings:          5  
● Passed Checks:    18
```

Score formula: `(passed / total) × 100`, weighted so critical issues (FAIL) cost more than warnings (WARN).

### Feature 3: Scan History
Last 20 scans stored. Click any past scan to re-open its report. No login required for V1.

### Feature 4: Re-Verification
Compare any two scans from history:
```
Scan A (yesterday)  →  Scan B (today)

✓ FIX VERIFIED:     SEO Validator
⚠ STILL FAILING:   Broken Links
✗ NEW REGRESSION:  Console Errors
```

### Feature 5: Report Download
Every scan generates a downloadable HTML report. PDF export in V2.

### Feature 6: Quick Scan vs Full Audit
```
Quick Scan    →  User selects specific modules
Full Audit    →  All modules run automatically
```

---

## User Workflows

### Workflow 1: Quick Broken Link Check
```
Open QA Sentinel
↓
Enter URL: https://client-site.com
↓
Select: Broken Link Scanner only
↓
Run Scan (takes ~30 seconds)
↓
Result: 54 links checked, 3 broken
↓
Download Report
```

### Workflow 2: Pre-Launch Full Audit
```
Open QA Sentinel
↓
Enter URL
Upload .docx (optional)
Select: Full Audit
↓
Run Scan (takes 3-5 minutes)
↓
Health Score: 74/100
Critical: 3, Warnings: 7, Passed: 22
↓
Review per-module breakdown
↓
Share report with dev team
```

### Workflow 3: Fix Verification
```
Run Scan → bugs found → saved to history
↓
Developer fixes bugs
↓
Run Scan again
↓
Compare with previous scan
↓
FIX VERIFIED / STILL FAILING / NEW REGRESSION
```

### Workflow 4: Content Validation
```
Upload .docx reference
↓
Enter URL
↓
Select: Content Match Engine
↓
Run
↓
Result: 18/20 content chunks matched
Missing: "Our Services" heading
Altered: CTA text changed
```

---

## Tech Stack

```
┌─────────────────────────────────────────────┐
│                  FRONTEND                    │
│                                             │
│  React + Vite + Tailwind CSS                │
│  Dark theme, component-based UI             │
│  Axios for API calls                        │
│  React Router for pages                     │
│  Recharts for health score visualization    │
└────────────────────┬────────────────────────┘
                     │ HTTP / SSE
┌────────────────────▼────────────────────────┐
│                   BACKEND                   │
│                                             │
│  Node.js + Express                          │
│  REST API + Server-Sent Events              │
│  Manages scan lifecycle                     │
│  Calls engines, writes to DB                │
└──────┬──────────────────────┬───────────────┘
       │                      │
┌──────▼──────┐    ┌──────────▼──────────────┐
│  PostgreSQL │    │    SCAN ENGINES          │
│             │    │                          │
│  scans      │    │  All 13 engines          │
│  summaries  │    │  (unchanged from         │
│             │    │   current project)       │
└─────────────┘    └──────────────────────────┘
```

---

## Folder Structure

```
qa-sentinel/
│
├── frontend/                        # React + Vite app
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ScanForm.jsx         # URL input + module selector
│   │   │   ├── HealthScore.jsx      # Score ring/chart
│   │   │   ├── ModuleCard.jsx       # Per-module result card
│   │   │   ├── ScanHistory.jsx      # Last 20 scans list
│   │   │   ├── CompareView.jsx      # Re-verification diff view
│   │   │   └── ReportDownload.jsx   # Download button
│   │   ├── pages/
│   │   │   ├── Home.jsx             # Scan form + module picker
│   │   │   ├── Results.jsx          # Health score + module results
│   │   │   ├── History.jsx          # Past scans
│   │   │   └── Compare.jsx          # Diff two scans
│   │   ├── hooks/
│   │   │   └── useScan.js           # scan state management
│   │   ├── api/
│   │   │   └── client.js            # Axios API calls
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/                         # Node.js + Express
│   ├── src/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── scan.routes.js   # POST /scan/start etc.
│   │   │       └── history.routes.js
│   │   ├── core/
│   │   │   ├── browserManager.js    # ✅ keep as-is
│   │   │   ├── configLoader.js      # ✅ keep as-is
│   │   │   ├── concurrency.js       # ✅ keep as-is
│   │   │   └── scanRunner.js        # NEW — orchestrates engines
│   │   ├── engines/                 # ✅ ALL 13 keep as-is
│   │   │   ├── consoleErrorScanner.js
│   │   │   ├── seoValidator.js
│   │   │   ├── brokenLinkScanner.js
│   │   │   ├── accessibilityScanner.js
│   │   │   ├── performanceChecker.js
│   │   │   ├── navigationTester.js
│   │   │   ├── formTester.js
│   │   │   ├── ctaValidator.js
│   │   │   ├── responsiveTester.js
│   │   │   ├── crossBrowserTester.js
│   │   │   ├── contentMatchEngine.js
│   │   │   ├── visualRegressionEngine.js
│   │   │   └── compareEngine.js
│   │   ├── reports/
│   │   │   ├── reportGenerator.js   # ✅ keep, update for new shape
│   │   │   └── htmlUtils.js         # ✅ keep as-is
│   │   ├── db/
│   │   │   ├── index.js             # PostgreSQL connection
│   │   │   ├── schema.sql           # table definitions
│   │   │   └── queries.js           # reusable DB queries
│   │   └── server.js                # Express app entry point
│   └── package.json
│
├── uploads/                         # temp docx/image uploads
├── output/                          # scan reports + screenshots
│   └── baselines/                   # visual regression baselines
│
└── README.md
```

---

## Database Schema

```sql
-- Stores every scan run
CREATE TABLE scans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url           TEXT NOT NULL,
  modules_run   TEXT[] NOT NULL,        -- ['seo', 'brokenLinks', ...]
  status        TEXT NOT NULL,          -- 'running' | 'complete' | 'failed'
  health_score  INTEGER,                -- 0-100, null while running
  results_json  JSONB,                  -- full engine output
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Quick summary per scan (for history list, no need to load full JSON)
CREATE TABLE scan_summaries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id       UUID REFERENCES scans(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  total_checks  INTEGER NOT NULL,
  passed        INTEGER NOT NULL,
  failed        INTEGER NOT NULL,
  warnings      INTEGER NOT NULL,
  health_score  INTEGER NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints

```
POST   /api/scan/start
       Body: { url, modules, auth?, docx? }
       Returns: { scanId }

GET    /api/scan/:id/status
       Returns: { status, progress }
       Streams via SSE while running

GET    /api/scan/:id/report
       Returns: full results JSON

GET    /api/scan/:id/report/html
       Returns: downloadable HTML file

GET    /api/scans/history
       Returns: last 20 scan summaries

DELETE /api/scan/:id
       Removes scan from history

POST   /api/scan/compare
       Body: { scanId1, scanId2 }
       Returns: comparison result
```

---

## Pages

```
/ (Home)
├── URL input
├── Module selector (checkboxes)
├── Quick Scan / Full Audit toggle
├── Auth fields (optional, collapsible)
└── Run Scan button

/results/:scanId
├── Health Score (big number, ring chart)
├── Summary bar (critical / warnings / passed)
├── Per-module cards (expandable)
├── Visual diff images (if applicable)
└── Download Report button

/history
├── Last 20 scans list
├── Each shows: URL, score, date, modules run
└── Click any → goes to /results/:scanId

/compare
├── Pick two scans from history
└── Side-by-side diff:
    FIX VERIFIED / STILL FAILING / NEW REGRESSION
```

---

## Scan Lifecycle

```
User clicks Run Scan
↓
POST /api/scan/start
↓
Backend creates scan record (status: 'running')
Returns scanId immediately
↓
Frontend connects to SSE stream
↓
Backend runs selected engines one by one
Sends progress events via SSE:
  { module: 'SEO Validator', status: 'PASS' }
  { module: 'Broken Links', status: 'FAIL' }
  ...
↓
All engines complete
Backend calculates health score
Updates DB (status: 'complete', results_json, health_score)
Sends 'complete' SSE event
↓
Frontend navigates to /results/:scanId
↓
Renders health score + module cards
```

---

## Health Score Formula

```javascript
// Each module contributes differently based on impact
const WEIGHTS = {
  FAIL: -10,   // critical issue — heavy penalty
  WARN: -3,    // warning — light penalty
  PASS: +5,    // passing — positive contribution
};

// Score starts at 100, deductions applied
// Clamped between 0 and 100
function calculateHealthScore(moduleResults) {
  let score = 100;
  for (const result of moduleResults) {
    if (result.status === 'FAIL') score += WEIGHTS.FAIL;
    else if (result.status === 'WARN') score += WEIGHTS.WARN;
    else if (result.status === 'PASS') score += WEIGHTS.PASS;
  }
  return Math.max(0, Math.min(100, score));
}
```

---

## Build Order (Phase by Phase)

```
Phase 1 — Backend foundation
  PostgreSQL setup + schema
  Express server
  scanRunner.js (orchestrates engines)
  /api/scan/start + SSE progress stream

Phase 2 — Frontend foundation
  React + Vite setup
  Home page (URL input + module selector)
  SSE live progress during scan

Phase 3 — Results
  Health score component
  Per-module result cards
  /results/:scanId page

Phase 4 — History + Compare
  /history page
  /compare page
  Compare API endpoint

Phase 5 — Reports
  HTML report download
  Polish + dark theme
```

---

## What Gets Reused vs Rebuilt

```
REUSE (unchanged):          REBUILD:
─────────────────           ────────────────────
All 13 engines       →      cli.js (replaced by API)
browserManager.js    →      server.js (replaced by Express API)
configLoader.js      →      public/index.html (replaced by React)
concurrency.js
reportGenerator.js
htmlUtils.js
compareEngine.js
```

---

That's the complete picture. Everything we built in the 9 phases becomes the engine layer of a real product — nothing gets thrown away, just properly wrapped.

Ready to start Phase 1 — PostgreSQL schema + Express server foundation?