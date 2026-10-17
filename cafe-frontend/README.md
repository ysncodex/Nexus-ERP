# Nexus ERP V3 — Frontend

React single-page app for POS, order history, expenses, funds, inventory, staff, and reports at **Beans & Butter Café**.

Pairs with [`cafe-backend`](../cafe-backend/) for production. Supports optional offline fallback when the API is unreachable.

---

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

Ensure the backend is running and `VITE_API_URL` points to it (default `http://localhost:3000/api`).

---

## Environment variables

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `VITE_API_URL` | Yes (prod) | Backend base URL including `/api` |
| `VITE_OWNER_PASSWORD` | No | Offline owner login fallback |
| `VITE_MANAGER_PASSWORD` | No | Offline manager login + PIN fallback |

Set production values in the **Netlify dashboard**, not in committed files.

Passwords are never hardcoded in source — only in `.env` (gitignored) or host env.

---

## Features

- **POS / New Order** — menu grid, cart, discounts, gifts, payment panel
- **Order History** — today-only by default; date filters for history
- **Sales Sync** — uploaded sales, offline queue, and delivery-app sync
- **Dashboard** — owner sales, costs, and liquidity KPIs (today by default)
- **Manager Dashboard** — shift metrics, cash/bKash, and recent orders
- **Expenses** — all expenses, purchases, consumables and packaging, fixed expenses
- **Accounts** — daily summary, cash/bank/bKash, delivery payouts
- **People** — staff schedule and payroll (owner only)
- **Reports** — financial report, product sales, PDF/CSV/XLSX export
- **Roles** — owner (full access), manager (orders, products, purchases, consumables, fixed expenses)

---

## Business timezone

The ERP uses **Asia/Dhaka (UTC+6)** for “today” everywhere:

- Dashboard and ERP context default to **today only**
- Order History opens on **today's orders**; widen the date range to see history
- At midnight Dhaka time, saved “today” filters reset on next page focus
- Helpers: `src/shared/utils/businessDate.ts`

---

## Authentication flow

1. **Production** — `POST /api/auth/login` with role + password → JWT stored in localStorage
2. **Offline fallback** — if API fails, checks `VITE_OWNER_PASSWORD` / `VITE_MANAGER_PASSWORD`

Manager-sensitive actions (delete, some edits) require the manager password modal.

---

## Scripts

```bash
npm run dev       # Vite dev server
npm run build     # Production build → dist/
npm run preview   # Preview production build
npm run lint      # ESLint
npm run analyze   # Bundle size report
```

---

## Folder structure

```text
cafe-frontend/
├── public/                 # Static assets, SPA redirects
├── src/
│   ├── features/auth/      # Login
│   ├── modules/            # sales, finance, inventory, hr, reports
│   ├── core/
│   │   ├── api/            # Axios client + services
│   │   ├── context/        # ERPContext, filters, stats
│   │   └── types/
│   ├── shared/
│   │   ├── components/ui/
│   │   └── utils/          # businessDate, formatters, calculations
│   ├── App.tsx
│   └── main.tsx
├── netlify.toml            # Netlify build config
├── .env.example
└── vite.config.ts
```

---

## Deploy (Netlify)

1. Base directory: `cafe-frontend`
2. Build: `npm run build`
3. Publish: `dist`
4. Set `VITE_API_URL` to your Render backend URL (e.g. `https://your-api.onrender.com/api`)

SPA routing is handled by `public/_redirects` and `netlify.toml`.

---

## SPA routing

Direct visits to routes like `/dashboard/orders` require the host to serve `index.html` for unknown paths. Config files for Netlify, Vercel, and Cloudflare are included.

---

## Related docs

- [Root README](../README.md) — monorepo overview
- [Backend README](../cafe-backend/README.md) — API and database
