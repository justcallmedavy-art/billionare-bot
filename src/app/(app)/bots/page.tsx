"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Cpu, Pause, Play, Plus, Square, Terminal, Store, Users, Activity } from "lucide-react";
import { useAuth } from "@/components/providers/auth";
import { useToast } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/modal";
import { fmtMoney, pnlColor } from "@/lib/format";
import { cn } from "@/lib/cn";

type BotRow = {
  id: string; name: string; demo: boolean; assetSymbol: string; status: string;
  pauseReason: string; strategyType: string; stake: number;
  tradeCount: number; winCount: number; lossCount: number; pnl: number;
  lastTradeAt: string | null;
};

const STRATEGY_LABEL: Record<string, string> = {
  rsi_ema: "RSI + EMA crossover",
  breakout: "Range breakout",
  digit_evenodd: "Digit even/odd (demo)",
};

export default function BotsPage() {
  const { refresh } = useAuth();
  const { push } = useToast();
  const pathname = usePathname();
  const [bots, setBots] = useState<BotRow[]>([]);
  const [killId, setKillId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/bots")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setBots(j.data.bots); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function act(id: string, action: string) {
    const res = await fetch(`/api/bots/${id}/actions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    if (!json.ok) {
      push({ kind: "error", title: "Action failed", body: json.error });
    } else {
      push({ kind: "success", title: `Bot ${action === "kill" ? "halted" : action + "ed"}` });
    }
    load();
    void refresh();
  }

  const running = bots.filter((b) => b.status === "running").length;
  const openTrades = bots.reduce((s, b) => s + (b.tradeCount - b.winCount - b.lossCount), 0);
  const totalPnl = bots.reduce((s, b) => s + b.pnl, 0);
  const volume = bots.reduce((s, b) => s + b.tradeCount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="panel p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/25 flex items-center justify-center">
            <Cpu size={19} className="text-brand" />
          </div>
          <div>
            <h1 className="font-extrabold tracking-tight text-[16px] text-ink">DOLLARPRINTER</h1>
            <p className="text-[11px] text-faint">Automated trading center · demo execution only</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4 text-[11px] text-dim">
          <span className="flex items-center gap-1.5"><span className="dot dot-live" /> Market data connected</span>
          <span className="flex items-center gap-1.5"><span className="dot dot-warn" /> Broker: not connected (demo)</span>
        </div>
        <div className="flex-1" />
        <Link href="/bots/create" className="btn btn-primary btn-sm"><Plus size={14} /> Create bot</Link>
      </div>

      {/* Sub-nav: builder suite */}
      <div className="panel px-2 py-1.5 flex flex-wrap items-center gap-1">
        <Link href="/bots" className={`btn btn-xs ${pathname === "/bots" ? "btn-primary" : "btn-ghost"}`}><Bot size={12} /> My Bots</Link>
        <Link href="/bots/builder" className={`btn btn-xs ${pathname.startsWith("/bots/builder") ? "btn-run" : "btn-ghost"}`}><Cpu size={12} /> Bot Builder</Link>
        <Link href="/bots/store" className={`btn btn-xs ${pathname.startsWith("/bots/store") ? "btn-primary" : "btn-ghost"}`}><Store size={12} /> Bot Store</Link>
        <Link href="/bots/analysis" className={`btn btn-xs ${pathname.startsWith("/bots/analysis") ? "btn-primary" : "btn-ghost"}`}><Activity size={12} /> AI Market Analysis</Link>
        <Link href="/bots/copy-trading" className={`btn btn-xs ${pathname.startsWith("/bots/copy-trading") ? "btn-primary" : "btn-ghost"}`}><Users size={12} /> Copy Trading</Link>
        <Link href="/bots/marketplace" className={`btn btn-xs ${pathname.startsWith("/bots/marketplace") ? "btn-primary" : "btn-ghost"}`}><Store size={12} /> Marketplace</Link>
      </div>

      <div className="panel-2 p-3 flex items-start gap-2.5 border-amber/40 rounded-xl">
        <span className="chip-warn">⚠ Risk Disclaimer</span>
        <p className="text-[11.5px] text-dim">
          Automated strategies execute without per-trade confirmation and can lose repeatedly. Risk limits are enforced server-side. No profit is guaranteed under any circumstances.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard label="Active bots" value={String(running)} />
        <SummaryCard label="Total bot trades" value={String(volume)} />
        <SummaryCard label="Open bot trades" value={String(openTrades)} />
        <SummaryCard label="Bot P/L" value={fmtMoney(totalPnl)} cls={pnlColor(totalPnl)} />
        <SummaryCard label="Execution" value="PAPER" sub="demo ledger only" />
      </div>

      {/* Bot cards */}
      {bots.length === 0 ? (
        <div className="panel p-10 text-center">
          <Bot size={28} className="text-faint mx-auto mb-3" />
          <div className="text-[14px] font-semibold">No bots yet</div>
          <p className="text-[12.5px] text-dim mt-1 max-w-sm mx-auto">
            Create your first automated strategy. Every bot starts in DEMO mode with mandatory risk limits.
          </p>
          <Link href="/bots/create" className="btn btn-primary mt-4">Create your first bot</Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {bots.map((b) => (
            <BotCard key={b.id} bot={b} onAction={act} onKill={() => setKillId(b.id)} />
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!killId}
        onClose={() => setKillId(null)}
        onConfirm={() => { if (killId) void act(killId, "kill"); }}
        title="Activate kill switch"
        body="This immediately halts the bot and blocks all new automated orders. Open paper trades simply expire. Audit-logged."
        confirmLabel="HALT BOT"
        danger
      />
    </div>
  );
}

function SummaryCard({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="panel p-3.5">
      <div className="text-[10.5px] text-faint uppercase tracking-wide">{label}</div>
      <div className={cn("mono text-lg font-bold mt-1", cls)}>{value}</div>
      {sub && <div className="text-[10px] text-faint mt-0.5">{sub}</div>}
    </div>
  );
}

function BotCard({ bot, onAction, onKill }: {
  bot: BotRow;
  onAction: (id: string, action: string) => void;
  onKill: () => void;
}) {
  const statusColor =
    bot.status === "running" ? "text-up" : bot.status === "paused" ? "text-amber" : "text-faint";
  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-[13.5px] flex items-center gap-2">
            {bot.name}
            <span className={bot.demo ? "tag tag-demo" : "tag tag-real"}>{bot.demo ? "Demo" : "Real"}</span>
          </div>
          <div className="text-[11px] text-faint mt-0.5">
            {STRATEGY_LABEL[bot.strategyType] ?? bot.strategyType} · {bot.assetSymbol}
          </div>
        </div>
        <span className={cn("text-[11px] font-bold uppercase flex items-center gap-1.5", statusColor)}>
          <span className={bot.status === "running" ? "dot dot-live" : bot.status === "paused" ? "dot dot-warn" : "dot dot-off"} />
          {bot.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="panel-2 py-2">
          <div className="text-[10px] text-faint">Trades</div>
          <div className="mono text-[13px] font-semibold">{bot.tradeCount}</div>
        </div>
        <div className="panel-2 py-2">
          <div className="text-[10px] text-faint">Win / Loss</div>
          <div className="mono text-[13px] font-semibold">{bot.winCount}/{bot.lossCount}</div>
        </div>
        <div className="panel-2 py-2">
          <div className="text-[10px] text-faint">P/L</div>
          <div className={cn("mono text-[13px] font-semibold", pnlColor(bot.pnl))}>{fmtMoney(bot.pnl)}</div>
        </div>
      </div>

      {bot.pauseReason && (
        <div className="text-[11px] text-amber bg-amber/10 border border-amber/25 rounded-md px-2.5 py-1.5">
          {bot.pauseReason}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {bot.status === "running" ? (
          <button className="btn btn-ghost btn-xs" onClick={() => onAction(bot.id, "pause")}><Pause size={11} /> Pause</button>
        ) : (
          <button className="btn btn-ghost btn-xs" onClick={() => onAction(bot.id, "start")}><Play size={11} /> Start</button>
        )}
        {bot.status !== "stopped" && (
          <button className="btn btn-ghost btn-xs" onClick={() => onAction(bot.id, "stop")}><Square size={11} /> Stop</button>
        )}
        <button className="btn btn-ghost btn-xs text-down" onClick={onKill}><Terminal size={11} /> Kill</button>
        <div className="flex-1" />
        <Link href={`/bots/${bot.id}`} className="btn btn-primary btn-xs">Details</Link>
      </div>
    </div>
  );
}
