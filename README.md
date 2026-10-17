# Nexus ERP V3 — Beans & Butter Café

Full-stack point-of-sale and operations system for **Beans & Butter Café**.

**Version:** V3.0

V3 keeps the existing sales, expense, fund, and reporting behavior and adds clearer navigation, drawer-based entry on updated screens, consumables and packaging, staff schedule, and payroll.

| Package | Stack | Role |
| -------- | ----- | ---- |
| [`cafe-frontend/`](cafe-frontend/) | React 19, Vite, TypeScript, Tailwind | POS, dashboard, reports (Netlify) |
| [`cafe-backend/`](cafe-backend/) | Express, Prisma, PostgreSQL | REST API, auth, persistence (Render + Neon) |

---

## Quick start (local)

### 1. Backend

```bash
cd cafe-backend
cp .env.example .env
# Edit .env: DATABASE_URL, JWT_SECRET, OWNER_PASSWORD, MANAGER_PASSWORD
npm install
npm run db:deploy
npm run db:seed
npm run dev
```

API runs at `http://localhost:3000/api`.

### 2. Frontend

```bash
cd cafe-frontend
cp .env.example .env
# Set VITE_API_URL=http://localhost:3000/api
# Optional offline fallback: VITE_OWNER_PASSWORD, VITE_MANAGER_PASSWORD
npm install
npm run dev
```

App runs at `http://localhost:5173`.

---

## Modules

| Area | Screens |
| ---- | ------- |
| Overview | Dashboard, Manager Dashboard, Financial Report, Product Sales |
| Orders | New Order, Order History, Sales Sync |
| Products | Products |
| Expenses | All Expenses, Purchases, Consumables & Packaging, Fixed Expenses |
| Accounts | Daily Summary, Cash & Accounts, Delivery Payouts |
| Suppliers | Suppliers |
| People | Staff Schedule, Payroll |

Older dashboard bookmarks still open the current pages. Examples: `/dashboard/reports` goes to Financial Report, and `/dashboard/fund` goes to Cash & Accounts.

---

## Business timezone

All reporting uses **Asia/Dhaka (UTC+6)** as the business day, regardless of server or device timezone.

- **Default view = today only** — dashboard, KPIs, and Order History start on the current business day.
- **Historical data** — use date filters or custom ranges when you need past days.
- Transaction dates are stored as **UTC noon** of the business-day key so grouping stays consistent worldwide.

Helpers live in `cafe-frontend/src/shared/utils/businessDate.ts` and `cafe-backend/src/utils/businessDate.ts`.

---

## Authentication

| Role | Access |
| ---- | ------ |
| **Owner** | Full café access — orders, expenses, accounts, suppliers, people, and reports. The Manager Dashboard is manager-only. |
| **Manager** | Floor operations — orders, products, purchases, consumables, and fixed expenses. |

Staff Schedule and Payroll are owner-only on both the UI and `GET/POST /api/hr`.

Passwords are **never stored in source code**. Set them in environment variables:

| Location | Variables |
| -------- | --------- |
| Backend `.env` | `OWNER_PASSWORD`, `MANAGER_PASSWORD` (used by `npm run db:seed`) |
| Frontend `.env` | `VITE_OWNER_PASSWORD`, `VITE_MANAGER_PASSWORD` (optional offline fallback) |

Production sign-in uses JWT from the backend API.

---

## Deployment

| Service | Host | Config |
| ------- | ---- | ------ |
| Frontend | Netlify | `cafe-frontend/netlify.toml` — set `VITE_API_URL` in dashboard |
| Backend | Render | `cafe-backend/render.yaml` — set env vars in dashboard |
| Database | Neon PostgreSQL | `DATABASE_URL` on backend |

After backend deploy: `npm run db:deploy` then `npm run db:seed` (once per environment).

Apply pending migrations before using Consumables & Packaging or Staff Schedule / Payroll. Those features depend on the HR, consumable, and consumable-group migrations.

---

## Scripts (per package)

**Backend** (`cafe-backend/`)

```bash
npm run dev          # API with hot reload
npm run db:deploy    # Apply migrations (production-safe)
npm run db:seed      # Seed users + menu
npm run typecheck
```

**Frontend** (`cafe-frontend/`)

```bash
npm run dev
npm run build
npm run lint
```

---

## Security

- `.env` files are gitignored — **never commit** real credentials.
- Passwords belong only in `.env` (local) or host environment variables (production).
- If secrets were ever pushed to GitHub, rotate `DATABASE_URL`, `JWT_SECRET`, and login passwords immediately.
- Use `.env.example` files as templates with placeholder values only.
- Local agent notes (`AGENTS.md`, `AI-AGENT-USAGE.md`, `.agents/`, `.cursor/`, `.github/instructions/`, `.github/skills/`) stay on the machine and are gitignored.

---

## Project layout

```text
Nexus-ERP/
├── cafe-frontend/     # React SPA (POS + ERP UI)
├── cafe-backend/      # Express API + Prisma
├── README.md          # This file
└── .gitignore
```

See package READMEs for deeper detail:

- [Frontend README](cafe-frontend/README.md)
- [Backend README](cafe-backend/README.md)

---

## Maintainer

Md. Yeasin — yeasin7y@gmail.com
