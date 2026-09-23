import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { parseBody, handleError, ok, fail } from "@/lib/api";
import { orderSchema } from "@/lib/validation/schemas";
import { openForexPosition, getDemoBalance, closePositionById } from "@/lib/trading/engine";
import { marketEngine, roundTo } from "@/lib/market/engine";
import { rateLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/client-ip";
import type { Asset } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const rl = rateLimit(`trade:${user.id}`, 30, 10_000);
    if (!rl.allowed) return fail("Slow down — too many orders in a short window.", 429);

    const body = await parseBody(req, orderSchema);
    if (!body.demo) {
      return fail(
        "Real-money trading is not enabled on this deployment until a broker adapter is configured and verified. No simulated real trades are executed.",
        501,
      );
    }

    const asset = await prisma.asset.findUnique({ where: { symbol: body.symbol.toUpperCase() } });
    if (!asset) return fail("Unknown asset", 404);

    if (body.mode === "forex") {
      const result = await openForexPosition({
        user,
        asset,
        demo: true,
        side: body.side,
        lots: body.lots as 0.01 | 0.1 | 1,
        sl: body.sl ?? null,
        tp: body.tp ?? null,
      });
      if (!result.ok) return fail(result.error, 400);

      await prisma.demoAccount.update({
        where: { userId: user.id },
        data: { balance: { decrement: body.lots * 1000 } },
      });
      await prisma.notification.create({
        data: {
          userId: user.id, type: "trade",
          title: "Position opened",
          body: `${body.side.toUpperCase()} ${body.lots} ${asset.symbol} @ ${result.entryPrice}`,
        },
      });
      return ok({ kind: "position", id: result.positionId, entryPrice: result.entryPrice }, { status: 201 });
    }

    // ---- Fixed-time deal ----
    const balance = await getDemoBalance(user.id);
    if (body.stake > balance) return fail("Insufficient demo balance for this stake.", 400);

    const st = marketEngine.getState(asset.symbol);
    if (!st) return fail("Market feed unavailable for this asset.", 503);
    const entry = roundTo(st.price, asset.digits);
    const deal = await prisma.fixedTimeDeal.create({
      data: {
        userId: user.id,
        assetId: asset.id,
        demo: true,
        direction: body.direction,
        stake: body.stake,
        durationSec: body.durationSec,
        payoutRate: asset.payoutRate,
        entryPrice: entry,
        status: "open",
        expiresAt: new Date(Date.now() + body.durationSec * 1000),
      },
    });
    await prisma.demoAccount.update({
      where: { userId: user.id },
      data: { balance: { decrement: body.stake } },
    });
    await prisma.notification.create({
      data: {
        userId: user.id, type: "trade",
        title: "Fixed-time deal placed",
        body: `${body.direction.toUpperCase()} ${asset.symbol} $${body.stake} · settles ${new Date(Date.now() + body.durationSec * 1000).toLocaleTimeString()}`,
      },
    });
    return ok(
      { kind: "fixed-time", id: deal.id, entryPrice: entry, expiresAt: deal.expiresAt, payoutRate: asset.payoutRate },
      { status: 201 },
    );
  } catch (e) {
    return handleError(e);
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const kind = searchParams.get("kind");
    const limit = Math.min(Number(searchParams.get("limit") || 100), 500);

    const positions = await prisma.position.findMany({
      where: { userId: user.id, ...(status ? { status } : {}), demo: true },
      include: { asset: true },
      orderBy: { openedAt: "desc" },
      take: kind === "fixed-time" ? 0 : limit,
    });
    const deals = await prisma.fixedTimeDeal.findMany({
      where: { userId: user.id, ...(status ? { status } : {}), demo: true },
      include: { asset: true },
      orderBy: { openedAt: "desc" },
      take: kind === "forex" ? 0 : limit,
    });

    return ok({
      positions: positions.map((p) => ({
        id: p.id, kind: "forex", demo: p.demo, symbol: p.asset.symbol, side: p.side,
        size: p.size, entry: p.entryPrice, exit: p.exitPrice, sl: p.sl, tp: p.tp,
        pnl: p.pnl, status: p.status, closeReason: p.closeReason,
        openedAt: p.openedAt, closedAt: p.closedAt,
      })),
      fixedTime: deals.map((d) => ({
        id: d.id, kind: "fixed-time", demo: d.demo, symbol: d.asset.symbol, direction: d.direction,
        stake: d.stake, payoutRate: d.payoutRate, payout: d.payout, entry: d.entryPrice,
        exit: d.exitPrice, status: d.status, openedAt: d.openedAt, expiresAt: d.expiresAt, settledAt: d.settledAt,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request) {
  // Manual close of a forex position: /api/trades?id=...&action=close
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return fail("Missing position id", 400);

    const pos = await prisma.position.findUnique({ where: { id }, include: { asset: true } });
    if (!pos || pos.userId !== user.id) return fail("Position not found", 404);
    if (pos.status !== "open") return fail("Position already closed", 409);

    const st = marketEngine.getState(pos.asset.symbol);
    if (!st) return fail("Market feed unavailable — cannot price this position right now.", 503);

    const price = pos.side === "buy" ? st.bid ?? st.price : st.ask ?? st.price;
    await closePositionById(pos.id, price, "manual");
    await prisma.notification.create({
      data: { userId: user.id, type: "trade", title: "Position closed", body: `${pos.asset.symbol} closed @ ${price}` },
    });
    return ok({ closed: true });
  } catch (e) {
    return handleError(e);
  }
}
