"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Activity, BarChart3, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { fmtPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

type Analysis = {
  ready: boolean;
  message?: string;
  symbol: string;
  window: number;
  ticksAnalyzed: number;
  currentPrice?: number;
  digits?: {
    distribution: Array<{ digit: number; count: number; pct: number }>;
    evenPct: number; oddPct: number; lastDigit: number;
  };
  movement?: {
    rises: number; falls: number; risePct: number; fallPct: number;
    currentStreak: number; maxUpStreak: number; maxDownStreak: number;
  };
  indicators?: {
    rsi14: number | null; ema9: number | null; ema21: number | null; sma20: number | null;
    trendRead: string;
  };
  disclaimer: string;
};

export default function AnalysisPage() {
  const searchParams = useSearchParams();
  const { push } = useToast();
  const [symbol, setSymbol] = useState(searchParams.get("symbol") || "VOL100");
  const [windowSize, setWindowSize] = useState(1000);
  const [data, setData] = useState<Analysis | null>(null);
  const [assets, setAssets] = useState<Array<{ symbol: string; name: string; digits: number }>>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setBusy(true);
    fetch(`/api/analysis?symbol=${symbol}&window=${windowSize}`)
      .then((r) => r.json())
      .then((j) => { if (j.ok) setData(j.data); else push({ kind: "error", title: "Analysis failed", body: j.error }); })
      .catch(() => push({ kind: "error", title: "Network error" }))
      .finally(() => setBusy(false));
  }, [symbol, windowSize, push]);

  useEffect(() => {
    fetch("/api/markets").then((r) => r.json()).then((j) => { if (j.ok) setAssets(j.data.assets); }).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  const maxPct = data?.digits ? Math.max(...data.digits.distribution.map((d) => d.pct)) : 1;
  // digit with highest & lowest frequency (for highlighting like the reference)
  const hotDigit = data?.digits ? data.digits.distribution.reduce((a, b) => (b.pct > a.pct ? b : a)) : null;
  const coldDigit = data?.digits ? data.digits.distribution.reduce((a, b) => (b.pct < a.pct ? b : a)) : null;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-extrabold flex items-center gap-2">
            <Activity size={19} className="text-brand" /> AI Market Analysis
          </h1>
          <p className="text-xs text-dim mt-0.5">Statistics computed from the live simulated feed — honest numbers, no predictions.</p>
        </div>
        <div className="flex-1" />
        <select className="inp max-w-[220px]" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {assets.map((a) => <option key={a.symbol} value={a.symbol}>{a.name}</option>)}
        </select>
        <select className="inp max-w-[130px]" value={windowSize} onChange={(e) => setWindowSize(Number(e.target.value))}>
          {[100, 250, 500, 1000, 2500, 5000].map((w) => <option key={w} value={w}>{w} ticks</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={busy}>
          <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {!data && <div className="panel p-10"><div className="skel h-24" /></div>}

      {data && !data.ready && (
        <div className="panel p-10 text-center">
          <BarChart3 size={24} className="text-faint mx-auto mb-3" />
          <div className="text-[13.5px] font-bold">{data.message}</div>
          <p className="text-[12px] text-faint mt-1">The tick buffer fills as the market engine runs. Check back in a minute.</p>
        </div>
      )}

      {data?.ready && data.digits && data.movement && (
        <>
          {/* Current price */}
          <div className="panel p-5">
            <div className="text-[11px] text-faint uppercase font-bold">Current {data.symbol} price</div>
            <div className="mono text-3xl font-extrabold text-ink mt-1">{fmtPrice(data.currentPrice, 4)}</div>
            <div className="text-[11.5px] text-faint mt-1">{data.ticksAnalyzed} ticks analyzed · last digit: <strong className="text-ink">{data.digits.lastDigit}</strong></div>
          </div>

          {/* Digit distribution — circular gauges like reference */}
          <div className="panel p-5">
            <div className="text-[13.5px] font-extrabold mb-4">Last {data.ticksAnalyzed} ticks digit distribution</div>
            <div className="grid grid-cols-5 md:grid-cols-10 gap-4">
              {data.digits.distribution.map((d) => {
                const isHot = hotDigit?.digit === d.digit;
                const isCold = coldDigit?.digit === d.digit;
                return (
                  <div key={d.digit} className="flex flex-col items-center gap-1.5">
                    <div
                      className={cn(
                        "w-14 h-14 rounded-full flex flex-col items-center justify-center border-2",
                        isHot ? "bg-down text-white border-down" : isCold ? "bg-amber text-white border-amber" : "bg-panel2 border-line2",
                      )}
                    >
                      <span className="text-[16px] font-extrabold leading-none">{d.digit}</span>
                      <span className={cn("text-[9.5px] font-bold", isHot || isCold ? "text-white/85" : "text-faint")}>{d.pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-5 mt-4 text-[11px] text-dim">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-down" /> most frequent</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber" /> least frequent</span>
            </div>

            {/* Even / Odd split — reference-style buttons */}
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="rounded-lg overflow-hidden">
                <div className="bg-up text-white text-center py-2 font-extrabold text-[13.5px]">Even</div>
                <div className="bg-up/80 text-white text-center py-2.5 mono font-extrabold text-[15px]">{data.digits.evenPct}%</div>
              </div>
              <div className="rounded-lg overflow-hidden">
                <div className="bg-down text-white text-center py-2 font-extrabold text-[13.5px]">Odd</div>
                <div className="bg-down/80 text-white text-center py-2.5 mono font-extrabold text-[15px]">{data.digits.oddPct}%</div>
              </div>
            </div>
          </div>

          {/* Movement & streaks */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="panel p-5">
              <div className="text-[13.5px] font-extrabold mb-3">Rise / Fall movement</div>
              <div className="space-y-2 text-[12.5px]">
                <div className="flex justify-between"><span className="text-faint">Rising ticks</span><span className="mono font-bold text-up">{data.movement.risePct}% ({data.movement.rises})</span></div>
                <div className="h-2 rounded bg-panel2 overflow-hidden">
                  <div className="h-full bg-up" style={{ width: `${data.movement.risePct}%` }} />
                </div>
                <div className="flex justify-between"><span className="text-faint">Falling ticks</span><span className="mono font-bold text-down">{data.movement.fallPct}% ({data.movement.falls})</span></div>
                <div className="h-2 rounded bg-panel2 overflow-hidden">
                  <div className="h-full bg-down" style={{ width: `${data.movement.fallPct}%` }} />
                </div>
                <div className="flex justify-between pt-2"><span className="text-faint">Current streak</span><span className={cn("mono font-bold", data.movement.currentStreak > 0 ? "text-up" : "text-down")}>{Math.abs(data.movement.currentStreak)} {data.movement.currentStreak > 0 ? "rises" : "falls"}</span></div>
                <div className="flex justify-between"><span className="text-faint">Longest rise streak</span><span className="mono font-bold text-up">{data.movement.maxUpStreak}</span></div>
                <div className="flex justify-between"><span className="text-faint">Longest fall streak</span><span className="mono font-bold text-down">{data.movement.maxDownStreak}</span></div>
              </div>
            </div>

            <div className="panel p-5">
              <div className="text-[13.5px] font-extrabold mb-3">Indicator read</div>
              <div className="space-y-2 text-[12.5px]">
                <Row label="RSI (14)" value={data.indicators?.rsi14 != null ? String(data.indicators.rsi14) : "collecting…"} />
                <Row label="EMA 9 / EMA 21" value={data.indicators?.ema9 != null && data.indicators?.ema21 != null ? `${fmtPrice(data.indicators.ema9, 4)} / ${fmtPrice(data.indicators.ema21, 4)}` : "collecting…"} />
                <Row label="SMA 20" value={data.indicators?.sma20 != null ? fmtPrice(data.indicators.sma20, 4) : "collecting…"} />
                <div className="flex justify-between pt-1">
                  <span className="text-faint">Trend read</span>
                  <span className={cn("font-bold", data.indicators?.trendRead.startsWith("bullish") ? "text-up" : data.indicators?.trendRead.startsWith("bearish") ? "text-down" : "text-dim")}>
                    {data.indicators?.trendRead}
                  </span>
                </div>
              </div>
              <a href={`/bots/builder`} className="btn btn-primary btn-sm w-full mt-4">Trade this in the builder</a>
            </div>
          </div>

          <div className="panel-2 p-4 text-[11.5px] text-dim border-amber/30">
            {data.disclaimer}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-faint">{label}</span>
      <span className="mono font-bold text-ink">{value}</span>
    </div>
  );
}
