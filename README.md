# Billinare Deal Option

A professional dark-themed **forex & fixed-time trading terminal** built with Next.js 15, React 19,
TypeScript, Tailwind CSS v4, Prisma (SQLite dev / PostgreSQL-ready), Server-Sent Events for live
market data, and a **DollarPrinter** automated-strategy center.

> **Reality label:** this deployment is **demo-first**. Market data comes from a clearly labeled
> simulated feed, all trades execute against a paper ledger, and real-money trading stays disabled
> until a verified broker adapter is configured. No simulated result is ever presented as real.

## Quick start

```bash
npm install
npx prisma db push        # create SQLite schema
npx tsx prisma/seed.ts    # 24 assets + admin bootstrap
npm run dev               # http://localhost:3000
```

Seeded admin: `admin@billinare.local` / `ChangeMe!2024` — **change this immediately**
(`ADMIN_BOOTSTRAP_PASSWORD` in `.env` controls the seed password).

## What's inside

| Area | Route | Notes |
|---|---|---|
| Landing | `/` | Animated hero, live ticker, honest-disclosure section |
| Trade terminal | `/trade` | Watchlist, live candlestick/area chart, forex & fixed-time tickets |
| Markets | `/markets` | Sortable live table across 24 assets |
| Positions | `/positions` | Open positions + fixed-time deals, close actions |
| History | `/history` | Filters + CSV export |
| Portfolio | `/portfolio` | Equity curve, win rate, profit factor, exposure |
| Wallet | `/wallet` | Demo funding + transaction ledger (real funding requires a payment provider) |
| DollarPrinter | `/bots`, `/bots/create`, `/bots/[id]`, `/bots/marketplace` | Bot cards, builder with mandatory risk limits, live console |
| Admin | `/admin` | Users (all balances visible), suspensions, audit log |
| Account | `/account` | Profile, password change, login activity, session revocation |

## Architecture

```
src/
  app/                  # App Router pages + API routes
    api/                # auth, markets, market/stream (SSE), trades, positions,
                        # account, wallet, notifications, bots, admin, watchlist
  components/           # charts (lightweight-charts), trading, navigation, ui
  lib/
    market/             # simulated GBM engine, 1m candles, indicators (SMA/EMA/RSI/BB/ATR/MACD/Stoch)
    trading/            # demo order engine, SL/TP sweeper, fixed-time settlement
    bots/               # strategy runtime, risk manager, settlement, scheduler
    auth/               # scrypt hashing, opaque server-side sessions
    security/           # rate limiting, client IP
    providers/          # market-data provider adapter (simulated ↔ real swap point)
  server (API layer)    # zod validation, uniform error envelopes, audit logging
prisma/schema.prisma    # users, sessions, accounts, assets, positions, deals,
                        # transactions, notifications, audit, bots, bot trades/logs
```

### Live data flow
`MarketEngine` (1s ticks, mean-reverting GBM) → per-symbol candle series → SSE
`/api/market/stream` → client `MarketFeedProvider` (auto-reconnect with exponential backoff,
stale-price detection) → chart, watchlist, tickets. The same ticks drive server-side SL/TP
sweeps, fixed-time settlement, and bot strategy evaluation every 5s.

### Demo vs real
- `demo = true` rows live in separate demo-ledger tables/flows (`DemoAccount`), always badged **DEMO**.
- Real trading requires `BROKER_PROVIDER` + `BROKER_API_URL` (see `.env.example`). Until then,
  every real-mode entry point returns an explicit 501 with a human-readable explanation.
  Nothing anywhere simulates a real fill.
- Deposits in demo mode are instant labeled demo credits; withdrawal requests stay `pending`
  and clearly explain that a verified payment provider is required. No fake completion states.

## Security
- Opaque session tokens (sha256-hashed server-side), HttpOnly + SameSite cookies
- scrypt password hashing, login-event tracking, session revocation (single & global)
- Zod validation on every mutation, per-IP/per-user rate limits
- Role-gated admin API with self-lockout protection and audit logging
- Security headers via `next.config.ts` (frame-deny, nosniff, referrer-policy)

## Admin policy
The admin dashboard manages **accounts**: status (active/suspended/banned), email verification,
platform metrics, per-user balances visibility, and an audit trail. Admins cannot alter trade
outcomes, prices, or balances — those are engine-driven and auditable, by design.

## Production notes
- Swap `DATABASE_URL` to PostgreSQL/Supabase and set `provider = "postgresql"` in `prisma/schema.prisma`.
- Replace the simulated `MarketEngine` behind `src/lib/providers` with a real feed adapter.
- Move the sweeper/bot scheduler to a dedicated worker process for horizontal scale.
- Add email verification + 2FA (schema fields already present) and a transactional email provider.
