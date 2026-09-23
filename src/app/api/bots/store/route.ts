import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { parseBody, handleError, ok, fail } from "@/lib/api";
import { z } from "zod";
import { STORE_BOTS } from "@/lib/bots/store";

export async function GET() {
  try {
    await requireUser();
    return ok({ bots: STORE_BOTS });
  } catch (e) {
    return handleError(e);
  }
}

const deploySchema = z.object({
  slug: z.string().min(2).max(40),
  assetSymbol: z.string().min(3).max(16),
  stake: z.number().positive().max(1000),
  maxDailyLoss: z.number().positive().max(100000),
  maxTrades: z.number().int().min(1).max(500),
  maxConsecutiveLosses: z.number().int().min(1).max(50),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await parseBody(req, deploySchema);
    const template = STORE_BOTS.find((b) => b.slug === body.slug);
    if (!template) return fail("Unknown bot template", 404);

    const asset = await prisma.asset.findUnique({ where: { symbol: body.assetSymbol.toUpperCase() } });
    if (!asset) return fail("Unknown asset", 404);

    const bot = await prisma.bot.create({
      data: {
        userId: user.id,
        name: template.name,
        demo: true,
        assetSymbol: asset.symbol,
        strategyType: template.strategyType,
        strategyParams: JSON.stringify({
          tradeType: template.tradeType,
          durationSec: template.durationSec,
          digitBarrier: template.digitBarrier,
          fixedSide: template.fixedSide,
          entryDigit: template.entryDigit,
          hotWindow: template.hotWindow,
          patternLength: template.patternLength,
          martingale: template.martingale ?? false,
          martingaleSize: template.martingaleSize ?? 2,
        }),
        riskParams: JSON.stringify({
          maxDailyLoss: body.maxDailyLoss,
          maxTrades: body.maxTrades,
          maxConsecutiveLosses: body.maxConsecutiveLosses,
          takeProfit: template.risk.takeProfit,
        }),
        stake: body.stake,
      },
    });
    await prisma.botLog.create({
      data: { botId: bot.id, level: "info", message: `Deployed from Bot Store: ${template.name} · ${asset.symbol} · stake $${body.stake} (DEMO)` },
    });
    return ok({ botId: bot.id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
