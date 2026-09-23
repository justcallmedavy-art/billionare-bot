"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronUp, ChevronDown, Search, Play, Square, RotateCcw, Trash2,
  FileCode, FolderOpen, Save, BarChart3, LayoutGrid, LineChart as LineIcon, TrendingUp,
  Zap, Layers, RefreshCw, ZoomIn, ZoomOut, Download, Eye, Bot, Flame, Wrench, Info,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/providers/auth";
import { ConfirmModal } from "@/components/ui/modal";
import { fmtMoney, fmtDateTime, pnlColor } from "@/lib/format";
import { cn } from "@/lib/cn";

/* ---------------- Types ---------------- */

type Asset = { symbol: string; name: string; category: string; digits: number; payoutRate: number };
type TradeType = "rise_fall" | "even_odd" | "over_under" | "matches_differs" | "rsi_ema" | "breakout" | "ema_cross" | "bb_touch" | "trend_follow";

type BlockId =
  | "trade-params" | "run-once" | "purchase-conditions" | "restart-conditions";

type Tx = {
  id: string; direction: string; stake: number; entryPrice: number;
  exitPrice: number | null; pnl: number | null; payout?: number | null;
  status: string; closedAt: string | null;
};

const TRADE_TYPES: Array<{ id: TradeType; label: string; needsBarrier?: boolean }> = [
  { id: "rise_fall", label: "Rise/Fall" },
  { id: "even_odd", label: "Even/Odd" },
  { id: "over_under", label: "Over/Under", needsBarrier: true },
  { id: "matches_differs", label: "Matches/Differs" },
  { id: "rsi_ema", label: "RSI + EMA Reversal" },
  { id: "ema_cross", label: "EMA Crossover" },
  { id: "bb_touch", label: "Bollinger Touch" },
  { id: "breakout", label: "Range Breakout" },
  { id: "trend_follow", label: "Trend Follow" },
];

const DIGIT_ASSETS = ["VOL100", "VOL75", "VOL50", "VOL25", "VOL10"];

export default function BotBuilderPage() {
  const { account, refresh } = useAuth();
  const { push } = useToast();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [menuOpen, setMenuOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [utilityOpen, setUtilityOpen] = useState(false);

  // canvas blocks state
  const [blocks, setBlocks] = useState<BlockId[]>(["trade-params", "run-once"]);
  const [running, setRunning] = useState(false);
  const [botId, setBotId] = useState<string | null>(null);
  const [confirmRun, setConfirmRun] = useState(false);

  // trade params
  const [market, setMarket] = useState("VOL100");
  const [tradeType, setTradeType] = useState<TradeType>("even_odd");
  const [barrier, setBarrier] = useState(5);
  const [duration, setDuration] = useState(60);
  const [restartOnError, setRestartOnError] = useState(true);

  // run once (money management)
  const [stake, setStake] = useState(2.5);
  const [martingale, setMartingale] = useState(false);
  const [martingaleSize, setMartingaleSize] = useState(2);
  const [stopLoss, setStopLoss] = useState(25);
  const [maxTrades, setMaxTrades] = useState(40);
  const [maxConsec, setMaxConsec] = useState(4);
  const [takeProfit, setTakeProfit] = useState(20);

  // right rail
  const [tab, setTab] = useState<"summary" | "transactions" | "journal">("summary");
  const [txs, setTxs] = useState<Tx[]>([]);
  const [journal, setJournal] = useState<Array<{ id: string; message: string; createdAt: string; level: string }>>([]);
  const [summary, setSummary] = useState({ runs: 0, won: 0, lost: 0, stake: 0, payout: 0, pnl: 0 });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/markets")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setAssets(j.data.assets); })
      .catch(() => {});
  }, []);

  const loadData = useCallback(() => {
    if (!botId) return;
    fetch(`/api/bots/${botId}/logs`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return;
        setJournal(j.data.logs.slice(0, 60).reverse());
        setSummary({
          runs: j.data.bot.tradeCount, won: j.data.bot.winCount, lost: j.data.bot.lossCount,
          stake: 0, payout: 0, pnl: j.data.bot.pnl,
        });
      })
      .catch(() => {});
    fetch(`/api/bots/${botId}/trades`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setTxs(j.data.trades.slice(0, 30));
          setSummary((s) => {
            const totalStake = j.data.trades.reduce((a: number, t: Tx) => a + t.stake, 0);
            const totalPayout = j.data.trades.reduce((a: number, t: Tx) => a + (t.payout ?? 0), 0);
            return { ...s, stake: totalStake, payout: totalPayout };
          });
        }
      })
      .catch(() => {});
  }, [botId]);

  useEffect(() => {
    loadData();
    if (botId) {
      pollRef.current = setInterval(loadData, 4000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
  }, [loadData, botId]);

  const needsBarrier = TRADE_TYPES.find((t) => t.id === tradeType)?.needsBarrier;
  const isDigitStrategy = ["even_odd", "over_under", "matches_differs"].includes(tradeType);

  function addBlock(id: BlockId) {
    setBlocks((b) => (b.includes(id) ? b : [...b, id]));
  }

  async function handleRun() {
    const balance = account?.demo.balance ?? 0;
    if (stake > balance) {
      push({ kind: "error", title: "Insufficient demo balance", body: `Stake $${stake} exceeds $${balance}.` });
      return;
    }
    setConfirmRun(true);
  }

  async function reallyRun() {
    setConfirmRun(false);
    try {
      // Determine strategy buckets
      const strategyType = isDigitStrategy ? "digit_evenodd" : tradeType === "breakout" ? "breakout" : "rsi_ema";
      const payload = {
        name: `Builder Bot ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
        demo: true,
        assetSymbol: market,
        strategyType,
        strategyParams: {
          tradeType, durationSec: duration,
          digitBarrier: needsBarrier ? barrier : undefined,
          martingale, martingaleSize,
        },
        stake,
        durationSec: duration,
        maxDailyLoss: stopLoss,
        maxTrades,
        maxConsecutiveLosses: maxConsec,
        takeProfit,
      };
      const res = await fetch("/api/bots", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: "error", title: "Could not create bot", body: json.error });
        return;
      }
      const id = json.data.bot.id;
      setBotId(id);
      await fetch(`/api/bots/${id}/actions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      setRunning(true);
      push({ kind: "success", title: "Bot is running", body: "Demo paper execution on the simulated feed." });
      void refresh();
      loadData();
    } catch {
      push({ kind: "error", title: "Network error" });
    }
  }

  async function stopBot(kill = false) {
    if (!botId) { setRunning(false); return; }
    await fetch(`/api/bots/${botId}/actions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: kill ? "kill" : "stop" }),
    });
    setRunning(false);
    push({ kind: "info", title: kill ? "Kill switch activated" : "Bot stopped" });
    loadData();
  }

  const filteredAssets = assets.filter((a) =>
    !search || a.symbol.toLowerCase().includes(search.toLowerCase()) || a.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="grid gap-3 lg:grid-cols-[210px_1fr_350px] xl:grid-cols-[220px_1fr_380px]">
      {/* ============ LEFT — AI BOT GENERATOR + BLOCKS MENU ============ */}
      <aside className="space-y-2">
        <button className="w-full btn btn-run py-3 text-[14px] font-extrabold tracking-wide">
          <Bot size={16} /> AI Bot Generator
        </button>

        <div className="panel overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-[13.5px] font-extrabold text-ink border-b border-line"
            onClick={() => setMenuOpen((v) => !v)}
          >
            Blocks menu {menuOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {menuOpen && (
            <div className="p-3 space-y-3">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
                <input className="inp pl-7 py-1.5 text-xs" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>

              <div className="text-[12.5px] font-extrabold text-ink flex items-center gap-1.5 pt-1">
                Analysis Logics <Flame size={13} className="text-icred" />
              </div>
              <button className="w-full text-left text-[12.5px] text-dim hover:text-brand font-semibold" onClick={() => { addBlock("purchase-conditions"); push({ kind: "info", title: "Purchase conditions added to canvas" }); }}>
                Purchase conditions
              </button>
              <button className="w-full text-left text-[12.5px] text-dim hover:text-brand font-semibold" onClick={() => { addBlock("restart-conditions"); push({ kind: "info", title: "Restart conditions added to canvas" }); }}>
                Restart trading conditions
              </button>

              <div className="text-[12.5px] font-extrabold text-ink pt-1">Trade parameters</div>
              <button className="w-full text-left text-[12.5px] text-dim hover:text-brand font-semibold" onClick={() => addBlock("trade-params")}>
                Trade parameters block
              </button>
              <button className="w-full text-left text-[12.5px] text-dim hover:text-brand font-semibold" onClick={() => addBlock("run-once")}>
                Run once at start
              </button>

              <button
                className="w-full flex items-center justify-between text-[12.5px] font-extrabold text-ink pt-1"
                onClick={() => setAnalysisOpen((v) => !v)}
              >
                Analysis {analysisOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {analysisOpen && (
                <div className="pl-2 space-y-1.5 text-[12px] text-dim">
                  <a href={`/bots/analysis?symbol=${market}`} className="block hover:text-brand font-semibold">Digit distribution</a>
                  <a href={`/bots/analysis?symbol=${market}&view=movement`} className="block hover:text-brand font-semibold">Rise/Fall streaks</a>
                </div>
              )}

              <button
                className="w-full flex items-center justify-between text-[12.5px] font-extrabold text-ink pt-1"
                onClick={() => setUtilityOpen((v) => !v)}
              >
                Utility {utilityOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {utilityOpen && (
                <div className="pl-2 space-y-1.5 text-[12px] text-dim">
                  <a href="/bots" className="block hover:text-brand font-semibold">My bots</a>
                  <a href="/bots/store" className="block hover:text-brand font-semibold">Bot Store</a>
                  <a href="/bots/copy-trading" className="block hover:text-brand font-semibold">Copy trading</a>
                </div>
              )}

              <div className="text-[12.5px] font-extrabold text-ink pt-1">Binary Flow Tools</div>
              <div className="pl-2 space-y-1.5 text-[12px] text-dim">
                <a href="/bots/marketplace" className="block hover:text-brand font-semibold">Strategy marketplace</a>
                <a href="/history" className="block hover:text-brand font-semibold">Trade journal</a>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ============ CENTER — CANVAS ============ */}
      <section className="space-y-3 min-w-0">
        {/* toolbar */}
        <div className="panel px-3 py-2 flex items-center gap-1 flex-wrap">
          {[RotateCcw, FolderOpen, Save, FileCode, BarChart3, LayoutGrid, LineIcon, TrendingUp, RefreshCw, RefreshCw].map((Icon, i) => (
            <button key={i} className="p-1.5 rounded-md text-dim hover:text-ink hover:bg-panel2" aria-label="Tool">
              <Icon size={15} />
            </button>
          ))}
          <div className="w-px h-4 bg-line mx-1" />
          {[RefreshCw, RotateCcw].map((Icon, i) => (
            <button key={`r${i}`} className="p-1.5 rounded-md text-dim hover:text-ink hover:bg-panel2" aria-label="Undo/Redo">
              <Icon size={15} />
            </button>
          ))}
          <div className="w-px h-4 bg-line mx-1" />
          {[ZoomIn, ZoomOut].map((Icon, i) => (
            <button key={`z${i}`} className="p-1.5 rounded-md text-dim hover:text-ink hover:bg-panel2" aria-label="Zoom">
              <Icon size={15} />
            </button>
          ))}
          <div className="flex-1" />
          <button className="btn btn-ghost btn-xs text-down" onClick={() => setBlocks(["trade-params", "run-once"])}>
            <Trash2 size={12} /> Clear canvas
          </button>
        </div>

        {/* 1. Trade parameters block */}
        {blocks.includes("trade-params") && (
          <div className="panel overflow-hidden">
            <div className="bg-navy text-white px-4 py-2.5 flex items-center gap-2 text-[13px] font-bold">
              <FileCode size={14} /> 1. Trade parameters
            </div>
            <div className="p-4 space-y-4 bg-panel2/50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-bold text-dim">Market:</span>
                <select className="inp max-w-[220px]" value={market} onChange={(e) => setMarket(e.target.value)}>
                  {filteredAssets.map((a) => (
                    <option key={a.symbol} value={a.symbol}>{a.name}</option>
                  ))}
                </select>
                {isDigitStrategy && (
                  <>
                    <span className="text-faint">›</span>
                    <span className="tag tag-live">Digits</span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-bold text-dim">Trade Type:</span>
                <select className="inp max-w-[200px]" value={tradeType} onChange={(e) => setTradeType(e.target.value as TradeType)}>
                  {TRADE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>

              {needsBarrier && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] font-bold text-dim">Barrier digit:</span>
                  <input className="inp mono max-w-[90px]" type="number" min={0} max={8} value={barrier}
                    onChange={(e) => setBarrier(Math.min(8, Math.max(0, Number(e.target.value) || 0)))} />
                  <span className="text-[11px] text-faint">wins when exit digit is {barrier === 0 ? "1-9" : `${barrier + 1}-9`} (Over) or 0-{barrier - 1} (Under)</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-bold text-dim">Default Duration:</span>
                <select className="inp max-w-[140px]" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                  <option value={60}>1 minute</option>
                  <option value={300}>5 minutes</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-[12.5px] text-dim">
                <input type="checkbox" checked={restartOnError} onChange={(e) => setRestartOnError(e.target.checked)}
                  className="w-4 h-4 accent-blue-600" />
                Restart last trade on error (bot retries after an unsuccessful trade)
              </label>
            </div>
          </div>
        )}

        {/* Run once at start block */}
        {blocks.includes("run-once") && (
          <div className="panel overflow-hidden">
            <div className="bg-navy text-white px-4 py-2.5 flex items-center gap-2 text-[13px] font-bold">
              <Layers size={14} /> Run once at start:
            </div>
            <div className="p-4 space-y-3 bg-panel2/50">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tag tag-live">set</span>
                <span className="text-[12.5px] font-bold">Stake</span>
                <span className="text-faint">to</span>
                <input className="inp mono max-w-[110px]" type="number" min={0.5} step={0.5} value={stake}
                  onChange={(e) => setStake(Math.max(0.5, Number(e.target.value) || 0.5))} />
                <span className="text-[11px] text-faint">USD per trade</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-[12.5px] text-dim">
                  <input type="checkbox" checked={martingale} onChange={(e) => setMartingale(e.target.checked)}
                    className="w-4 h-4 accent-blue-600" />
                  <span className="font-bold">Martingale stake</span>
                </label>
                {martingale && (
                  <>
                    <span className="text-faint">size</span>
                    <input className="inp mono max-w-[80px]" type="number" min={1.1} step={0.1} value={martingaleSize}
                      onChange={(e) => setMartingaleSize(Math.max(1.1, Number(e.target.value) || 2))} />
                    <span className="chip-warn">⚠ escalates losses</span>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="tag tag-live">set</span>
                <span className="text-[12.5px] font-bold">Stop loss</span>
                <span className="text-faint">to</span>
                <input className="inp mono max-w-[110px]" type="number" min={1} value={stopLoss}
                  onChange={(e) => setStopLoss(Math.max(1, Number(e.target.value) || 1))} />
                <span className="text-[11px] text-faint">daily max loss (auto-pause)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="tag tag-live">set</span>
                <span className="text-[12.5px] font-bold">Take profit</span>
                <span className="text-faint">to</span>
                <input className="inp mono max-w-[110px]" type="number" min={1} value={takeProfit}
                  onChange={(e) => setTakeProfit(Math.max(1, Number(e.target.value) || 1))} />
                <span className="text-[11px] text-faint">auto-pause at this profit</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="tag tag-live">set</span>
                <span className="text-[12.5px] font-bold">Max trades / day</span>
                <span className="text-faint">to</span>
                <input className="inp mono max-w-[100px]" type="number" min={1} value={maxTrades}
                  onChange={(e) => setMaxTrades(Math.max(1, Number(e.target.value) || 1))} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="tag tag-live">set</span>
                <span className="text-[12.5px] font-bold">Max consecutive losses</span>
                <span className="text-faint">to</span>
                <input className="inp mono max-w-[100px]" type="number" min={1} value={maxConsec}
                  onChange={(e) => setMaxConsec(Math.max(1, Number(e.target.value) || 1))} />
              </div>
            </div>
          </div>
        )}

        {/* 4. Restart trading conditions block */}
        {blocks.includes("restart-conditions") && (
          <div className="panel overflow-hidden">
            <div className="bg-navy text-white px-4 py-2.5 flex items-center gap-2 text-[13px] font-bold">
              <RefreshCw size={14} /> 4. Restart trading conditions
            </div>
            <div className="p-4 space-y-2.5 bg-panel2/50 text-[12.5px] text-dim">
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink">if</span> Result is
                <select className="inp max-w-[110px]"><option>Win</option><option>Loss</option></select>
                <span className="text-[11px] text-faint">→ continue with base stake (managed automatically)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink">if</span> Total profit/loss ≥ Take profit → pause bot (enforced server-side)
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink">if</span> Total profit/loss ≤ −Stop loss → pause bot (enforced server-side)
              </div>
              <p className="text-[11px] text-faint pt-1">
                Restart and risk conditions are compiled into the bot's server-side risk engine. Max stake per trade: ${martingale ? (stake * Math.pow(martingaleSize, maxConsec - 1)).toFixed(2) : stake.toFixed(2)} worst case.
              </p>
            </div>
          </div>
        )}

        {/* Purchase conditions placeholder */}
        {blocks.includes("purchase-conditions") && (
          <div className="panel overflow-hidden">
            <div className="bg-navy text-white px-4 py-2.5 flex items-center gap-2 text-[13px] font-bold">
              <Zap size={14} /> 2. Purchase conditions
            </div>
            <div className="p-4 bg-panel2/50 text-[12.5px] text-dim space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-ink">IF</span> strategy signal fires
                <span className="font-bold text-ink">THEN</span>
                <span className="tag tag-live">{tradeType === "even_odd" ? "BUY EVEN/ODD" : tradeType === "over_under" ? "BUY OVER/UNDER" : tradeType === "matches_differs" ? "BUY MATCHES/DIFFERS" : tradeType === "rise_fall" ? "BUY RISE/FALL" : "TAKE SIGNAL TRADE"}</span>
              </div>
              <p className="text-[11px] text-faint">
                Purchase logic is compiled from your selected trade type and strategy. Direction is decided by the signal engine on each evaluation cycle (every 5s).
              </p>
            </div>
          </div>
        )}

        {blocks.length === 0 && (
          <div className="panel p-10 text-center text-[13px] text-faint">
            Canvas is empty — add blocks from the menu on the left.
          </div>
        )}
      </section>

      {/* ============ RIGHT — RUN PANEL ============ */}
      <aside className="space-y-2">
        <div className="flex items-stretch gap-2">
          {running ? (
            <button className="btn btn-down flex-1 py-3" onClick={() => stopBot(false)}>
              <Square size={15} /> Stop
            </button>
          ) : (
            <button className="btn btn-run flex-1 py-3" onClick={handleRun}>
              <Play size={15} /> Run
            </button>
          )}
          <div className="panel-2 flex-1 flex items-center justify-center text-[12.5px] font-bold text-dim">
            {running ? "Bot is running…" : "Bot is not running"}
          </div>
        </div>

        {running && (
          <button className="w-full btn btn-ghost btn-xs text-down" onClick={() => stopBot(true)}>
            ⚠ Kill switch — halt immediately
          </button>
        )}

        <div className="panel overflow-hidden">
          <div className="flex border-b border-line">
            {(["summary", "transactions", "journal"] as const).map((t) => (
              <button
                key={t}
                className={`flex-1 py-2.5 text-[12.5px] font-extrabold capitalize border-b-2 ${
                  tab === t ? "text-ink border-brand" : "text-dim border-transparent hover:text-ink"
                }`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="p-4">
            {tab === "summary" && (
              <div className="space-y-4">
                {!botId && (
                  <div className="panel-2 p-6 text-center text-[12.5px] text-dim">
                    Configure your blocks and hit <strong className="text-ink">Run</strong>.
                    You&apos;ll be able to track the bot&apos;s performance here.
                  </div>
                )}
                {botId && (
                  <>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <Stat label="Total stake" value={`${summary.stake.toFixed(2)} USD`} />
                      <Stat label="Total payout" value={`${summary.payout.toFixed(2)} USD`} />
                      <Stat label="No. of runs" value={String(summary.runs)} />
                      <Stat label="Contracts lost" value={String(summary.lost)} />
                      <Stat label="Contracts won" value={String(summary.won)} />
                      <div>
                        <div className="text-[10.5px] text-faint uppercase font-bold">Total profit/loss</div>
                        <div className={cn("mono text-[14px] font-extrabold", pnlColor(summary.pnl))}>{summary.pnl.toFixed(2)} USD</div>
                      </div>
                    </div>
                    <button className="w-full btn btn-ghost btn-sm" onClick={() => { setBotId(null); setRunning(false); setTxs([]); setJournal([]); }}>
                      Reset panel
                    </button>
                  </>
                )}
              </div>
            )}

            {tab === "transactions" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <a className="btn btn-ghost btn-xs" href="/history">Download</a>
                  <a className="btn btn-ghost btn-xs" href={`/bots/${botId ?? ""}`}>View Detail</a>
                </div>
                {txs.length === 0 && <div className="text-[12px] text-faint py-6 text-center">No transactions yet.</div>}
                {txs.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-[12px] py-1.5 border-b border-line/60">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={(t.direction === "up" ? "text-up" : "text-down") + " font-bold"}>
                          {t.direction.toUpperCase()}
                        </span>
                        <span className="text-faint text-[10.5px]">{fmtDateTime(t.closedAt ?? undefined)}</span>
                      </div>
                      <div className="text-faint text-[10.5px] mono">
                        {t.entryPrice} → {t.exitPrice ?? "…"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="mono">{t.stake.toFixed(2)} USD</div>
                      <div className={cn("mono font-bold", pnlColor(t.pnl))}>
                        {t.pnl != null ? `${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)} USD` : "running"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "journal" && (
              <div className="font-mono text-[10.5px] space-y-1 max-h-80 overflow-y-auto">
                {journal.length === 0 && <div className="text-faint text-center py-6">Bot journal is empty.</div>}
                {journal.map((l) => (
                  <div key={l.id} className={cn(
                    l.level === "warn" ? "text-amber" : l.level === "error" ? "text-down" :
                    l.level === "signal" ? "text-brand" : l.level === "trade" ? "text-up" : "text-dim",
                  )}>
                    [{new Date(l.createdAt).toLocaleTimeString("en-GB")}] {l.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel-2 p-3 text-[11px] text-dim leading-relaxed">
          <strong className="text-ink flex items-center gap-1.5 mb-1"><Info size={12} /> Demo execution</strong>
          This builder deploys DEMO bots on the simulated feed. Deriv connection is planned — until a
          verified broker is configured, no real-money orders are possible and nothing simulates one.
        </div>
      </aside>

      <ConfirmModal
        open={confirmRun}
        onClose={() => setConfirmRun(false)}
        onConfirm={reallyRun}
        title="Start demo bot"
        confirmLabel="Run bot"
        body={
          <span>
            Strategy <strong>{TRADE_TYPES.find((t) => t.id === tradeType)?.label}</strong> on{" "}
            <strong>{market}</strong> · stake ${stake.toFixed(2)}
            {martingale && <> with martingale ×{martingaleSize}</>} · stop loss ${stopLoss} · take profit ${takeProfit}.
            Runs in DEMO mode on the simulated feed.
          </span>
        }
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] text-faint uppercase font-bold">{label}</div>
      <div className="mono text-[14px] font-extrabold text-ink">{value}</div>
    </div>
  );
}
