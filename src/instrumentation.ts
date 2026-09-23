import { prisma } from "@/lib/db";
import { marketEngine } from "@/lib/market/engine";
import { startBotLoop } from "@/lib/bots/scheduler";

/**
 * Next.js instrumentation hook — runs once per server process.
 * Loads assets from the database into the market engine and starts
 * the background sweeper for SL/TP and fixed-time settlement.
 */
export async function register() {
  try {
    const assets = await prisma.asset.findMany({ where: { active: true } });
    for (const a of assets) {
      marketEngine.register(a.symbol, a.digits, a.volatility, a.basePrice, 0.00012);
    }
    startBotLoop();
    console.log(`[instrumentation] market engine ready with ${assets.length} assets`);
  } catch (e) {
    // During `next build` the DB may not be reachable; fail soft.
    console.warn("[instrumentation] skipped:", (e as Error).message);
  }
}
