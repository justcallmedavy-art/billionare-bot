import type { MarketEngine } from "@/lib/market/engine";
import { marketEngine } from "@/lib/market/engine";

/**
 * Provider adapters. A "simulated" provider powers the demo environment and
 * is always clearly labeled as such in the UI. REAL-money trading requires a
 * real broker adapter (e.g. a licensed brokerage API). Until one is configured,
 * real trading is disabled end-to-end and the UI says so explicitly — no fake
 * real trades are ever produced.
 */

export type ProviderInfo = {
  id: "simulated" | "deriv" | "broker-adapter";
  label: string;
  simulated: boolean;
};

export type MarketData = {
  getSnapshot(): ReturnType<MarketEngine["snapshot"]>;
  getCandles(symbol: string, count: number): Array<{ time: number; open: number; high: number; low: number; close: number }>;
};

export const marketDataProvider: MarketData = {
  getSnapshot: () => marketEngine.snapshot(),
  getCandles: (symbol, count) => {
    const st = marketEngine.getState(symbol);
    if (!st) return [];
    return st.candles.slice(-count);
  },
};

export function getProviderInfo(): ProviderInfo {
  const broker = process.env.BROKER_PROVIDER || "none";
  if (broker === "none" || broker === "") {
    return { id: "simulated", label: "Simulated Feed (Demo)", simulated: true };
  }
  // Real adapters plug in here. Keep them server-side only.
  return { id: "deriv", label: "Live Broker Feed", simulated: false };
}

export const REAL_TRADING_ENABLED =
  process.env.BROKER_PROVIDER !== "none" && !!process.env.BROKER_API_URL;
