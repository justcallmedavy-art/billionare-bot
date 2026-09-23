import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { parseBody, handleError, ok, fail } from "@/lib/api";
import { botCreateSchema } from "@/lib/validation/schemas";
import { z } from "zod";

export async function GET() {
  try {
    const user = await requireUser();
    const bots = await prisma.bot.findMany({
      where: { userId: user.id },
      include: { _count: { select: { trades: true } } },
      orderBy: { createdAt: "desc" },
    });
    return ok({
      bots: bots.map((b) => ({
        id: b.id, name: b.name, demo: b.demo, assetSymbol: b.assetSymbol,
        status: b.status, pauseReason: b.pauseReason, strategyType: b.strategyType,
        stake: b.stake, tradeCount: b.tradeCount, winCount: b.winCount,
        lossCount: b.lossCount, pnl: b.pnl,
        startedAt: b.startedAt, lastTradeAt: b.lastTradeAt, createdAt: b.createdAt,
        tradeTotal: b._count.trades,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await parseBody(req, botCreateSchema);
    if (!body.demo) {
      return fail(
        "Real-money bots are disabled until a broker adapter is configured and verified. Create a DEMO bot instead — it uses the same strategy engine.",
        501,
      );
    }
    const asset = await prisma.asset.findUnique({ where: { symbol: body.assetSymbol.toUpperCase() } });
    if (!asset) return fail("Unknown asset", 404);

    const bot = await prisma.bot.create({
      data: {
        userId: user.id,
        name: body.name.trim(),
        demo: true,
        assetSymbol: asset.symbol,
        strategyType: body.strategyType,
        strategyParams: JSON.stringify({ ...body.strategyParams, durationSec: body.durationSec }),
        riskParams: JSON.stringify({
          maxDailyLoss: body.maxDailyLoss,
          maxTrades: body.maxTrades,
          maxConsecutiveLosses: body.maxConsecutiveLosses,
        }),
        stake: body.stake,
      },
    });
    await prisma.botLog.create({
      data: { botId: bot.id, level: "info", message: `Bot created · strategy=${bot.strategyType} · asset=${bot.assetSymbol} · stake=$${bot.stake}` },
    });
    return ok({ bot }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

// ---- Copy trading: clone any of the user's own bots ----
const cloneSchema = z.object({
  cloneFrom: z.string().min(10),
  name: z.string().min(2).max(40).optional(),
  assetSymbol: z.string().min(3).max(16).optional(),
  stake: z.number().positive().max(1000).optional(),
});

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const body = await parseBody(req, cloneSchema);
    const source = await prisma.bot.findUnique({ where: { id: body.cloneFrom } });
    if (!source || source.userId !== user.id) return fail("Source bot not found", 404);

    const assetSymbol = (body.assetSymbol ?? source.assetSymbol).toUpperCase();
    const asset = await prisma.asset.findUnique({ where: { symbol: assetSymbol } });
    if (!asset) return fail("Unknown asset", 404);

    const copy = await prisma.bot.create({
      data: {
        userId: user.id,
        name: (body.name ?? `${source.name} (copy)`).slice(0, 40),
        demo: true,
        assetSymbol: asset.symbol,
        strategyType: source.strategyType,
        strategyParams: source.strategyParams,
        riskParams: source.riskParams,
        stake: body.stake ?? source.stake,
      },
    });
    await prisma.botLog.create({
      data: { botId: copy.id, level: "info", message: `Copied strategy from "${source.name}" (copy trading) · DEMO` },
    });
    return ok({ botId: copy.id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

const patchSchema = z.object({
  id: z.string(),
  stake: z.number().positive().max(1000).optional(),
  maxDailyLoss: z.number().positive().max(100000).optional(),
  maxTrades: z.number().int().min(1).max(500).optional(),
});

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await parseBody(req, patchSchema);
    const bot = await prisma.bot.findUnique({ where: { id: body.id } });
    if (!bot || bot.userId !== user.id) return fail("Bot not found", 404);

    const riskParams = JSON.parse(bot.riskParams || "{}");
    if (body.maxDailyLoss) riskParams.maxDailyLoss = body.maxDailyLoss;
    if (body.maxTrades) riskParams.maxTrades = body.maxTrades;

    await prisma.bot.update({
      where: { id: bot.id },
      data: { stake: body.stake ?? bot.stake, riskParams: JSON.stringify(riskParams) },
    });
    return ok({ updated: true });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return fail("Missing id", 400);
    const bot = await prisma.bot.findUnique({ where: { id } });
    if (!bot || bot.userId !== user.id) return fail("Bot not found", 404);
    if (bot.status === "running") return fail("Stop the bot before deleting it.", 409);
    await prisma.bot.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
