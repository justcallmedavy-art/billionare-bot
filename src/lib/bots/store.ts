/**
 * Bot Store templates — ported from the user's Deriv DBot XML strategies,
 * rewritten for the simulated feed and demo ledger.
 *
 * These are strategy CONFIGURATIONS, not performance claims: no win rates,
 * no profit promises, no reviews. Each deploys as the user's own demo bot
 * with mandatory risk limits.
 */

export type StoreBot = {
  slug: string;
  name: string;
  origin: string;
  category: "Digits" | "Trend" | "Reversal" | "Breakout" | "Volatility";
  description: string;
  strategyType: "rsi_ema" | "breakout" | "digit_evenodd";
  tradeType:
    | "rise_fall" | "even_odd" | "over_under" | "matches_differs" | "differs"
    | "hot_digit_differs" | "pattern_evenodd"
    | "rsi_ema" | "breakout" | "ema_cross" | "bb_touch" | "trend_follow";
  suggestedAsset: string;
  durationSec: number;
  digitBarrier?: number;
  entryDigit?: number;
  useEntryFilter?: boolean;
  fixedSide?: "up" | "down";
  martingale?: boolean;
  martingaleSize?: number;
  hotWindow?: number;
  patternLength?: number;
  risk: { maxDailyLoss: number; maxTrades: number; maxConsecutiveLosses: number; takeProfit?: number };
  riskNote: string;
};

export const STORE_BOTS: StoreBot[] = [
  // ---- Ported from user's DBot XML files ----
  {
    slug: "primed-over4",
    name: "PrimeD Over-4",
    origin: "Ported from PrimeDbot.xml",
    category: "Digits",
    description:
      "Always trades OVER barrier 4 (wins when the exit digit is 5-9) with a 2.1x martingale after losses and stake reset on win. Faithful port of the original 0.35-stake, 1-tick design.",
    strategyType: "digit_evenodd",
    tradeType: "over_under",
    digitBarrier: 4,
    fixedSide: "up",
    martingale: true,
    martingaleSize: 2.1,
    suggestedAsset: "VOL100",
    durationSec: 60,
    risk: { maxDailyLoss: 25, maxTrades: 40, maxConsecutiveLosses: 5, takeProfit: 20 },
    riskNote: "OVER 4 wins ~50% of the time; the 2.1x martingale escalates stakes after each loss. Daily-loss pause is mandatory.",
  },
  {
    slug: "digitdiff-hot",
    name: "DigitDiff Hot-26",
    origin: "Ported from Bot DIGITDIFF P.xml",
    category: "Digits",
    description:
      "Tracks the last 26 ticks, finds the most frequent digit, and trades DIFFERS against it. One-tick contracts with a max-error guard — the port runs the hot-digit scan continuously.",
    strategyType: "digit_evenodd",
    tradeType: "hot_digit_differs",
    hotWindow: 26,
    suggestedAsset: "VOL100",
    durationSec: 60,
    risk: { maxDailyLoss: 25, maxTrades: 40, maxConsecutiveLosses: 5 },
    riskNote: "DIFFERS pays ~8% and loses only when the hot digit repeats — but streaks of repeats happen and stack losses.",
  },
  {
    slug: "over1-recovery",
    name: "Over-1 Recovery",
    origin: "Ported from Bot Over de 1% 23% dobra 4,5.xml",
    category: "Digits",
    description:
      "Fixed OVER 1 contract: wins when the exit digit is 2-9. Original watches a rolling digit window and trades after confirming the modal digit; the port trades the fixed side with a loss-count stake ladder.",
    strategyType: "digit_evenodd",
    tradeType: "over_under",
    digitBarrier: 1,
    fixedSide: "up",
    suggestedAsset: "VOL100",
    durationSec: 60,
    risk: { maxDailyLoss: 25, maxTrades: 40, maxConsecutiveLosses: 6, takeProfit: 20 },
    riskNote: "OVER 1 loses whenever the exit digit is 0 or 1 (~20% of ticks) — expect regular loss runs.",
  },
  {
    slug: "bullish-king",
    name: "Bullish King Digit-9",
    origin: "Ported from Bullishking 23_10_2020.xml",
    category: "Digits",
    description:
      "Waits for the last digit to print 9, then buys OVER 0 (wins unless the exit digit is exactly 0). Original multiplies the stake 11x after a loss; the port keeps a capped martingale for safety.",
    strategyType: "digit_evenodd",
    tradeType: "over_under",
    digitBarrier: 0,
    fixedSide: "up",
    useEntryFilter: true,
    entryDigit: 9,
    martingale: true,
    martingaleSize: 2.0,
    suggestedAsset: "VOL100",
    durationSec: 60,
    risk: { maxDailyLoss: 25, maxTrades: 30, maxConsecutiveLosses: 4 },
    riskNote: "Loses only when exit digit is 0 (~10%), but the original 11x multiplier could devastate an account during a zero streak. The port caps escalation and pauses early.",
  },
  {
    slug: "delta-pattern",
    name: "Delta Pattern Fade",
    origin: "Ported from Delta_EvenOdd Bot.xml",
    category: "Digits",
    description:
      "Encodes the last 5 digits as an even/odd pattern; when all five match (e.g. 22222), fades it with the opposite side. Mirrors the original 11111/22222 purchase conditions.",
    strategyType: "digit_evenodd",
    tradeType: "pattern_evenodd",
    patternLength: 5,
    suggestedAsset: "VOL100",
    durationSec: 60,
    risk: { maxDailyLoss: 20, maxTrades: 40, maxConsecutiveLosses: 5, takeProfit: 15 },
    riskNote: "5-digit streaks are rare (~3% of windows), so trades fire infrequently. Fading streaks has no statistical edge.",
  },
  // ---- Original analytical templates ----
  {
    slug: "even-steady",
    name: "Even Steady V1",
    origin: "Original template",
    category: "Digits",
    description:
      "Reads the last digit of each tick and trades Even when the previous digit was even, Odd when odd — a simple pattern-follower for learning digit behavior.",
    strategyType: "digit_evenodd",
    tradeType: "even_odd",
    suggestedAsset: "VOL100",
    durationSec: 60,
    risk: { maxDailyLoss: 20, maxTrades: 40, maxConsecutiveLosses: 5 },
    riskNote: "Digit outcomes are near-random. This bot demonstrates variance, not an edge.",
  },
  {
    slug: "martingale-recovery",
    name: "Martingale Recovery (Caution)",
    origin: "Original template",
    category: "Digits",
    description:
      "Even/Odd reader that increases the stake after each loss (martingale) to attempt recovery. Includes hard daily-loss and consecutive-loss pauses.",
    strategyType: "digit_evenodd",
    tradeType: "even_odd",
    martingale: true,
    martingaleSize: 2,
    suggestedAsset: "VOL100",
    durationSec: 60,
    risk: { maxDailyLoss: 25, maxTrades: 30, maxConsecutiveLosses: 4, takeProfit: 15 },
    riskNote: "Martingale can escalate stakes quickly. Loss limits are mandatory and enforced server-side.",
  },
  {
    slug: "matches-fade",
    name: "Matches Fade",
    origin: "Original template",
    category: "Digits",
    description:
      "Trades DIFFERS after two consecutive equal digits, betting the run won't continue. High-payout, high-frequency loss profile.",
    strategyType: "digit_evenodd",
    tradeType: "matches_differs",
    fixedSide: "down",
    suggestedAsset: "VOL100",
    durationSec: 60,
    risk: { maxDailyLoss: 20, maxTrades: 40, maxConsecutiveLosses: 5 },
    riskNote: "DIFFERS wins ~90% but pays ~8% — a single loss wipes many small wins.",
  },
  {
    slug: "rsi-reversal",
    name: "RSI Reversal Scout",
    origin: "Original template",
    category: "Reversal",
    description:
      "Waits for oversold RSI aligned with the EMA trend filter before taking UP deals; mirrors for DOWN. Fewer, filtered signals.",
    strategyType: "rsi_ema",
    tradeType: "rsi_ema",
    suggestedAsset: "EURUSD",
    durationSec: 300,
    risk: { maxDailyLoss: 25, maxTrades: 30, maxConsecutiveLosses: 4 },
    riskNote: "Reversal strategies can signal early in strong trends.",
  },
  {
    slug: "ema-momentum",
    name: "EMA Momentum Rider",
    origin: "Original template",
    category: "Trend",
    description:
      "Follows directional momentum when the fast EMA crosses the slow EMA. Designed for trending markets.",
    strategyType: "rsi_ema",
    tradeType: "ema_cross",
    suggestedAsset: "BTCUSD",
    durationSec: 300,
    risk: { maxDailyLoss: 30, maxTrades: 25, maxConsecutiveLosses: 4 },
    riskNote: "Cross strategies whipsaw in ranging markets.",
  },
  {
    slug: "bb-fade",
    name: "Bollinger Band Fade",
    origin: "Original template",
    category: "Volatility",
    description:
      "Takes UP deals when price touches the lower band and DOWN at the upper band — a mean-reversion approach.",
    strategyType: "rsi_ema",
    tradeType: "bb_touch",
    suggestedAsset: "XAUUSD",
    durationSec: 300,
    risk: { maxDailyLoss: 25, maxTrades: 30, maxConsecutiveLosses: 4 },
    riskNote: "Mean reversion loses in strong breakouts.",
  },
  {
    slug: "range-breakout",
    name: "Range Breakout Hunter",
    origin: "Original template",
    category: "Breakout",
    description:
      "Trades UP when price clears the 25-candle high, DOWN when it breaks the low. Momentum entry on range expansion.",
    strategyType: "breakout",
    tradeType: "breakout",
    suggestedAsset: "NAS100",
    durationSec: 300,
    risk: { maxDailyLoss: 30, maxTrades: 25, maxConsecutiveLosses: 4 },
    riskNote: "Breakouts fail frequently in quiet sessions.",
  },
  {
    slug: "tick-surfer",
    name: "Tick Surfer",
    origin: "Original template",
    category: "Trend",
    description:
      "Pure tick-direction follower: UP after an up-tick, DOWN after a down-tick. Maximum trade frequency for testing ideas.",
    strategyType: "rsi_ema",
    tradeType: "rise_fall",
    suggestedAsset: "VOL100",
    durationSec: 60,
    risk: { maxDailyLoss: 20, maxTrades: 50, maxConsecutiveLosses: 5 },
    riskNote: "High-frequency tick following generates many small losses in choppy feeds.",
  },
];
