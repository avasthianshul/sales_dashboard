# Sales Dashboard — Setup & Deployment

## Quick Start (Local)

```bash
npm install
npm run dev        # → http://localhost:3000
```

## Project Structure

```
sales_dashboard/
├── auth/                    # Credentials (gitignored — shared separately)
│   └── zoho.json            # Zoho Bigin OAuth credentials
├── src/
│   ├── app/                 # Next.js pages & API routes
│   ├── components/          # React components (shadcn/ui)
│   ├── lib/                 # Business logic & data hooks
│   ├── data/                # Excel/JSON data files (committed)
│   └── finances/            # Python data refresh scripts
├── CLAUDE.md                # AI assistant instructions
└── package.json
```

## Auth Setup

The `auth/` folder is gitignored. You received it alongside the repo.

**`auth/zoho.json`** — Zoho Bigin CRM OAuth credentials. Used only by the Python refresh script (`npm run refresh:zoho`), not by the running web app.

The web app reads pre-fetched data from `src/data/deals.xlsx` — no auth needed at runtime.

## Data Refresh

To pull the latest deals from Zoho CRM:

```bash
npm run refresh:zoho
```

This runs `src/finances/fetch_zoho_bigin.py` which:
1. Refreshes the OAuth access token
2. Fetches all deals and accounts from Zoho Bigin
3. Writes `deals.xlsx` to `src/data/`
4. Updates `refresh-timestamps.json`

**Requirements:** Python 3 with `openpyxl` and `requests` installed.

## Deploying to Vercel

1. **Create a GitHub repo** and push:
   ```bash
   git remote add origin git@github.com:<org>/<repo>.git
   git push -u origin main
   ```

2. **Import in Vercel** → connect the GitHub repo.

3. **No environment variables needed** — the app reads data from committed xlsx files. The Zoho refresh script is run locally, not on Vercel.

4. **Framework preset:** Next.js (auto-detected).

5. **After each data refresh**, commit and push the updated `deals.xlsx`:
   ```bash
   npm run refresh:zoho
   git add src/data/deals.xlsx src/data/refresh-timestamps.json
   git commit -m "Refresh Zoho deals data"
   git push
   ```
   Vercel auto-deploys on push.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/sales-engine.ts` | Pipeline KPIs, funnel, forecast computation |
| `src/lib/zoho-parser.ts` | Reads deals.xlsx into typed ZohoDeal[] |
| `src/app/api/sales-data/route.ts` | API endpoint serving pipeline data |
| `src/app/dashboard/page.tsx` | Main dashboard UI (850+ lines) |
| `src/data/deals.xlsx` | Source of truth for deal data |
