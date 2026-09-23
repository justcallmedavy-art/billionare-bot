import { prisma } from "@/lib/db";
import { marketEngine, roundTo } from "@/lib/market/engine";
import { rsi, ema, sma } from "@/lib/market/indicators";
import { handleError, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/auth/server";

/**
 * Market analysis endpoint: computes honest statistics from the live
 * simulated feed — digit distribution, even/odd split, rise/fall streaks,
 * and standard indicator reads. Descriptions state what the numbers ARE;
 * they never predict or promise.
 */
export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const symbol = (searchParams.get("symbol") || "EURUSD").toUpperCase();
    const window = Math.min(Math.max(Number(searchParams.get("window") || 1000), 50), 5000);

    const asset = await prisma.asset.findUnique({ where: { symbol } });
    if (!asset) return fail("Unknown asset", 404);
    const st = marketEngine.getState(symbol);
    if (!st) return fail("Market feed unavailable for this asset.", 503);

    const ticks = st.recentTicks.slice(-window);
    if (ticks.length < 10) {
      return ok({ ready: false, message: "Collecting tick data… analysis available shortly after the feed runs." , symbol, window, ticksAnalyzed: ticks.length });
    }

    const pip = 10 ** asset.digits;
    const digits = ticks.map((p) => Math.floor((p * pip) % 10));

    // Digit distribution
    const counts = Array.from({ length: 10 }, (_, d) => digits.filter((x) => x === d).length);
    const distribution = counts.map((c, d) => ({
      digit: d,
      count: c,
      pct: roundTo((c / digits.length) * 100, 2),
    }));

    // Even/odd
    const even = digits.filter((d) => d % 2 === 0).length;
    const odd = digits.length - even;

    // Rise/fall streaks
    let rises = 0, falls = 0, currentStreak = 0, maxUpStreak = 0, maxDownStreak = 0;
    for (let i = 1; i < ticks.length; i++) {
      const up = ticks[i] > ticks[i - 1];
      if (up) rises++; else falls++;
      if (i === 1) currentStreak = up ? 1 : -1;
      else if (up && currentStreak > 0) currentStreak++;
      else if (!up && currentStreak < 0) currentStreak--;
      else currentStreak = up ? 1 : -1;
      maxUpStreak = Math.max(maxUpStreak, currentStreak > 0 ? currentStreak : 0);
      maxDownStreak = Math.min(maxDownStreak, currentStreak < 0 ? currentStreak : 0);
    }

    // Indicators over 1m closes
    const candles = st.candles.slice(-120);
    const closes = candles.map((c) => c.close);
    const rsiLast = closes.length >= 15 ? rsi(closes, 14)[closes.length - 1] : null;
    const emaFast = closes.length >= 10 ? ema(closes, 9)[closes.length - 1] : null;
    const emaSlow = closes.length >= 22 ? ema(closes, 21)[closes.length - 1] : null;
    const smaLast = closes.length >= 20 ? sma(closes, 20)[closes.length - 1] : null;
    const price = ticks[ticks.length - 1];

    return ok({
      ready: true,
      symbol,
      window,
      ticksAnalyzed: ticks.length,
      currentPrice: price,
      digits: { distribution, evenPct: roundTo((even / digits.length) * 100, 2), oddPct: roundTo((odd / digits.length) * 100, 2), lastDigit: digits[digits.length - 1] },
      movement: {
        rises, falls,
        risePct: roundTo((rises / (ticks.length - 1)) * 100, 2),
        fallPct: roundTo((falls / (ticks.length - 1)) * 100, 2),
        currentStreak, maxUpStreak, maxDownStreak: Math.abs(maxDownStreak),
      },
      indicators: {
        rsi14: rsiLast != null ? roundTo(rsiLast, 1) : null,
        ema9: emaFast, ema21: emaSlow, sma20: smaLast,
        trendRead:
          emaFast != null && emaSlow != null
            ? emaFast > emaSlow ? "bullish (EMA9 > EMA21)" : "bearish (EMA9 < EMA21)"
            : "collecting candle history…",
      },
      disclaimer:
        "Statistics describe the selected historical tick sample on the simulated feed. They do not predict future ticks, and no pattern here implies an edge.",
    });
  } catch (e) {
    return handleError(e);
  }
}
