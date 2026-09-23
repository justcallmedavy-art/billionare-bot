import { prisma } from "@/lib/db";
import { marketEngine } from "@/lib/market/engine";
import { handleError, ok } from "@/lib/api";
import { getProviderInfo } from "@/lib/providers";
import { startSweeper } from "@/lib/trading/sweeper";

export async function GET() {
  try {
    startSweeper();
    const assets = await prisma.asset.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });
    for (const a of assets) {
      marketEngine.register(a.symbol, a.digits, a.volatility, a.basePrice, 0.00012);
    }
    const snap = marketEngine.snapshot();
    const bySym = new Map(snap.map((s) => [s.symbol, s]));
    const provider = getProviderInfo();
    return ok({
      provider,
      assets: assets.map((a) => {
        const s = bySym.get(a.symbol);
        return {
          symbol: a.symbol,
          name: a.name,
          category: a.category,
          digits: a.digits,
          payoutRate: a.payoutRate,
          contractSize: a.contractSize,
          bid: s?.bid ?? null,
          ask: s?.ask ?? null,
          mid: s?.mid ?? null,
          changePct: s?.changePct ?? null,
          serverTs: s?.serverTs ?? Date.now(),
        };
      }),
    });
  } catch (e) {
    return handleError(e);
  }
}
