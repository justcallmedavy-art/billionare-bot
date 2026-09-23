import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type AssetSeed = {
  symbol: string; name: string; category: string; digits: number;
  basePrice: number; volatility: number; contractSize: number; payoutRate: number; sortOrder: number;
};

const ASSETS: AssetSeed[] = [
  // ---- Forex majors ----
  { symbol: "EURUSD", name: "Euro / US Dollar", category: "forex", digits: 5, basePrice: 1.08450, volatility: 0.00035, contractSize: 100000, payoutRate: 0.85, sortOrder: 1 },
  { symbol: "GBPUSD", name: "British Pound / US Dollar", category: "forex", digits: 5, basePrice: 1.26850, volatility: 0.00045, contractSize: 100000, payoutRate: 0.84, sortOrder: 2 },
  { symbol: "USDJPY", name: "US Dollar / Japanese Yen", category: "forex", digits: 3, basePrice: 148.250, volatility: 0.045, contractSize: 100000, payoutRate: 0.84, sortOrder: 3 },
  { symbol: "AUDUSD", name: "Australian Dollar / US Dollar", category: "forex", digits: 5, basePrice: 0.65850, volatility: 0.00028, contractSize: 100000, payoutRate: 0.85, sortOrder: 4 },
  { symbol: "USDCAD", name: "US Dollar / Canadian Dollar", category: "forex", digits: 5, basePrice: 1.35850, volatility: 0.00030, contractSize: 100000, payoutRate: 0.84, sortOrder: 5 },
  { symbol: "NZDUSD", name: "New Zealand Dollar / US Dollar", category: "forex", digits: 5, basePrice: 0.60150, volatility: 0.00030, contractSize: 100000, payoutRate: 0.84, sortOrder: 6 },
  { symbol: "EURGBP", name: "Euro / British Pound", category: "forex", digits: 5, basePrice: 0.85500, volatility: 0.00022, contractSize: 100000, payoutRate: 0.83, sortOrder: 7 },
  { symbol: "EURJPY", name: "Euro / Japanese Yen", category: "forex", digits: 3, basePrice: 160.800, volatility: 0.055, contractSize: 100000, payoutRate: 0.83, sortOrder: 8 },
  { symbol: "GBPJPY", name: "British Pound / Japanese Yen", category: "forex", digits: 3, basePrice: 188.100, volatility: 0.075, contractSize: 100000, payoutRate: 0.82, sortOrder: 9 },
  { symbol: "USDCHF", name: "US Dollar / Swiss Franc", category: "forex", digits: 5, basePrice: 0.88150, volatility: 0.00028, contractSize: 100000, payoutRate: 0.83, sortOrder: 10 },
  // ---- Crypto ----
  { symbol: "BTCUSD", name: "Bitcoin / US Dollar", category: "crypto", digits: 2, basePrice: 63450.00, volatility: 55, contractSize: 1, payoutRate: 0.87, sortOrder: 20 },
  { symbol: "ETHUSD", name: "Ethereum / US Dollar", category: "crypto", digits: 2, basePrice: 3120.00, volatility: 6.5, contractSize: 1, payoutRate: 0.86, sortOrder: 21 },
  { symbol: "SOLUSD", name: "Solana / US Dollar", category: "crypto", digits: 2, basePrice: 148.50, volatility: 1.1, contractSize: 1, payoutRate: 0.85, sortOrder: 22 },
  { symbol: "XRPUSD", name: "Ripple / US Dollar", category: "crypto", digits: 4, basePrice: 0.5250, volatility: 0.004, contractSize: 1, payoutRate: 0.84, sortOrder: 23 },
  // ---- Indices ----
  { symbol: "US30", name: "Dow Jones 30", category: "indices", digits: 1, basePrice: 39450.0, volatility: 9, contractSize: 1, payoutRate: 0.83, sortOrder: 30 },
  { symbol: "NAS100", name: "Nasdaq 100", category: "indices", digits: 1, basePrice: 18250.0, volatility: 7.5, contractSize: 1, payoutRate: 0.83, sortOrder: 31 },
  { symbol: "SPX500", name: "S&P 500", category: "indices", digits: 1, basePrice: 5210.0, volatility: 3.2, contractSize: 1, payoutRate: 0.83, sortOrder: 32 },
  { symbol: "GER40", name: "Germany 40 (DAX)", category: "indices", digits: 1, basePrice: 18320.0, volatility: 6, contractSize: 1, payoutRate: 0.82, sortOrder: 33 },
  // ---- Commodities ----
  { symbol: "USOIL", name: "Crude Oil WTI", category: "commodities", digits: 2, basePrice: 71.80, volatility: 0.10, contractSize: 1000, payoutRate: 0.82, sortOrder: 40 },
  { symbol: "UKOIL", name: "Brent Oil", category: "commodities", digits: 2, basePrice: 75.60, volatility: 0.11, contractSize: 1000, payoutRate: 0.82, sortOrder: 41 },
  { symbol: "NATGAS", name: "Natural Gas", category: "commodities", digits: 3, basePrice: 2.145, volatility: 0.008, contractSize: 10000, payoutRate: 0.81, sortOrder: 42 },
  // ---- Metals ----
  { symbol: "XAUUSD", name: "Gold / US Dollar", category: "metals", digits: 2, basePrice: 2338.50, volatility: 0.85, contractSize: 100, payoutRate: 0.84, sortOrder: 50 },
  { symbol: "XAGUSD", name: "Silver / US Dollar", category: "metals", digits: 3, basePrice: 27.450, volatility: 0.03, contractSize: 5000, payoutRate: 0.83, sortOrder: 51 },
  { symbol: "XPTUSD", name: "Platinum / US Dollar", category: "metals", digits: 2, basePrice: 985.00, volatility: 0.55, contractSize: 100, payoutRate: 0.82, sortOrder: 52 },
  // ---- Synthetic indices (continuous, tick-driven, 24/7) ----
  { symbol: "VOL10", name: "Volatility 10 Index", category: "indices", digits: 3, basePrice: 6251.0, volatility: 0.9, contractSize: 1, payoutRate: 0.95, sortOrder: 60 },
  { symbol: "VOL25", name: "Volatility 25 Index", category: "indices", digits: 3, basePrice: 2785.0, volatility: 2.1, contractSize: 1, payoutRate: 0.95, sortOrder: 61 },
  { symbol: "VOL50", name: "Volatility 50 Index", category: "indices", digits: 4, basePrice: 289.5, volatility: 0.28, contractSize: 1, payoutRate: 0.95, sortOrder: 62 },
  { symbol: "VOL75", name: "Volatility 75 Index", category: "indices", digits: 4, basePrice: 98750.0, volatility: 96, contractSize: 1, payoutRate: 0.95, sortOrder: 63 },
  { symbol: "VOL100", name: "Volatility 100 Index", category: "indices", digits: 2, basePrice: 599.4, volatility: 0.62, contractSize: 1, payoutRate: 0.95, sortOrder: 64 },
];

function normalizeSeed(s: string): string {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

async function main() {
  console.log("Seeding assets…");
  for (const a of ASSETS) {
    await prisma.asset.upsert({
      where: { symbol: a.symbol },
      update: {
        name: a.name, category: a.category, digits: a.digits,
        basePrice: a.basePrice, volatility: a.volatility, contractSize: a.contractSize,
        payoutRate: a.payoutRate, sortOrder: a.sortOrder, active: true,
      },
      create: { ...a },
    });
  }

  // ---- Admin bootstrap ----
  const adminEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL || "admin@billinare.local").toLowerCase();
  const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD || "ChangeMe!2024";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const { hashPassword, newReferralCode } = await import("../src/lib/auth/password");
    const { hashToken } = await import("../src/lib/auth/session");
    const user = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
        fullName: "Platform Administrator",
        country: "—",
        role: "admin",
        emailVerified: true,
        referralCode: newReferralCode(),
      },
    });
    await prisma.demoAccount.create({
      data: { userId: user.id, balance: Number(process.env.DEMO_STARTING_BALANCE || 10000) },
    });
    await prisma.session.create({
      data: { userId: user.id, tokenHash: hashToken(`bootstrap-${user.id}`), expiresAt: new Date(Date.now() + 365 * 864e5) },
    });
    console.log(`Admin created: ${adminEmail} / ${adminPassword} (change immediately)`);
  } else {
    console.log(`Admin exists: ${adminEmail}`);
  }

  console.log("Seed complete:", normalizeSeed("assets ✓ admin ✓"));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
