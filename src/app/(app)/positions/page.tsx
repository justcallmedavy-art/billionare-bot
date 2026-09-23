"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth";
import { useToast } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/modal";
import { fmtMoney, fmtPrice, pnlColor } from "@/lib/format";
import { cn } from "@/lib/cn";

type PosRow = {
  id: string; kind: "forex" | "fixed-time"; symbol: string; side?: string; direction?: string;
  size?: number; stake?: number; entry: number; current: number; pnl?: number | null;
  winning?: boolean; secondsLeft?: number; margin?: number; sl?: number | null; tp?: number | null;
  openedAt: string;
};

export default function PositionsPage() {
  const { refresh } = useAuth();
  const { push } = useToast();
  const [rows, setRows] = useState<PosRow[]>([]);
  const [closeId, setCloseId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/positions")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setRows([...j.data.positions, ...j.data.fixedTime]); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const forex = rows.filter((r) => r.kind === "forex");
  const deals = rows.filter((r) => r.kind === "fixed-time");

  async function doClose() {
    if (!closeId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/trades?id=${closeId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        push({ kind: "success", title: "Position closed" });
      } else {
        push({ kind: "error", title: "Close failed", body: json.error });
      }
      void refresh();
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Open positions</h1>

      <section className="panel overflow-x-auto">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <span className="text-[13px] font-semibold">Forex / CFD ({forex.length})</span>
          <button className="text-[11.5px] text-cyan hover:underline" onClick={load}>Refresh</button>
        </div>
        <table className="tbl">
          <thead>
            <tr><th>Asset</th><th>Direction</th><th>Size</th><th>Entry</th><th>Current</th><th>SL / TP</th><th>Margin</th><th>P/L</th><th>Opened</th><th></th></tr>
          </thead>
          <tbody>
            {forex.length === 0 && <tr><td colSpan={10} className="text-center py-6 text-xs text-faint">No open forex positions.</td></tr>}
            {forex.map((p) => (
              <tr key={p.id}>
                <td className="font-semibold">{p.symbol} <span className="tag tag-demo ml-1">Demo</span></td>
                <td className={p.side === "buy" ? "text-up" : "text-down"}>{p.side?.toUpperCase()}</td>
                <td className="mono">{p.size}</td>
                <td className="mono">{fmtPrice(p.entry)}</td>
                <td className="mono">{fmtPrice(p.current)}</td>
                <td className="mono text-faint text-[11px]">{p.sl ? fmtPrice(p.sl) : "—"}/{p.tp ? fmtPrice(p.tp) : "—"}</td>
                <td className="mono">{fmtMoney(p.margin)}</td>
                <td className={cn("mono font-semibold", pnlColor(p.pnl))}>{fmtMoney(p.pnl)}</td>
                <td className="text-faint text-[11px]">{new Date(p.openedAt).toLocaleTimeString()}</td>
                <td><button className="btn btn-ghost btn-xs" onClick={() => setCloseId(p.id)}>Close</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel overflow-x-auto">
        <div className="px-4 py-3 border-b border-line">
          <span className="text-[13px] font-semibold">Fixed-time deals ({deals.length})</span>
        </div>
        <table className="tbl">
          <thead>
            <tr><th>Asset</th><th>Direction</th><th>Stake</th><th>Entry</th><th>Current</th><th>Status</th><th>Expires</th></tr>
          </thead>
          <tbody>
            {deals.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-xs text-faint">No open fixed-time deals.</td></tr>}
            {deals.map((d) => (
              <tr key={d.id}>
                <td className="font-semibold">{d.symbol} <span className="tag tag-demo ml-1">Demo</span></td>
                <td className={d.direction === "up" ? "text-up" : "text-down"}>{d.direction?.toUpperCase()}</td>
                <td className="mono">{fmtMoney(d.stake)}</td>
                <td className="mono">{fmtPrice(d.entry)}</td>
                <td className="mono">{fmtPrice(d.current)}</td>
                <td className={d.winning ? "text-up" : "text-down"}>{d.winning ? "Winning" : "Losing"}</td>
                <td className="mono text-faint">{d.secondsLeft}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ConfirmModal
        open={!!closeId}
        onClose={() => setCloseId(null)}
        onConfirm={doClose}
        title="Close position"
        body="Close this demo position at the current simulated market price? The result will be booked to your demo ledger."
        confirmLabel="Close position"
        busy={busy}
      />
    </div>
  );
}
