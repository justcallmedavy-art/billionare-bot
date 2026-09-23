import { prisma } from "@/lib/db";
import { marketEngine, roundTo } from "@/lib/market/engine";
import { ema, rsi, sma } from "@/lib/market/indicators";
import type { Bot } from "@prisma/client";

/**
 * DOLLARPRINTER bot runtime (DEMO ONLY in this build).
 *
 * REALITY LABEL: bots here trade against the simulated feed and the demo
 * ledger only. The risk manager pauses bots when limits are hit; nothing
 * in this engine can produce a "real" trade because real trading is
 * disabled until a verified broker adapter is configured.
 */

export type BotTradeType =
  | "rise_fall" | "even_odd" | "over_under" | "matches_differs" | "differs"
  | "hot_digit_differs" | "pattern_evenodd"
  | "rsi_ema" | "breakout" | "ema_cross" | "bb_touch" | "trend_follow";

export type StrategyParams = {
  tradeType?: BotTradeType;
  durationSec?: number;
  // digit strategies
  digitBarrier?: number;        // over/under barrier 0-9
  fixedSide?: "up" | "down";    // up = OVER/matches/even, down = UNDER/differs/odd
  useEntryFilter?: boolean;     // require current digit match before entry (Bullish King style)
  entryDigit?: number;          // digit to wait for
  hotWindow?: number;           // ticks tracked for hot-digit (DigitDiff: 26)
  patternLength?: number;       // ticks in even/odd pattern (Delta: 5)
  // indicator strategies
  rsiPeriod?: number;
  rsiOversold?: number;
  rsiOverbought?: number;
  emaFast?: number;
  emaSlow?: number;
  bbPeriod?: number;
  // money management
  martingale?: boolean;
  martingaleSize?: number;      // multiplier after loss
  resetOnWin?: boolean;         // reset to base stake on win (all DBot bots do this)
  baseStake?: number;
};

export type RiskParams = {
  maxDailyLoss?: number;
  maxTrades?: number;
  maxConsecutiveLosses?: number;
  maxStake?: number;
  takeProfit?: number;
};

type PlannedTrade = {
  direction: "up" | "down";
  reason: string;
  contractType: string;
  barrier: number | null;
  payoutRate: number;
};

export async function runBotOnce(bot: Bot): Promise<void> {
  if (bot.status !== "running") return;

  const params = (JSON.parse(bot.strategyParams || "{}")) as StrategyParams;
  const risk = { ...JSON.parse(bot.riskParams || "{}") } as RiskParams;
  const maxDailyLoss = risk.maxDailyLoss ?? 100;
  const maxTrades = risk.maxTrades ?? 50;
  const maxConsec = risk.maxConsecutiveLosses ?? 5;

  // ---- Risk guards: daily loss / take-profit / trade count ----
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todays = await prisma.botTrade.findMany({
    where: { botId: bot.id, status: { in: ["won", "lost"] }, closedAt: { gte: startOfDay } },
  });
  const todayPnl = todays.reduce((s, t) => s + (t.pnl ?? 0), 0);
  if (todayPnl <= -Math.abs(maxDailyLoss)) {
    await pauseBot(bot.id, "Maximum daily loss limit reached. Bot paused automatically.");
    return;
  }
  if (risk.takeProfit != null && todayPnl >= risk.takeProfit) {
    await pauseBot(bot.id, `Take-profit target reached (+$${risk.takeProfit}). Bot paused automatically.`);
    return;
  }
  if (todays.length >= maxTrades) {
    await pauseBot(bot.id, "Maximum trades per day reached. Bot paused automatically.");
    return;
  }

  const openTrades = await prisma.botTrade.count({ where: { botId: bot.id, status: "open" } });
  if (openTrades >= 3) return;

  const asset = await prisma.asset.findUnique({ where: { symbol: bot.assetSymbol } });
  if (!asset) return;
  const st = marketEngine.getState(bot.assetSymbol);
  if (!st) return;
  const candles = st.candles.slice(-60);
  const closes = candles.map((c) => c.close);

  // ---- Martingale stake (mirrors DBot after_purchase logic) ----
  let stake = bot.stake;
  if (params.martingale) {
    const lastSettled = await prisma.botTrade.findFirst({
      where: { botId: bot.id, status: { in: ["won", "lost"] } },
      orderBy: { closedAt: "desc" },
    });
    if (lastSettled?.status === "lost") {
      const mult = Math.max(1.1, params.martingaleSize ?? 2);
      stake = roundTo(lastSettled.stake * mult, 2);
    }
  }
  if (risk.maxStake != null) stake = Math.min(stake, risk.maxStake);

  // ---- Strategy evaluation ----
  const tradeType: BotTradeType = params.tradeType ??
    (bot.strategyType === "rsi_ema" ? "rsi_ema" :
     bot.strategyType === "breakout" ? "breakout" : "even_odd");

  const pip = 10 ** asset.digits;
  const ticks = st.recentTicks;
  const lastDigit = ticks.length ? Math.floor((ticks[ticks.length - 1] * pip) % 10) : null;
  const payoutBase = asset.payoutRate;

  let plan: PlannedTrade | null = null;

  if (tradeType === "even_odd") {
    if (lastDigit == null) return;
    const side = params.fixedSide ?? (lastDigit % 2 === 0 ? "up" : "down");
    plan = {
      direction: side,
      reason: `Last digit ${lastDigit} → ${side === "up" ? "EVEN" : "ODD"}`,
      contractType: "even_odd", barrier: null,
      payoutRate: payoutBase,
    };
  } else if (tradeType === "over_under") {
    if (lastDigit == null) return;
    const barrier = params.digitBarrier ?? 5;
    const side: "up" | "down" = params.fixedSide ?? (lastDigit > barrier ? "up" : "down");
    plan = {
      direction: side,
      reason: `Digit ${lastDigit} vs barrier ${barrier} → ${side === "up" ? "OVER" : "UNDER"}`,
      contractType: "over_under", barrier,
      // Extreme barriers win less often, so they pay more (profit fraction)
      payoutRate: payoutBase + (side === "up" ? Math.max(0, (barrier - 4)) * 0.15 : Math.max(0, (5 - barrier)) * 0.15),
    };
  } else if (tradeType === "matches_differs") {
    if (lastDigit == null || ticks.length < 2) return;
    const prevDigit = Math.floor((ticks[ticks.length - 2] * pip) % 10);
    const side: "up" | "down" = params.fixedSide ?? (lastDigit === prevDigit ? "up" : "down");
    plan = {
      direction: side,
      reason: `Digit ${lastDigit} ${side === "up" ? "matches" : "differs from"} previous ${prevDigit}`,
      contractType: "matches_differs", barrier: null,
      // Profit fractions: Matches ≈ +850% (1-in-10), Differs ≈ +5% (9-in-10)
      payoutRate: side === "up" ? 8.5 : 0.05,
    };
  } else if (tradeType === "differs") {
    // Bot "Over de 1%" style: always DIFFERS a fixed digit
    if (lastDigit == null) return;
    const digit = params.entryDigit ?? 0;
    plan = {
      direction: "down",
      reason: `DIFFERS ${digit} (exit digit must not be ${digit})`,
      contractType: "differs", barrier: digit,
      payoutRate: 0.08,
    };
  } else if (tradeType === "hot_digit_differs") {
    // Bot DIGITDIFF style: track last N ticks, DIFFER the most frequent digit
    const window = params.hotWindow ?? 26;
    if (ticks.length < window) return;
    const recent = ticks.slice(-window).map((p) => Math.floor((p * pip) % 10));
    const counts = new Map<number, number>();
    for (const d of recent) counts.set(d, (counts.get(d) ?? 0) + 1);
    const hot = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    plan = {
      direction: "down",
      reason: `Hot digit over last ${window} ticks: ${hot} (${counts.get(hot)} hits) → DIFFERS ${hot}`,
      contractType: "differs", barrier: hot,
      payoutRate: 0.08,
    };
  } else if (tradeType === "pattern_evenodd") {
    // Delta bot style: detect 5-tick all-even or all-odd pattern, fade it
    const plen = params.patternLength ?? 5;
    if (ticks.length < plen + 1 || lastDigit == null) return;
    const recent = ticks.slice(-plen).map((p) => Math.floor((p * pip) % 10));
    const allEven = recent.every((d) => d % 2 === 0);
    const allOdd = recent.every((d) => d % 2 === 1);
    if (!allEven && !allOdd) return; // no pattern — wait (logged, no trade)
    plan = {
      direction: allEven ? "down" : "up", // fade the pattern
      reason: `${plen}-tick ${allEven ? "ALL-EVEN" : "ALL-ODD"} pattern detected → fading with ${allEven ? "ODD" : "EVEN"}`,
      contractType: "even_odd", barrier: null,
      payoutRate: payoutBase,
    };
  } else if (tradeType === "rsi_ema" || tradeType === "ema_cross" || tradeType === "bb_touch" || tradeType === "trend_follow" || tradeType === "breakout") {
    if (candles.length < 35) return;
    if (tradeType === "rsi_ema") {
      const r = rsi(closes, params.rsiPeriod ?? 14)[closes.length - 1];
      const e = ema(closes, params.emaSlow ?? 20)[closes.length - 1];
      const price = closes[closes.length - 1];
      if (r == null || e == null) return;
      if (r < (params.rsiOversold ?? 30) && price > e) {
        plan = { direction: "up", reason: `RSI ${r.toFixed(1)} < ${(params.rsiOversold ?? 30)} AND price above EMA`, contractType: "rise_fall", barrier: null, payoutRate: payoutBase };
      } else if (r > (params.rsiOverbought ?? 70) && price < e) {
        plan = { direction: "down", reason: `RSI ${r.toFixed(1)} > ${(params.rsiOverbought ?? 70)} AND price below EMA`, contractType: "rise_fall", barrier: null, payoutRate: payoutBase };
      }
    } else if (tradeType === "ema_cross") {
      const fast = ema(closes, params.emaFast ?? 9);
      const slow = ema(closes, params.emaSlow ?? 21);
      const f1 = fast[fast.length - 1], s1 = slow[slow.length - 1];
      const f2 = fast[fast.length - 2], s2 = slow[slow.length - 2];
      if (f1 == null || s1 == null || f2 == null || s2 == null) return;
      if (f2 <= s2 && f1 > s1) plan = { direction: "up", reason: "EMA fast crossed above slow", contractType: "rise_fall", barrier: null, payoutRate: payoutBase };
      else if (f2 >= s2 && f1 < s1) plan = { direction: "down", reason: "EMA fast crossed below slow", contractType: "rise_fall", barrier: null, payoutRate: payoutBase };
    } else if (tradeType === "bb_touch") {
      const s = sma(closes, params.bbPeriod ?? 20);
      const m = s[s.length - 1];
      const win = closes.slice(-(params.bbPeriod ?? 20));
      if (m == null) return;
      const sd = Math.sqrt(win.reduce((a, v) => a + (v - m) ** 2, 0) / (params.bbPeriod ?? 20));
      const price = closes[closes.length - 1];
      if (price <= m - 2 * sd) plan = { direction: "up", reason: "Lower Bollinger touch", contractType: "rise_fall", barrier: null, payoutRate: payoutBase };
      else if (price >= m + 2 * sd) plan = { direction: "down", reason: "Upper Bollinger touch", contractType: "rise_fall", barrier: null, payoutRate: payoutBase };
    } else if (tradeType === "trend_follow") {
      const e = ema(closes, params.emaSlow ?? 20)[closes.length - 1];
      const price = closes[closes.length - 1];
      if (e == null) return;
      plan = { direction: price > e ? "up" : "down", reason: `Price ${price > e ? "above" : "below"} EMA trend filter`, contractType: "rise_fall", barrier: null, payoutRate: payoutBase };
    } else if (tradeType === "breakout") {
      const win = candles.slice(-25, -1);
      const hi = Math.max(...win.map((c) => c.high));
      const lo = Math.min(...win.map((c) => c.low));
      const price = closes[closes.length - 1];
      if (price > hi) plan = { direction: "up", reason: `Breakout above ${hi}`, contractType: "rise_fall", barrier: null, payoutRate: payoutBase };
      else if (price < lo) plan = { direction: "down", reason: `Breakout below ${lo}`, contractType: "rise_fall", barrier: null, payoutRate: payoutBase };
    }
  } else if (candles.length < 35) {
    return; // rise_fall needs history
  } else if (tradeType === "rise_fall") {
    const prev = closes[closes.length - 2];
    const last = closes[closes.length - 1];
    plan = { direction: last >= prev ? "up" : "down", reason: `Tick direction: ${last >= prev ? "rising" : "falling"}`, contractType: "rise_fall", barrier: null, payoutRate: payoutBase };
  }

  if (!plan) return;

  // Entry filter (Bullish King: only trade after seeing a specific digit, e.g. 9)
  if (params.useEntryFilter) {
    if (lastDigit !== (params.entryDigit ?? 9)) return; // wait for the setup
    plan.reason = `Entry filter: digit ${params.entryDigit ?? 9} appeared → ${plan.reason}`;
  }

  await prisma.botSignal.create({
    data: { botId: bot.id, assetId: asset.id, signal: plan.direction, price: st.price, reason: plan.reason },
  });

  // ---- Risk: consecutive losses ----
  const recent = await prisma.botTrade.findMany({
    where: { botId: bot.id, status: { in: ["won", "lost"] } },
    orderBy: { openedAt: "desc" },
    take: maxConsec,
  });
  if (recent.length === maxConsec && recent.every((t) => t.status === "lost")) {
    await pauseBot(bot.id, "Maximum consecutive losses reached. Bot paused automatically.");
    return;
  }

  // ---- Execute (demo paper execution) ----
  const entry = roundTo(st.price, asset.digits);
  const durationSec = params.durationSec ?? 60;

  await prisma.botTrade.create({
    data: {
      botId: bot.id, userId: bot.userId, demo: bot.demo,
      symbol: bot.assetSymbol, durationSec,
      kind: "fixed_time", direction: plan.direction,
      stake, payoutRate: Math.min(plan.payoutRate, 9.5),
      entryPrice: entry, status: "open",
      contractType: plan.contractType,
      barrier: plan.barrier,
    },
  });

  await prisma.botLog.createMany({
    data: [
      { botId: bot.id, level: "signal", message: `Signal ${plan.direction.toUpperCase()} — ${plan.reason}` },
      { botId: bot.id, level: "trade", message: `Order submitted · ${plan.contractType.toUpperCase()} $${stake.toFixed(2)} ${bot.assetSymbol} · ${durationSec}s · payout ${(plan.payoutRate * 100).toFixed(0)}%` },
      { botId: bot.id, level: "trade", message: `Paper fill @ ${entry} · expires ${new Date(Date.now() + durationSec * 1000).toISOString()}` },
    ],
  });
  await prisma.bot.update({
    where: { id: bot.id },
    data: { lastSignalAt: new Date(), lastTradeAt: new Date() },
  });
}

export async function pauseBot(botId: string, reason: string): Promise<void> {
  await prisma.bot.update({
    where: { id: botId },
    data: { status: "paused", pauseReason: reason },
  });
  await prisma.botLog.create({
    data: { botId, level: "warn", message: `PAUSED: ${reason}` },
  });
}
