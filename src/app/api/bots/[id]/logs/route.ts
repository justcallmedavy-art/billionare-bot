import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { handleError, ok, fail } from "@/lib/api";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const bot = await prisma.bot.findUnique({ where: { id } });
    if (!bot || bot.userId !== user.id) return fail("Bot not found", 404);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit") || 100), 300);

    const [logs, signals] = await Promise.all([
      prisma.botLog.findMany({ where: { botId: bot.id }, orderBy: { createdAt: "desc" }, take: limit }),
      prisma.botSignal.findMany({ where: { botId: bot.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    return ok({
      bot: {
        id: bot.id, name: bot.name, status: bot.status, pauseReason: bot.pauseReason,
        demo: bot.demo, assetSymbol: bot.assetSymbol, stake: bot.stake,
        tradeCount: bot.tradeCount, winCount: bot.winCount, lossCount: bot.lossCount, pnl: bot.pnl,
        lastSignalAt: bot.lastSignalAt, lastTradeAt: bot.lastTradeAt,
      },
      logs,
      signals,
    });
  } catch (e) {
    return handleError(e);
  }
}
