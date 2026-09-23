// Market data engine — SIMULATED feed for the DEMO environment.
//
// REALITY LABEL: every price produced here is simulated. When a real
// provider adapter is configured (src/lib/providers), real feeds replace
// this engine for REAL trading — the two are never mixed.
//
// Architecture:
//   GBM tick generator -> 1m candle series -> per-symbol subscribers
//   -> SSE fan-out in /api/market/stream

export type Tick = {
  symbol: string;
  bid: number;
  ask: number;
  mid: number;
  serverTs: number; // wall clock ms
};

export type Candle = { time: number; open: number; high: number; low: number; close: number };

const BUCKET_MS = 60_000; // 1-minute candles

export class SymbolState {
  symbol: string;
  digits: number;
  volatility: number;
  spreadRel: number;
  price: number;
  dayOpen: number;
  candles: Candle[] = [];
  recentTicks: number[] = []; // rolling mid-price buffer for digit/statistics analysis
  subscribers = new Set<(t: Tick) => void>();

  get mid(): number {
    return roundTo(this.price, this.digits);
  }

  get bid(): number {
    return roundTo(this.price - (this.price * this.spreadRel) / 2, this.digits);
  }

  get ask(): number {
    return roundTo(this.price + (this.price * this.spreadRel) / 2, this.digits);
  }

  constructor(opts: {
    symbol: string; digits: number; volatility: number;
    basePrice: number; spreadRel: number;
  }) {
    this.symbol = opts.symbol;
    this.digits = opts.digits;
    this.volatility = opts.volatility;
    this.spreadRel = opts.spreadRel;
    this.price = opts.basePrice;
    this.dayOpen = opts.basePrice;
  }

  tick(now: number): Tick {
    // Small random walk with gentle mean-reversion toward the day open.
    const pull = (this.dayOpen - this.price) * 0.0008;
    const shock = this.volatility * gauss();
    this.price = Math.max(this.price + pull + shock, this.volatility * 10);

    const spread = this.price * this.spreadRel;
    const tick: Tick = {
      symbol: this.symbol,
      bid: roundTo(this.price - spread / 2, this.digits),
      ask: roundTo(this.price + spread / 2, this.digits),
      mid: roundTo(this.price, this.digits),
      serverTs: now,
    };

    // Rolling tick buffer for digit/statistics analysis (cap ~100 min)
    this.recentTicks.push(tick.mid);
    if (this.recentTicks.length > 6000) this.recentTicks.shift();

    // Update 1m candle series
    const bucket = Math.floor(now / BUCKET_MS) * BUCKET_MS;
    const last = this.candles[this.candles.length - 1];
    if (last && last.time === Math.floor(bucket / 1000)) {
      last.close = tick.mid;
      last.high = Math.max(last.high, tick.mid);
      last.low = Math.min(last.low, tick.mid);
    } else {
      this.candles.push({
        time: Math.floor(bucket / 1000),
        open: last ? last.close : tick.mid,
        high: tick.mid,
        low: tick.mid,
        close: tick.mid,
      });
      if (this.candles.length > 720) this.candles.shift(); // 12h of 1m candles
    }
    return tick;
  }

  changePct(): number {
    return this.dayOpen > 0 ? ((this.price - this.dayOpen) / this.dayOpen) * 100 : 0;
  }
}

export class MarketEngine {
  states = new Map<string, SymbolState>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private globalSubscribers = new Set<() => void>();

  register(symbol: string, digits: number, volatility: number, basePrice: number, spreadRel: number) {
    if (this.states.has(symbol)) return;
    this.states.set(symbol, new SymbolState({ symbol, digits, volatility, basePrice, spreadRel }));
  }

  ensureStarted() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const now = Date.now();
      for (const s of this.states.values()) {
        const tick = s.tick(now);
        for (const fn of s.subscribers) {
          try { fn(tick); } catch { /* subscriber errors must not kill the feed */ }
        }
      }
      for (const fn of this.globalSubscribers) {
        try { fn(); } catch { /* ignore */ }
      }
    }, 1000);
    // Don't hold the process open on server shutdown
    (this.timer as unknown as { unref?: () => void }).unref?.();
  }

  onGlobalTick(fn: () => void): () => void {
    this.ensureStarted();
    this.globalSubscribers.add(fn);
    return () => this.globalSubscribers.delete(fn);
  }

  getState(symbol: string): SymbolState | undefined {
    this.ensureStarted();
    return this.states.get(symbol);
  }

  snapshot() {
    this.ensureStarted();
    const out: Array<{
      symbol: string; bid: number; ask: number; mid: number;
      changePct: number; digits: number; serverTs: number;
    }> = [];
    for (const s of this.states.values()) {
      const spread = s.price * s.spreadRel;
      out.push({
        symbol: s.symbol,
        bid: roundTo(s.price - spread / 2, s.digits),
        ask: roundTo(s.price + spread / 2, s.digits),
        mid: roundTo(s.price, s.digits),
        changePct: roundTo(s.changePct(), 3),
        digits: s.digits,
        serverTs: Date.now(),
      });
    }
    return out;
  }
}

function gauss(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function roundTo(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

// Singleton per server process
const g = globalThis as unknown as { __bdoMarketEngine?: MarketEngine };
export const marketEngine: MarketEngine = g.__bdoMarketEngine ?? new MarketEngine();
g.__bdoMarketEngine = marketEngine;
