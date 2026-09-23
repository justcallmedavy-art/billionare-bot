import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { handleError, ok, fail } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const bot = await prisma.bot.findUnique({ where: { id } });
    if (!bot || bot.userId !== user.id) return fail("Bot not found", 404);

    const trades = await prisma.botTrade.findMany({
      where: { botId: bot.id, status: { in: ["won", "lost"] } },
      orderBy: { closedAt: "asc" },
    });

    let equity = 0;
    let peak = 0;
    let maxDd = 0;
    let largestWin = 0;
    let largestLoss = 0;
    const curve: Array<{ t: string; equity: number }> = [];
    for (const t of trades) {
      equity += t.pnl ?? 0;
      peak = Math.max(peak, equity);
      maxDd = Math.min(maxDd, equity - peak);
      largestWin = Math.max(largestWin, t.pnl ?? 0);
      largestLoss = Math.min(largestLoss, t.pnl ?? 0);
      curve.push({ t: (t.closedAt ?? t.openedAt).toISOString(), equity: Math.round(equity * 100) / 100 });
    }

    const wins = trades.filter((t) => t.status === "won").length;
    const losses = trades.length - wins;
    const grossWin = trades.filter((t) => (t.pnl ?? 0) > 0).reduce((s, t) => s + (t.pnl ?? 0), 0);
    const grossLoss = Math.abs(trades.filter((t) => (t.pnl ?? 0) < 0).reduce((s, t) => s + (t.pnl ?? 0), 0));

    return ok({
      demo: bot.demo,
      totals: {
        trades: trades.length, wins, losses,
        winRate: trades.length ? Math.round((wins / trades.length) * 1000) / 10 : null,
        pnl: Math.round(equity * 100) / 100,
        avgTrade: trades.length ? Math.round((equity / trades.length) * 100) / 100 : null,
        largestWin, largestLoss,
        profitFactor: grossLoss > 0 ? Math.round((grossWin / grossLoss) * 100) / 100 : null,
        maxDrawdown: Math.round(maxDd * 100) / 100,
      },
      equityCurve: curve,
    });
  } catch (e) {
    return handleError(e);
  }
}
