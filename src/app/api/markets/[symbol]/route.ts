import { prisma } from "@/lib/db";
import { marketEngine } from "@/lib/market/engine";
import { handleError, ok, fail } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const { symbol } = await params;
    const asset = await prisma.asset.findUnique({ where: { symbol: symbol.toUpperCase() } });
    if (!asset) return fail("Unknown asset", 404);
    const st = marketEngine.getState(asset.symbol);
    const candles = st ? st.candles.slice(-300) : [];
    const spread = st ? st.price * st.spreadRel : 0;
    return ok({
      asset: {
        symbol: asset.symbol, name: asset.name, category: asset.category,
        digits: asset.digits, payoutRate: asset.payoutRate, contractSize: asset.contractSize,
      },
      quote: st
        ? {
            bid: Math.round((st.price - spread / 2) * 10 ** asset.digits) / 10 ** asset.digits,
            ask: Math.round((st.price + spread / 2) * 10 ** asset.digits) / 10 ** asset.digits,
            mid: st.price,
            changePct: Math.round(st.changePct() * 1000) / 1000,
            serverTs: Date.now(),
          }
        : null,
      candles,
    });
  } catch (e) {
    return handleError(e);
  }
}
