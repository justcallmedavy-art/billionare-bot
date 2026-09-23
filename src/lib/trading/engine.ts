import { marketEngine, roundTo } from "@/lib/market/engine";
import { prisma } from "@/lib/db";
import type { Asset } from "@prisma/client";

/**
 * Demo trading engine.
 *
 * REALITY LABEL: this module executes PAPER trades against the simulated
 * feed. It never produces real transactions and never touches a wallet.
 * Balances here are demo-only and are labeled DEMO everywhere in the UI.
 */

export type OpenResult =
  | { ok: true; positionId: string; entryPrice: number }
  | { ok: false; error: string };

export async function getDemoBalance(userId: string): Promise<number> {
  const acc = await prisma.demoAccount.findUnique({ where: { userId } });
  return acc?.balance ?? 0;
}

export async function openForexPosition(input: {
  user: { id: string };
  asset: Asset;
  demo: boolean;
  side: "buy" | "sell";
  lots: 0.01 | 0.1 | 1;
  sl: number | null;
  tp: number | null;
}): Promise<OpenResult> {
  const st = marketEngine.getState(input.asset.symbol);
  if (!st) return { ok: false, error: "Market feed unavailable for this asset. Please try again." };

  const marginPerLot = 1000; // simplified fixed demo margin per 1.0 lot
  const margin = input.lots * marginPerLot;
  const balance = await getDemoBalance(input.user.id);
  if (margin > balance) {
    return { ok: false, error: "Insufficient demo margin. Reduce the position size." };
  }

  const entry = roundTo(st.price, input.asset.digits);
  const pos = await prisma.position.create({
    data: {
      userId: input.user.id,
      assetId: input.asset.id,
      demo: input.demo,
      side: input.side,
      size: input.lots,
      entryPrice: entry,
      openPrice: entry,
      currentPrice: entry,
      sl: input.sl,
      tp: input.tp,
      margin,
      status: "open",
    },
  });
  return { ok: true, positionId: pos.id, entryPrice: entry };
}

export function computeForexPnl(
  side: "buy" | "sell",
  lots: number,
  contractSize: number,
  entry: number,
  current: number,
  digits: number,
): number {
  const diff = side === "buy" ? current - entry : entry - current;
  return roundTo(diff * lots * contractSize, 2);
}

export async function closePositionById(id: string, price: number, reason: string): Promise<boolean> {
  const p = await prisma.position.findUnique({ where: { id }, include: { asset: true } });
  if (!p || p.status !== "open") return false;
  const pnl = computeForexPnl(
    p.side as "buy" | "sell",
    p.size,
    p.asset.contractSize,
    p.entryPrice,
    price,
    p.asset.digits,
  );
  await prisma.$transaction([
    prisma.position.update({
      where: { id },
      data: {
        status: "closed",
        exitPrice: price,
        currentPrice: price,
        pnl,
        closeReason: reason,
        closedAt: new Date(),
      },
    }),
    // Demo ledger: return margin and apply P/L to the demo balance.
    prisma.demoAccount.update({
      where: { userId: p.userId },
      data: { balance: { increment: p.margin + pnl } },
    }),
  ]);
  return true;
}

export async function sweepOpenPositions(): Promise<void> {
  const open = await prisma.position.findMany({ where: { status: "open", demo: true } });
  for (const p of open) {
    const asset = await prisma.asset.findUnique({ where: { id: p.assetId } });
    const st = asset ? marketEngine.getState(asset.symbol) : undefined;
    if (!asset || !st) continue;

    const current = st.price;
    let reason: string | null = null;
    if (p.sl != null) {
      const hit = p.side === "buy" ? current <= p.sl : current >= p.sl;
      if (hit) reason = "stop_loss";
    }
    if (!reason && p.tp != null) {
      const hit = p.side === "buy" ? current >= p.tp : current <= p.tp;
      if (hit) reason = "take_profit";
    }
    if (reason) await closePositionById(p.id, current, reason);
  }
}

export async function settleFixedTimeDeals(): Promise<void> {
  const due = await prisma.fixedTimeDeal.findMany({
    where: { status: "open", demo: true, expiresAt: { lte: new Date() } },
  });
  for (const d of due) {
    const asset = await prisma.asset.findUnique({ where: { id: d.assetId } });
    const st = asset ? marketEngine.getState(asset.symbol) : undefined;
    if (!asset || !st) continue;

    const exit = st.price;
    const wentUp = exit > d.entryPrice;
    const won = d.direction === "up" ? wentUp : !wentUp;
    const payout = won ? roundTo(d.stake * d.payoutRate, 2) : 0;

    await prisma.fixedTimeDeal.update({
      where: { id: d.id },
      data: {
        status: won ? "won" : "lost",
        exitPrice: exit,
        payout,
        settledAt: new Date(),
      },
    });
    // Demo ledger: stake was deducted at open; return stake + payout on a win.
    if (won) {
      await prisma.demoAccount.update({
        where: { userId: d.userId },
        data: { balance: { increment: d.stake + payout } },
      });
    }
  }
}
