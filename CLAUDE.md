# CLAUDE.md

## Commands

```bash
npm run dev          # Dev server on localhost:3000
npm run build        # Production build (also validates types)
npm run start        # Start production server
npm run lint         # ESLint
```

No test framework is configured. Use `npm run build` as the primary validation.

## Architecture

Standalone Sales Dashboard for Oren India — reads Zoho CRM deal data from Excel and renders interactive pipeline analytics. Localhost-only, no auth, no database.

### Data Flow

```
deals.xlsx (from Zoho Bigin CRM)
  → zoho-parser.ts (XLSX.read with module-scope mtime cache)
  → sales-engine.ts (pipeline KPIs, funnel, forecast, rep/source metrics)
  → GET /api/sales-data?period=monthly|quarterly|annual
  → useSalesData() hook (client-side fetch)
  → Dashboard page (recharts + shadcn/ui)
```

### Data Refresh

Run `npm run refresh:zoho` (or `python src/finances/fetch_zoho_bigin.py`) to fetch latest deals from Zoho Bigin CRM and regenerate `deals.xlsx`.

### Key Concepts

- **Indian FY (Apr–Mar):** All period grouping uses Apr-Mar. Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar.
- **Forecast Categories:** Pipeline → Best Case → Commit → Won (Brett Queener framework)
- **QUARTERLY_TARGET:** ₹2 Cr per quarter (hardcoded in sales-engine.ts)

### Number Formatting

- **Tables:** Lakhs with 2 decimals via `formatINR()` → "₹10.50L"
- **Chart axes:** Compact via `formatINRCompact()` → "10.5L" or "1.0Cr"
- **Tooltips:** Full Indian commas via `formatINRFull()` → "₹10,50,000"

## Stack

Next.js 14 (App Router), TypeScript (strict), Tailwind CSS v3, shadcn/ui (Radix-based v3 components), recharts, xlsx.

The shadcn components in `src/components/ui/` are Tailwind v3 compatible — do not regenerate with `npx shadcn` as that installs v4-incompatible versions.
