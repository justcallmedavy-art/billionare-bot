"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { useFeed } from "@/components/providers/market-feed";
import { Watchlist, type AssetMeta } from "@/components/trading/watchlist";
import { OrderTicket } from "@/components/trading/order-ticket";
import { PriceChart, type ChartCandle } from "@/components/charts/price-chart";
import { fmtMoney, fmtPct, fmtPrice, pnlColor } from "@/lib/format";
import { cn } from "@/lib/cn";

type PositionRow = {
  id: string; kind: "forex" | "fixed-time"; symbol: string; side?: string; direction?: string;
  size?: number; stake?: number; entry: number; current?: number; pnl?: number | null;
  winning?: boolean; expiresAt?: string; secondsLeft?: number; margin?: number;
  sl?: number | null; tp?: number | null;
};

const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h"] as const;
const INDICATORS = ["SMA20", "EMA20", "BB"] as const;

export default function TradePage() {
  const { quotes, status } = useFeed();
  const [assets, setAssets] = useState<AssetMeta[]>([]);
  const [selected, setSelected] = useState("EURUSD");
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [chartType, setChartType] = useState<"candles" | "area">("candles");
  const [tf, setTf] = useState<(typeof TIMEFRAMES)[number]>("1m");
  const [indicators, setIndicators] = useState<Set<string>>(new Set(["EMA20"]));
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [posTab, setPosTab] = useState<"open" | "history">("open");
  const [fullscreen, setFullscreen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const asset = assets.find((a) => a.symbol === selected);
  const q = quotes.get(selected);

  useEffect(() => {
    fetch("/api/markets")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setAssets(j.data.assets); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/markets/${selected}`)
      .then((r) => r.json())
      .then((j) => { if (j.ok) setCandles(j.data.candles); })
      .catch(() => {});
  }, [selected]);

  const lastFeedSymbol = useRef<string | null>(null);
  useEffect(() => {
    if (!q || q.mid == null) return;
    if (lastFeedSymbol.current !== selected) {
      lastFeedSymbol.current = selected;
      return;
    }
    setCandles((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const last = { ...next[next.length - 1] };
      const bucket = Math.floor(Date.now() / 60000) * 60;
      if (last.time === bucket) {
        last.close = q.mid!;
        last.high = Math.max(last.high, q.mid!);
        last.low = Math.min(last.low, q.mid!);
        next[next.length - 1] = last;
      } else {
        next.push({ time: bucket, open: last.close, high: q.mid!, low: q.mid!, close: q.mid! });
        if (next.length > 720) next.shift();
      }
      return next;
    });
  }, [q?.mid, q?.serverTs, selected]);

  const loadPositions = useCallback(() => {
    fetch("/api/positions")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setPositions([...j.data.positions, ...j.data.fixedTime]); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadPositions();
    pollRef.current = setInterval(loadPositions, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadPositions]);

  const displayCandles = (() => {
    const minutes = tf === "1m" ? 1 : tf === "5m" ? 5 : tf === "15m" ? 15 : tf === "30m" ? 30 : tf === "1h" ? 60 : 240;
    if (minutes === 1) return candles;
    const out: ChartCandle[] = [];
    for (const c of candles) {
      const bucket = Math.floor(c.time / (minutes * 60)) * minutes * 60;
      const last = out[out.length - 1];
      if (last && last.time === bucket) {
        last.high = Math.max(last.high, c.high);
        last.low = Math.min(last.low, c.low);
        last.close = c.close;
      } else {
        out.push({ time: bucket, open: c.open, high: c.high, low: c.low, close: c.close });
      }
    }
    return out;
  })();

  const openPositions = positions.filter((p) => p.kind === "forex");
  const openDeals = positions.filter((p) => p.kind === "fixed-time");

  async function closePosition(id: string) {
    await fetch(`/api/trades?id=${id}`, { method: "DELETE" });
    loadPositions();
  }

  if (!asset) {
    return <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skel h-8" />)}</div>;
  }

  return (
    <div className={`grid gap-3 ${fullscreen ? "fixed inset-0 z-[80] bg-bg p-3" : "xl:grid-cols-[260px_1fr_320px]"}`}>
      {/* Watchlist */}
      <aside className={`panel overflow-hidden ${fullscreen ? "hidden" : "h-[calc(100vh-13rem)] hidden xl:flex"}`}>
        <Watchlist assets={assets} selected={selected} onSelect={setSelected} />
      </aside>

      {/* Chart column */}
      <section className="flex flex-col gap-3 min-w-0">
        {/* Asset header — light card like reference */}
        <div className="panel px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-[16px] text-ink">{asset.symbol}</span>
              <span className="tag tag-demo">Demo</span>
              <span className="text-[11px] text-faint hidden sm:inline">{asset.name}</span>
            </div>
            <div className="text-[11px] text-faint mt-0.5">
              {fmtPrice(q?.mid, asset.digits)} ·{" "}
              <span className={(q?.changePct ?? 0) >= 0 ? "text-up font-bold" : "text-down font-bold"}>
                {fmtPct(q?.changePct)}
              </span>
            </div>
          </div>
          <div className={cn("mono text-2xl font-extrabold", (q?.changePct ?? 0) >= 0 ? "text-up" : "text-down")}>
            {fmtPrice(q?.mid, asset.digits)}
          </div>
          <div className="hidden md:flex items-center gap-4 text-[11.5px] mono">
            <span className="text-faint">Bid <span className="text-down font-bold">{fmtPrice(q?.bid, asset.digits)}</span></span>
            <span className="text-faint">Ask <span className="text-up font-bold">{fmtPrice(q?.ask, asset.digits)}</span></span>
            <span className="text-faint">Spread <span className="text-ink">{fmtPrice((q?.ask ?? 0) - (q?.bid ?? 0), asset.digits)}</span></span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            {(["candles", "area"] as const).map((t) => (
              <button key={t} className={`btn btn-xs ${chartType === t ? "btn-primary" : "btn-ghost"}`} onClick={() => setChartType(t)}>
                {t === "candles" ? "Candles" : "Line"}
              </button>
            ))}
            <button className="btn btn-ghost btn-xs" onClick={() => setFullscreen((v) => !v)} aria-label="Fullscreen">
              {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          </div>
        </div>

        {/* Chart toolbar */}
        <div className="panel px-3 py-2 flex flex-wrap items-center gap-1.5">
          {TIMEFRAMES.map((t) => (
            <button key={t} className={`btn btn-xs ${tf === t ? "btn-primary" : "btn-ghost"}`} onClick={() => setTf(t)}>{t}</button>
          ))}
          <div className="w-px h-4 bg-line mx-1" />
          {INDICATORS.map((ind) => (
            <button
              key={ind}
              className={`btn btn-xs ${indicators.has(ind) ? "btn-run" : "btn-ghost"}`}
              onClick={() =>
                setIndicators((prev) => {
                  const n = new Set(prev);
                  if (n.has(ind)) n.delete(ind); else n.add(ind);
                  return n;
                })
              }
            >
              {ind}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-[10.5px] text-faint flex items-center gap-1.5">
            <span className={status === "live" ? "dot dot-live" : "dot dot-warn"} />
            {status === "live" ? "Live · simulated feed" : "Reconnecting…"}
          </span>
        </div>

        {/* Chart */}
        <div className={`panel relative overflow-hidden ${fullscreen ? "flex-1" : "h-[400px] xl:h-[460px]"}`}>
          {candles.length === 0 ? (
            <div className="absolute inset-0 p-4"><div className="skel h-full" /></div>
          ) : (
            <PriceChart
              candles={displayCandles}
              chartType={chartType}
              digits={asset.digits}
              livePrice={q?.mid ?? null}
            />
          )}
        </div>

        {/* Mobile watchlist */}
        <div className="xl:hidden panel p-2">
          <Watchlist assets={assets} selected={selected} onSelect={setSelected} compact />
        </div>

        {/* Positions — summary strip like reference right rail */}
        <div className="panel">
          <div className="flex border-b border-line overflow-x-auto">
            {([
              ["open", `Summary (${openPositions.length + openDeals.length})`],
              ["history", "Open positions"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                className={`px-4 py-2.5 text-[12.5px] font-bold border-b-2 ${
                  posTab === id ? "text-ink border-brand" : "text-dim border-transparent hover:text-ink"
                }`}
                onClick={() => setPosTab(id)}
              >
                {label}
              </button>
            ))}
            <div className="flex-1" />
            <button className="px-4 text-[11.5px] text-brand font-bold hover:underline" onClick={loadPositions}>Refresh</button>
          </div>

          <div className="overflow-x-auto max-h-60 overflow-y-auto">
            {posTab === "open" && (
              <table className="tbl">
                <thead>
                  <tr><th>Asset</th><th>Type</th><th>Side</th><th>Size / Stake</th><th>Entry</th><th>Current</th><th>P/L</th><th>Info</th><th></th></tr>
                </thead>
                <tbody>
                  {positions.length === 0 && (
                    <tr><td colSpan={9} className="text-center text-faint py-8 text-xs">No open trades. Place a demo order to see live results here.</td></tr>
                  )}
                  {openPositions.map((p) => (
                    <tr key={p.id}>
                      <td className="font-bold">{p.symbol}</td>
                      <td><span className="tag tag-demo">Demo</span></td>
                      <td className={p.side === "buy" ? "text-up font-bold" : "text-down font-bold"}>{p.side?.toUpperCase()}</td>
                      <td className="mono">{p.size}</td>
                      <td className="mono">{fmtPrice(p.entry, asset.digits)}</td>
                      <td className="mono">{fmtPrice(p.current, asset.digits)}</td>
                      <td className={cn("mono font-bold", pnlColor(p.pnl))}>{fmtMoney(p.pnl)}</td>
                      <td className="text-faint text-[11px]">SL {p.sl ? fmtPrice(p.sl, asset.digits) : "—"} / TP {p.tp ? fmtPrice(p.tp, asset.digits) : "—"}</td>
                      <td><button className="btn btn-ghost btn-xs" onClick={() => closePosition(p.id)}>Close</button></td>
                    </tr>
                  ))}
                  {openDeals.map((d) => (
                    <tr key={d.id}>
                      <td className="font-bold">{d.symbol}</td>
                      <td><span className="tag tag-demo">Fixed</span></td>
                      <td className={d.direction === "up" ? "text-up font-bold" : "text-down font-bold"}>{d.direction?.toUpperCase()}</td>
                      <td className="mono">{fmtMoney(d.stake)}</td>
                      <td className="mono">{fmtPrice(d.entry, asset.digits)}</td>
                      <td className="mono">{fmtPrice(d.current, asset.digits)}</td>
                      <td className={d.winning ? "text-up font-bold" : "text-down font-bold"}>{d.winning ? "WINNING" : "LOSING"}</td>
                      <td className="text-faint text-[11px] mono">{d.secondsLeft}s left</td>
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {posTab === "history" && <OpenPositionsNote />}
          </div>
        </div>
      </section>

      {/* Order ticket */}
      <aside className={fullscreen ? "hidden" : ""}>
        <div className="xl:sticky xl:top-40 xl:h-[calc(100vh-14.5rem)]">
          <OrderTicket asset={asset} onPlaced={loadPositions} />
        </div>
      </aside>
    </div>
  );
}

function OpenPositionsNote() {
  return (
    <div className="p-8 text-center text-xs text-faint">
      Switch to <strong className="text-dim">Summary</strong> for live open trades, or open the full{" "}
      <a className="text-brand font-bold hover:underline" href="/history">History</a> page for closed results and CSV export.
    </div>
  );
}
