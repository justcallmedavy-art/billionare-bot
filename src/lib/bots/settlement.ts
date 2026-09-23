import { prisma } from "@/lib/db";
import { marketEngine } from "@/lib/market/engine";
import type { BotTrade } from "@prisma/client";

/**
 * Settles open fixed-time bot trades. Demo ledger only.
 * Payout model: a win returns stake * payoutRate (profit = stake * (payoutRate - 1)).
 * The exit spot is the real simulated tick at expiry — never forced to win or lose.
 */

function lastDigitOf(price: number, digits: number): number {
  return Math.floor((price * 10 ** digits) % 10);
}

function evaluateContract(
  trade: BotTrade,
  exitPrice: number,
  digits: number
): { won: boolean; detail: string } {
  const exitDigit = lastDigitOf(exitPrice, digits);
  const side = trade.direction; // "up" | "down"
  const type = trade.contractType ?? "rise_fall";

  switch (type) {
    case "rise_fall": {
      const entry = trade.entryPrice;
      const won = side === "up" ? exitPrice > entry : exitPrice < entry;
      return { won, detail: `exit ${exitPrice} vs entry ${entry}` };
    }
    case "even_odd": {
      const isEven = exitDigit % 2 === 0;
      const won = side === "up" ? isEven : !isEven;
      return { won, detail: `exit digit ${exitDigit} (${isEven ? "even" : "odd"})` };
    }
    case "over_under": {
      const barrier = trade.barrier ?? 5;
      const won = side === "up" ? exitDigit > barrier : exitDigit < barrier;
      return { won, detail: `exit digit ${exitDigit} vs barrier ${barrier} (${side === "up" ? "over" : "under"})` };
    }
    case "matches_differs":
    case "differs": {
      const barrier = trade.barrier ?? 0;
      const won = type === "differs" ? exitDigit !== barrier : (side === "up" ? exitDigit === barrier : exitDigit !== barrier);
      const label = type === "differs" ? "differs" : side === "up" ? "matches" : "differs";
      return { won, detail: `exit digit ${exitDigit} ${label} ${barrier}` };
    }
    default: {
      const entry = trade.entryPrice;
      const won = side === "up" ? exitPrice > entry : exitPrice < entry;
      return { won, detail: `exit ${exitPrice} vs entry ${entry}` };
    }
  }
}

export async function settleBotTrade(trade: BotTrade): Promise<void> {
  if (trade.status !== "open") return;

  const asset = await prisma.asset.findUnique({ where: { symbol: trade.symbol } });
  if (!asset) return;

  const st = marketEngine.getState(trade.symbol);
  if (!st || st.recentTicks.length === 0) return; // no feed — do not fabricate a result

  const exitPrice = st.recentTicks[st.recentTicks.length - 1];
  const { won, detail } = evaluateContract(trade, exitPrice, asset.digits);

  // payoutRate is the PROFIT fraction on a win (e.g. 0.95 = +95%).
  const pnl = won ? round2(trade.stake * trade.payoutRate) : -trade.stake;

  await prisma.botTrade.update({
    where: { id: trade.id },
    data: {
      status: won ? "won" : "lost",
      exitPrice,
      payout: won ? round2(trade.stake * (1 + trade.payoutRate)) : 0,
      pnl,
      closedAt: new Date(),
    },
  });

  // Keep the bot row's aggregate counters in sync (immutable per-trade records stay untouched).
  await prisma.bot.update({
    where: { id: trade.botId },
    data: {
      tradeCount: { increment: 1 },
      winCount: won ? { increment: 1 } : undefined,
      lossCount: won ? undefined : { increment: 1 },
      pnl: { increment: pnl },
    },
  });

  await prisma.botLog.create({
    data: {
      botId: trade.botId,
      level: won ? "trade" : "warn",
      message: `Contract ${won ? "WON" : "LOST"} — ${detail} · P/L ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`,
    },
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function settleBotTrades(): Promise<void> {
  const open = await prisma.botTrade.findMany({
    where: { status: "open", kind: "fixed_time" },
  });
  const now = Date.now();
  for (const trade of open) {
    const expiry = trade.openedAt.getTime() + (trade.durationSec ?? 60) * 1000;
    if (now >= expiry) {
      await settleBotTrade(trade);
    }
  }
}
