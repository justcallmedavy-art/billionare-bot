"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth";
import { fmtMoney, pnlColor } from "@/lib/format";
import { cn } from "@/lib/cn";

type HistRow = { id: string; pnl: number | null; status: string; openedAt: string; symbol: string; kind: string };

export default function PortfolioPage() {
  const { account } = useAuth();
  const [rows, setRows] = useState<HistRow[]>([]);

  useEffect(() => {
    fetch("/api/trades")
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return;
        const merged: HistRow[] = [
          ...j.data.positions,
          ...j.data.fixedTime.map((d: Record<string, unknown>) => ({ ...(d as object) })) as HistRow[],
        ];
        setRows(merged.filter((r) => r.pnl != null));
      })
      .catch(() => {});
  }, []);

  const wins = rows.filter((r) => (r.pnl ?? 0) > 0);
  const losses = rows.filter((r) => (r.pnl ?? 0) < 0);
  const grossWin = wins.reduce((s, r) => s + (r.pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, r) => s + (r.pnl ?? 0), 0));
  const winRate = rows.length ? Math.round((wins.length / rows.length) * 100) : 0;

  // Equity curve from closed P/L order
  const curve = [...rows].reverse();
  let eq = 0;
  const equityData = curve.map((r) => { eq += r.pnl ?? 0; return eq; });
  const eqMin = Math.min(0, ...equityData);
  const eqMax = Math.max(1, ...equityData);
  const w = 560, h = 140;
  const step = equityData.length > 1 ? w / (equityData.length - 1) : w;
  const path = equityData
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((v - eqMin) / (eqMax - eqMin || 1)) * (h - 12) - 6).toFixed(1)}`)
    .join(" ");

  // Per-asset exposure
  const byAsset = new Map<string, number>();
  for (const r of rows) byAsset.set(r.symbol, (byAsset.get(r.symbol) ?? 0) + Math.abs(r.pnl ?? 0));
  const assetRows = [...byAsset.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxAsset = Math.max(1, ...assetRows.map(([, v]) => v));

  const stats = [
    { label: "Equity (demo)", value: fmtMoney(account?.demo.equity) },
    { label: "Balance (demo)", value: fmtMoney(account?.demo.balance) },
    { label: "Open P/L", value: fmtMoney(account?.demo.openPnl), cls: pnlColor(account?.demo.openPnl) },
    { label: "Closed trades", value: String(rows.length) },
    { label: "Win rate", value: `${winRate}%` },
    { label: "Profit factor", value: grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : "—" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">Portfolio</h1>
        <p className="text-xs text-dim mt-0.5">Performance of your demo ledger · simulated results</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="panel p-3.5">
            <div className="text-[10.5px] text-faint uppercase tracking-wide">{s.label}</div>
            <div className={cn("mono text-[16px] font-bold mt-1.5", s.cls)}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <div className="panel p-4 lg:col-span-2">
          <div className="text-[13px] font-semibold mb-3">Equity curve (closed trades)</div>
          {equityData.length > 1 ? (
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 150 }}>
              <path d={`${path} L${w},${h} L0,${h} Z`} fill="rgba(34,211,238,.12)" />
              <path d={path} fill="none" stroke="#22d3ee" strokeWidth="1.6" />
            </svg>
          ) : (
            <div className="text-xs text-faint py-10 text-center">Close a few demo trades to build your equity curve.</div>
          )}
        </div>

        <div className="panel p-4">
          <div className="text-[13px] font-semibold mb-3">Asset exposure (closed P/L volume)</div>
          {assetRows.length === 0 && <div className="text-xs text-faint py-8 text-center">No data yet.</div>}
          <div className="space-y-2.5">
            {assetRows.map(([sym, v]) => (
              <div key={sym}>
                <div className="flex justify-between text-[11.5px] mb-1">
                  <span className="font-semibold">{sym}</span>
                  <span className="mono text-faint">{fmtMoney(v)}</span>
                </div>
                <div className="h-1.5 rounded bg-panel2 overflow-hidden">
                  <div className="h-full bg-cyan/70 rounded" style={{ width: `${(v / maxAsset) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel-2 p-4 text-[12px] text-dim">
        Demo-mode statistics are computed from your actual paper-trade records on the simulated feed.
        They measure strategy behavior, not real-market performance, and imply nothing about future results.
      </div>
    </div>
  );
}
