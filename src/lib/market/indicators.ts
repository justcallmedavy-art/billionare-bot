export type Candle = { time: number; open: number; high: number; low: number; close: number };

export function sma(data: number[], period: number): Array<number | null> {
  const out: Array<number | null> = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) sum -= data[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

export function ema(data: number[], period: number): Array<number | null> {
  const out: Array<number | null> = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < data.length; i++) {
    if (i === period - 1) {
      prev = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
      out.push(prev);
    } else if (i >= period) {
      prev = data[i] * k + (prev as number) * (1 - k);
      out.push(prev);
    } else {
      out.push(null);
    }
  }
  return out;
}

export function rsi(data: number[], period = 14): Array<number | null> {
  const out: Array<number | null> = [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < data.length; i++) {
    if (i === 0) { out.push(null); continue; }
    const change = data[i] - data[i - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    if (i <= period) {
      avgGain = (avgGain * (i - 1) + gain) / i;
      avgLoss = (avgLoss * (i - 1) + loss) / i;
      out.push(i === period ? toRsi(avgGain, avgLoss) : null);
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      out.push(toRsi(avgGain, avgLoss));
    }
  }
  return out;
}

function toRsi(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function bollinger(data: number[], period = 20, mult = 2) {
  const mid = sma(data, period);
  const upper: Array<number | null> = [];
  const lower: Array<number | null> = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1 || mid[i] == null) { upper.push(null); lower.push(null); continue; }
    const win = data.slice(i - period + 1, i + 1);
    const m = mid[i] as number;
    const variance = win.reduce((acc, v) => acc + (v - m) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper.push(m + mult * sd);
    lower.push(m - mult * sd);
  }
  return { mid, upper, lower };
}

export function atr(candles: Candle[], period = 14): Array<number | null> {
  const out: Array<number | null> = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) { out.push(null); continue; }
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close),
    );
    const prev = out[i - 1];
    out.push(prev == null ? tr : (prev * (period - 1) + tr) / period);
  }
  return out;
}

export function macd(data: number[], fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = ema(data, fast);
  const emaSlow = ema(data, slow);
  const macdLine = data.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? (emaFast[i] as number) - (emaSlow[i] as number) : null,
  );
  const defined = macdLine.filter((v) => v != null) as number[];
  const signalOfDefined = ema(defined, signalPeriod);
  const signal: Array<number | null> = [];
  let di = 0;
  for (const v of macdLine) {
    if (v == null) { signal.push(null); continue; }
    signal.push(signalOfDefined[di]);
    di++;
  }
  const hist = macdLine.map((v, i) => (v != null && signal[i] != null ? v - (signal[i] as number) : null));
  return { macdLine, signal, hist };
}

export function stochastic(candles: Candle[], kPeriod = 14, dPeriod = 3) {
  const k: Array<number | null> = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) { k.push(null); continue; }
    const win = candles.slice(i - kPeriod + 1, i + 1);
    const hh = Math.max(...win.map((c) => c.high));
    const ll = Math.min(...win.map((c) => c.low));
    k.push(hh === ll ? 50 : ((candles[i].close - ll) / (hh - ll)) * 100);
  }
  const kDefined = k.filter((v) => v != null) as number[];
  const dOfDefined = sma(kDefined, dPeriod);
  const d: Array<number | null> = [];
  let di = 0;
  for (const v of k) {
    if (v == null) { d.push(null); continue; }
    d.push(dOfDefined[di]);
    di++;
  }
  return { k, d };
}
