"use client";

import Link from "next/link";
import { ArrowRight, Bot, BarChart3, TrendingUp, Waves } from "lucide-react";

const TEMPLATES = [
  {
    icon: TrendingUp,
    name: "Reversal Scout",
    category: "Technical Analysis",
    desc: "Waits for oversold RSI conditions aligned with the EMA trend filter before taking an UP deal; mirrors the logic for DOWN.",
    markets: "Forex · Metals · Indices",
    timeframes: "1m · 5m",
    risk: "Conservative defaults: 4 consecutive-loss pause, daily stop",
  },
  {
    icon: BarChart3,
    name: "Breakout Hunter",
    category: "Breakout",
    desc: "Trades range expansions — UP when price clears a 25-candle high, DOWN when it breaks the low.",
    markets: "Crypto · Indices",
    timeframes: "1m · 5m",
    risk: "Moderate: breakout strategies whipsaw in quiet markets",
  },
  {
    icon: Waves,
    name: "Momentum Rider",
    category: "Trend Following",
    desc: "Follows directional momentum when short-term EMA crosses the longer EMA with expanding separation.",
    markets: "Forex · Commodities",
    timeframes: "5m · 15m",
    risk: "Moderate: fewer signals, longer holds",
  },
  {
    icon: Bot,
    name: "Digit Lab",
    category: "Digit Strategies",
    desc: "Educational even/odd digit strategy for exploring randomness. Demonstrates why digit patterns carry no statistical edge.",
    markets: "Demo teaching only",
    timeframes: "1 tick",
    risk: "High variance · strictly demo",
  },
];

export default function BotMarketplacePage() {
  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-bold">Bot marketplace</h1>
        <p className="text-xs text-dim mt-0.5">
          Strategy templates you can deploy as your own demo bots. Every template ships with
          configurable risk limits. No win-rate promises, no performance claims — results depend
          entirely on live market conditions.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {TEMPLATES.map((t) => (
          <div key={t.name} className="panel p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="w-9 h-9 rounded-lg bg-cyan/10 border border-cyan/20 flex items-center justify-center">
                <t.icon size={16} className="text-cyan" />
              </div>
              <span className="tag tag-demo">Demo-compatible</span>
            </div>
            <div>
              <div className="font-semibold text-[14px]">{t.name}</div>
              <div className="text-[10.5px] text-faint uppercase tracking-wide">{t.category}</div>
            </div>
            <p className="text-[12.5px] text-dim leading-relaxed">{t.desc}</p>
            <div className="text-[11px] text-faint space-y-0.5">
              <div>Markets: {t.markets}</div>
              <div>Timeframes: {t.timeframes}</div>
              <div>Risk profile: {t.risk}</div>
            </div>
            <Link href="/bots/create" className="btn btn-ghost btn-sm w-full">
              Deploy as demo bot <ArrowRight size={12} />
            </Link>
          </div>
        ))}
      </div>

      <div className="panel-2 p-4 text-[12px] text-dim">
        Marketplace listings describe strategy <em>logic</em>, not results. Backtests and demo runs
        of any template can and do lose. Nothing here is a recommendation or a profit claim.
      </div>
    </div>
  );
}
