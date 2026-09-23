"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Bot, CandlestickChart, Layers, Wallet } from "lucide-react";
import { useAuth } from "@/components/providers/auth";
import { useFeed } from "@/components/providers/market-feed";
import { fmtMoney, fmtPct, fmtPrice, pnlColor } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AssetMeta } from "@/components/trading/watchlist";

export default function DashboardPage() {
  const { account, user } = useAuth();
  const { quotes } = useFeed();
  const [assets, setAssets] = useState<AssetMeta[]>([]);
  const [recent, setRecent] = useState<Array<{ id: string; symbol: string; status: string; pnl: number | null; kind: string; openedAt: string }>>([]);

  useEffect(() => {
    fetch("/api/markets").then((r) => r.json()).then((j) => { if (j.ok) setAssets(j.data.assets); }).catch(() => {});
    fetch("/api/trades?limit=8").then((r) => r.json()).then((j) => {
      if (j.ok) {
        const merged = [
          ...j.data.positions.map((p: Record<string, unknown>) => ({ ...(p as object) })),
          ...j.data.fixedTime.map((d: Record<string, unknown>) => ({ ...(d as object) })),
        ] as Array<{ id: string; symbol: string; status: string; pnl: number | null; kind: string; openedAt: string }>;
        merged.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
        setRecent(merged.slice(0, 8));
      }
    }).catch(() => {});
  }, []);

  const favorites = assets.slice(0, 6);

  const cards = [
    { label: "Demo balance", value: fmtMoney(account?.demo.balance), sub: "simulated funds", icon: Wallet },
    { label: "Equity (demo)", value: fmtMoney(account?.demo.equity), sub: "balance + open P/L", icon: Activity },
    { label: "Open P/L", value: fmtMoney(account?.demo.openPnl), sub: "unrealized", icon: CandlestickChart, pnl: account?.demo.openPnl },
    { label: "Margin used", value: fmtMoney(account?.demo.marginUsed), sub: `${fmtMoney(account?.demo.stakedInFixedTime)} staked in fixed-time`, icon: Layers },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">Welcome back, {user?.fullName?.split(" ")[0] ?? "trader"}</h1>
          <p className="text-xs text-dim mt-0.5">Demo environment · all balances are simulated</p>
        </div>
        <div className="flex gap-2">
          <Link href="/trade" className="btn btn-primary btn-sm"><CandlestickChart size={14} /> Open terminal</Link>
          <Link href="/bots" className="btn btn-ghost btn-sm"><Bot size={14} /> DollarPrinter</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="panel p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-faint uppercase tracking-wide">{c.label}</span>
              <c.icon size={14} className="text-cyan" />
            </div>
            <div className={cn("mono text-xl font-bold mt-2", c.pnl !== undefined && pnlColor(c.pnl))}>{c.value}</div>
            <div className="text-[10.5px] text-faint mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <div className="panel">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <span className="text-[13px] font-semibold">Market snapshot</span>
            <Link href="/markets" className="text-[11.5px] text-cyan hover:underline">All markets</Link>
          </div>
          <div>
            {favorites.map((a) => {
              const qt = quotes.get(a.symbol);
              return (
                <Link key={a.symbol} href="/trade" className="flex items-center justify-between px-4 py-2.5 border-b border-line/50 hover:bg-panel2">
                  <div>
                    <div className="text-[12.5px] font-semibold">{a.symbol}</div>
                    <div className="text-[10.5px] text-faint">{a.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="mono text-[12.5px]">{fmtPrice(qt?.mid, a.digits)}</div>
                    <div className={cn("mono text-[11px]", (qt?.changePct ?? 0) >= 0 ? "text-up" : "text-down")}>{fmtPct(qt?.changePct)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <span className="text-[13px] font-semibold">Recent activity</span>
            <Link href="/history" className="text-[11.5px] text-cyan hover:underline">Full history</Link>
          </div>
          <div>
            {recent.length === 0 && (
              <div className="p-8 text-center text-xs text-faint">
                No trades yet. Open the terminal and place your first demo trade.
              </div>
            )}
            {recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-2.5 border-b border-line/50">
                <div>
                  <div className="text-[12.5px] font-semibold">{r.symbol} <span className="tag tag-demo ml-1">{r.kind === "fixed-time" ? "Fixed" : "Demo"}</span></div>
                  <div className="text-[10.5px] text-faint">{new Date(r.openedAt).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className={cn("text-[11.5px] capitalize", r.status === "won" || r.status === "take_profit" ? "text-up" : r.status === "lost" || r.status === "stop_loss" ? "text-down" : "text-dim")}>{r.status}</div>
                  {r.pnl != null && <div className={cn("mono text-[12px]", pnlColor(r.pnl))}>{fmtMoney(r.pnl)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
