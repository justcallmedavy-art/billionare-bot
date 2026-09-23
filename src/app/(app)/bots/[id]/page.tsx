"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Pause, Play, Square, Terminal } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { fmtMoney, fmtTime, pnlColor } from "@/lib/format";
import { cn } from "@/lib/cn";

type LogRow = { id: string; level: string; message: string; createdAt: string };
type TradeRow = {
  id: string; direction: string; stake: number; entryPrice: number; exitPrice: number | null;
  pnl: number | null; status: string; openedAt: string; closedAt: string | null;
};

const LEVEL_COLOR: Record<string, string> = {
  info: "text-dim", signal: "text-cyan", trade: "text-up", warn: "text-amber", error: "text-down",
};

export default function BotDetailPage() {
  const params = useParams<{ id: string }>();
  const { push } = useToast();
  const [bot, setBot] = useState<Record<string, unknown> | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [perf, setPerf] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(() => {
    const id = params.id;
    fetch(`/api/bots/${id}/logs`)
      .then((r) => r.json())
      .then((j) => { if (j.ok) { setBot(j.data.bot); setLogs(j.data.logs.reverse()); } })
      .catch(() => {});
    fetch(`/api/bots/${id}/trades`)
      .then((r) => r.json())
      .then((j) => { if (j.ok) setTrades(j.data.trades); })
      .catch(() => {});
    fetch(`/api/bots/${id}/performance`)
      .then((r) => r.json())
      .then((j) => { if (j.ok) setPerf(j.data); })
      .catch(() => {});
  }, [params.id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function act(action: string) {
    const res = await fetch(`/api/bots/${params.id}/actions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    if (!json.ok) push({ kind: "error", title: "Action failed", body: json.error });
    load();
  }

  if (!bot) {
    return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skel h-10" />)}</div>;
  }

  const status = bot.status as string;
  const totals = (perf?.totals ?? {}) as Record<string, number | null>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/bots" className="text-[12px] text-faint hover:text-ink">← DollarPrinter</Link>
        <div className="flex-1" />
        <span className={cn("tag", bot.demo ? "tag-demo" : "tag-real")}>{bot.demo ? "Demo" : "Real"}</span>
      </div>

      <div className="panel p-4 flex flex-wrap items-center gap-4">
        <div>
          <h1 className="font-bold text-[16px]">{bot.name as string}</h1>
          <p className="text-[11.5px] text-faint mt-0.5">{bot.assetSymbol as string} · stake {fmtMoney(bot.stake as number)}</p>
        </div>
        <span className={cn("text-[12px] font-bold uppercase flex items-center gap-1.5",
          status === "running" ? "text-up" : status === "paused" ? "text-amber" : "text-faint")}>
          <span className={status === "running" ? "dot dot-live" : status === "paused" ? "dot dot-warn" : "dot dot-off"} />
          {status}
        </span>
        {(bot.pauseReason as string) && (
          <span className="text-[11.5px] text-amber bg-amber/10 border border-amber/25 rounded-md px-2.5 py-1">{bot.pauseReason as string}</span>
        )}
        <div className="flex-1" />
        <div className="flex gap-1.5">
          {status === "running"
            ? <button className="btn btn-ghost btn-sm" onClick={() => act("pause")}><Pause size={12} /> Pause</button>
            : <button className="btn btn-ghost btn-sm" onClick={() => act("start")}><Play size={12} /> Start</button>}
          {status !== "stopped" && <button className="btn btn-ghost btn-sm" onClick={() => act("stop")}><Square size={12} /> Stop</button>}
          <button className="btn btn-ghost btn-sm text-down" onClick={() => act("kill")}><Terminal size={12} /> Kill switch</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          ["Trades", String(totals.trades ?? 0)],
          ["Wins", String(totals.wins ?? 0)],
          ["Losses", String(totals.losses ?? 0)],
          ["Win rate", totals.winRate != null ? `${totals.winRate}%` : "—"],
          ["Net P/L", fmtMoney(totals.pnl ?? 0)],
          ["Max drawdown", fmtMoney(totals.maxDrawdown ?? 0)],
        ].map(([label, value]) => (
          <div key={label} className="panel p-3.5">
            <div className="text-[10.5px] text-faint uppercase">{label}</div>
            <div className={cn("mono text-[15px] font-bold mt-1", label === "Net P/L" && pnlColor(totals.pnl ?? 0))}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        {/* Live console */}
        <div className="panel overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-line flex items-center gap-2">
            <Terminal size={13} className="text-cyan" />
            <span className="text-[12.5px] font-semibold">Live execution console</span>
            <div className="flex-1" />
            <span className="flex items-center gap-1.5 text-[10.5px] text-faint"><span className="dot dot-live" /> streaming</span>
          </div>
          <div className="p-3 font-mono text-[11px] space-y-1 h-72 overflow-y-auto bg-[#0e1a3a] text-white/90">
            {logs.length === 0 && <div className="text-faint">Waiting for bot activity…</div>}
            {logs.map((l) => (
              <div key={l.id} className="flex gap-2">
                <span className="text-faint shrink-0">{fmtTime(l.createdAt)}</span>
                <span className={LEVEL_COLOR[l.level] ?? "text-dim"}>{l.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trade history */}
        <div className="panel overflow-hidden">
          <div className="px-4 py-2.5 border-b border-line">
            <span className="text-[12.5px] font-semibold">Bot trades</span>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="tbl">
              <thead><tr><th>Time</th><th>Dir</th><th>Stake</th><th>Entry</th><th>Exit</th><th>Result</th><th>P/L</th></tr></thead>
              <tbody>
                {trades.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-xs text-faint">No trades yet.</td></tr>}
                {trades.map((t) => (
                  <tr key={t.id}>
                    <td className="text-[11px] text-faint">{fmtTime(t.openedAt)}</td>
                    <td className={t.direction === "up" ? "text-up" : "text-down"}>{t.direction.toUpperCase()}</td>
                    <td className="mono">{fmtMoney(t.stake)}</td>
                    <td className="mono">{t.entryPrice}</td>
                    <td className="mono">{t.exitPrice ?? "—"}</td>
                    <td className={t.status === "won" ? "text-up" : t.status === "lost" ? "text-down" : "text-dim"}>
                      {t.status === "open" ? "running" : t.status}
                    </td>
                    <td className={cn("mono", pnlColor(t.pnl))}>{t.pnl != null ? fmtMoney(t.pnl) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
