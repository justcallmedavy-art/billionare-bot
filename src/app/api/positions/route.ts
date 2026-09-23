import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { handleError, ok } from "@/lib/api";
import { marketEngine } from "@/lib/market/engine";
import { computeForexPnl } from "@/lib/trading/engine";

export async function GET() {
  try {
    const user = await requireUser();
    const positions = await prisma.position.findMany({
      where: { userId: user.id, status: "open", demo: true },
      include: { asset: true },
      orderBy: { openedAt: "desc" },
    });
    const deals = await prisma.fixedTimeDeal.findMany({
      where: { userId: user.id, status: "open", demo: true },
      include: { asset: true },
      orderBy: { openedAt: "desc" },
    });

    const posOut = positions.map((p) => {
      const st = marketEngine.getState(p.asset.symbol);
      const current = st?.mid ?? p.entryPrice;
      return {
        id: p.id, kind: "forex", demo: p.demo, symbol: p.asset.symbol, side: p.side,
        size: p.size, entry: p.entryPrice, current,
        sl: p.sl, tp: p.tp, margin: p.margin,
        pnl: computeForexPnl(p.side as "buy" | "sell", p.size, p.asset.contractSize, p.entryPrice, current, p.asset.digits),
        openedAt: p.openedAt,
      };
    });

    const now = Date.now();
    const dealsOut = deals.map((d) => {
      const st = marketEngine.getState(d.asset.symbol);
      const current = st?.mid ?? d.entryPrice;
      const winning = d.direction === "up" ? current > d.entryPrice : current < d.entryPrice;
      return {
        id: d.id, kind: "fixed-time", demo: d.demo, symbol: d.asset.symbol, direction: d.direction,
        stake: d.stake, payoutRate: d.payoutRate, entry: d.entryPrice, current,
        winning, expiresAt: d.expiresAt, secondsLeft: Math.max(0, Math.ceil((d.expiresAt.getTime() - now) / 1000)),
      };
    });

    return ok({ positions: posOut, fixedTime: dealsOut });
  } catch (e) {
    return handleError(e);
  }
}
