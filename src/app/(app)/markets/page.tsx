"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { useFeed } from "@/components/providers/market-feed";
import { fmtPct, fmtPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

type Asset = {
  symbol: string; name: string; category: string; digits: number;
  payoutRate: number; contractSize: number;
};

const CATS = [
  { id: "all", label: "All markets" },
  { id: "forex", label: "Forex" },
  { id: "crypto", label: "Crypto" },
  { id: "indices", label: "Indices" },
  { id: "commodities", label: "Energy" },
  { id: "metals", label: "Metals" },
];

export default function MarketsPage() {
  const { quotes } = useFeed();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [cat, setCat] = useState("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"symbol" | "changePct">("symbol");

  useEffect(() => {
    fetch("/api/markets")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setAssets(j.data.assets); })
      .catch(() => {});
  }, []);

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = assets.filter((a) =>
      (cat === "all" || a.category === cat) &&
      (!q || a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)),
    );
    return filtered.sort((a, b) => {
      if (sortKey === "symbol") return a.symbol.localeCompare(b.symbol);
      const ca = quotes.get(a.symbol)?.changePct ?? -999;
      const cb = quotes.get(b.symbol)?.changePct ?? -999;
      return cb - ca;
    });
  }, [assets, cat, search, sortKey, quotes]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold mr-2">Markets</h1>
        {CATS.map((c) => (
          <button key={c.id} className={`btn btn-xs ${cat === c.id ? "btn-primary" : "btn-ghost"}`} onClick={() => setCat(c.id)}>
            {c.label}
          </button>
        ))}
        <div className="flex-1" />
        <input className="inp max-w-[220px] py-1.5 text-xs" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="inp max-w-[150px] py-1.5 text-xs" value={sortKey} onChange={(e) => setSortKey(e.target.value as "symbol" | "changePct")}>
          <option value="symbol">Sort: A–Z</option>
          <option value="changePct">Sort: Top movers</option>
        </select>
      </div>

      <div className="panel overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>★</th><th>Asset</th><th>Bid</th><th>Ask</th><th>Spread</th><th>Change %</th><th>Payout</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const qt = quotes.get(a.symbol);
              const spread = (qt?.ask ?? 0) - (qt?.bid ?? 0);
              return (
                <tr key={a.symbol}>
                  <td><Star size={12} className="text-faint" /></td>
                  <td>
                    <div className="font-semibold">{a.symbol}</div>
                    <div className="text-[10.5px] text-faint">{a.name}</div>
                  </td>
                  <td className="mono text-down">{fmtPrice(qt?.bid, a.digits)}</td>
                  <td className="mono text-up">{fmtPrice(qt?.ask, a.digits)}</td>
                  <td className="mono text-faint">{fmtPrice(spread, a.digits)}</td>
                  <td className={cn("mono", (qt?.changePct ?? 0) >= 0 ? "text-up" : "text-down")}>{fmtPct(qt?.changePct)}</td>
                  <td className="mono text-dim">{(a.payoutRate * 100).toFixed(0)}%</td>
                  <td>
                    <Link href="/trade" className="btn btn-ghost btn-xs">Trade</Link>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-faint text-xs">No markets match your filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
