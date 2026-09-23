"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { fmtMoney, fmtDateTime, pnlColor } from "@/lib/format";
import { cn } from "@/lib/cn";

type HistRow = {
  id: string; kind: "forex" | "fixed-time"; symbol: string;
  side?: string; direction?: string;
  size?: number; stake?: number;
  entry: number | null; exit: number | null;
  pnl: number | null; status: string;
  closeReason?: string | null; payoutRate?: number;
  openedAt: string; closedAt: string | null;
};

export default function HistoryPage() {
  const [rows, setRows] = useState<HistRow[]>([]);
  const [kind, setKind] = useState<"all" | "forex" | "fixed-time">("all");
  const [status, setStatus] = useState("all");
  const [symbol, setSymbol] = useState("");

  useEffect(() => {
    fetch("/api/trades")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return;
        const merged: HistRow[] = [
          ...j.data.positions.map((p: Record<string, unknown>) => ({
            kind: "forex" as const, ...p,
          }) as HistRow),
          ...j.data.fixedTime.map((d: Record<string, unknown>) => ({
            kind: "fixed-time" as const, ...d,
          }) as HistRow),
        ];
        merged.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
        setRows(merged);
      })
      .catch(() => {});
  }, []);

  const symbols = useMemo(() => [...new Set(rows.map((r) => r.symbol))], [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (kind !== "all" && r.kind !== kind) return false;
        if (status !== "all" && r.status !== status) return false;
        if (symbol && r.symbol !== symbol) return false;
        return true;
      }),
    [rows, kind, status, symbol],
  );

  function exportCsv() {
    const head = ["ID", "Type", "Asset", "Side", "Amount", "Entry", "Exit", "Opened", "Closed", "P/L", "Status"];
    const lines = filtered.map((r) =>
      [r.id, r.kind, r.symbol, r.side ?? r.direction, r.kind === "forex" ? r.size : r.stake,
        r.entry ?? "", r.exit ?? "", r.openedAt, r.closedAt ?? "", r.pnl ?? "", r.status]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billinare-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPnl = filtered.reduce((s, r) => s + (r.pnl ?? 0), 0);
  const wins = filtered.filter((r) => r.status === "won" || r.status === "take_profit").length;
  const losses = filtered.filter((r) => r.status === "lost" || r.status === "stop_loss").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold mr-2">Trade history</h1>
        <select className="inp max-w-[150px] py-1.5 text-xs" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="all">All types</option>
          <option value="forex">Forex</option>
          <option value="fixed-time">Fixed-time</option>
        </select>
        <select className="inp max-w-[150px] py-1.5 text-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="take_profit">Take profit</option>
          <option value="stop_loss">Stop loss</option>
        </select>
        <select className="inp max-w-[150px] py-1.5 text-xs" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          <option value="">All assets</option>
          {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex-1" />
        <button className="btn btn-ghost btn-sm" onClick={exportCsv}><Download size={13} /> Export CSV</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="panel p-3.5">
          <div className="text-[11px] text-faint uppercase">Total P/L</div>
          <div className={cn("mono text-lg font-bold", pnlColor(totalPnl))}>{fmtMoney(totalPnl)}</div>
        </div>
        <div className="panel p-3.5">
          <div className="text-[11px] text-faint uppercase">Win / Loss</div>
          <div className="mono text-lg font-bold">{wins} / {losses}</div>
        </div>
        <div className="panel p-3.5">
          <div className="text-[11px] text-faint uppercase">Trades</div>
          <div className="mono text-lg font-bold">{filtered.length}</div>
        </div>
      </div>

      <div className="panel overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th><th>Type</th><th>Asset</th><th>Side</th><th>Amount</th>
              <th>Entry</th><th>Exit</th><th>Opened</th><th>Closed</th><th>P/L</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="text-center py-8 text-xs text-faint">No trades match these filters yet.</td></tr>
            )}
            {filtered.slice(0, 200).map((r) => (
              <tr key={r.id}>
                <td className="mono text-faint text-[10.5px]">{r.id.slice(0, 8)}</td>
                <td><span className="tag tag-demo">{r.kind === "fixed-time" ? "Fixed" : "CFD"}</span></td>
                <td className="font-semibold">{r.symbol}</td>
                <td className={(r.side ?? r.direction) === "buy" || (r.side ?? r.direction) === "up" ? "text-up" : "text-down"}>
                  {(r.side ?? r.direction ?? "").toUpperCase()}
                </td>
                <td className="mono">{r.kind === "forex" ? r.size : fmtMoney(r.stake)}</td>
                <td className="mono">{r.entry ?? "—"}</td>
                <td className="mono">{r.exit ?? "—"}</td>
                <td className="text-[11px] text-faint">{fmtDateTime(r.openedAt)}</td>
                <td className="text-[11px] text-faint">{fmtDateTime(r.closedAt)}</td>
                <td className={cn("mono font-semibold", pnlColor(r.pnl))}>{r.pnl != null ? fmtMoney(r.pnl) : "—"}</td>
                <td className="text-[11.5px] capitalize">{r.status.replace("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
