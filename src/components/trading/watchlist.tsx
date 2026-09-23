"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { useFeed, type Quote } from "@/components/providers/market-feed";
import { fmtPct } from "@/lib/format";

export type AssetMeta = {
  symbol: string; name: string; category: string; digits: number;
  payoutRate: number; contractSize: number;
};

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "favorites", label: "★" },
  { id: "forex", label: "Forex" },
  { id: "crypto", label: "Crypto" },
  { id: "indices", label: "Indices" },
  { id: "commodities", label: "Energy" },
  { id: "metals", label: "Metals" },
];

export function Watchlist({
  assets, selected, onSelect, compact = false,
}: {
  assets: AssetMeta[];
  selected: string;
  onSelect: (symbol: string) => void;
  compact?: boolean;
}) {
  const { quotes } = useFeed();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setFavorites(new Set(j.data.assetIds)); })
      .catch(() => {});
  }, []);

  async function toggleFav(symbol: string, e: React.MouseEvent) {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
    await fetch("/api/watchlist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    }).catch(() => {});
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (cat === "favorites" && !favorites.has(a.symbol)) return false;
      if (cat !== "all" && cat !== "favorites" && a.category !== cat) return false;
      if (q && !a.symbol.toLowerCase().includes(q) && !a.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [assets, search, cat, favorites]);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-2.5 border-b border-line space-y-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            className="inp pl-7 py-1.5 text-xs"
            placeholder="Search assets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`btn btn-xs ${cat === c.id ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setCat(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-xs text-faint">No assets match your filters</div>
        )}
        {filtered.map((a) => {
          const q: Quote | undefined = quotes.get(a.symbol);
          const up = (q?.changePct ?? 0) >= 0;
          return (
            <button
              key={a.symbol}
              onClick={() => onSelect(a.symbol)}
              className={`w-full text-left px-2.5 py-2 border-b border-line/60 transition-colors ${
                selected === a.symbol ? "bg-brand/5 border-l-[3px] border-l-brand" : "hover:bg-panel2"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="text-faint hover:text-amber cursor-pointer shrink-0"
                  onClick={(e) => toggleFav(a.symbol, e)}
                  aria-label="Favorite"
                >
                  <Star size={12} className={favorites.has(a.symbol) ? "fill-amber text-amber" : ""} />
                </span>
                <span className="text-[12px] font-bold text-ink">{a.symbol}</span>
                <div className="flex-1" />
                <span className={`text-[11px] mono font-bold ${up ? "text-up" : "text-down"}`}>
                  {fmtPct(q?.changePct)}
                </span>
              </div>
              {!compact && (
                <div className="flex items-center justify-between mt-0.5 pl-[18px]">
                  <span className="text-[10.5px] text-faint truncate">{a.name}</span>
                </div>
              )}
              <div className="flex items-center justify-between mt-0.5 pl-[18px] mono text-[11px]">
                <span className="text-down font-bold">{fmtNum(q?.bid, a.digits)}</span>
                <span className="text-up font-bold">{fmtNum(q?.ask, a.digits)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function fmtNum(v: number | null | undefined, digits: number) {
  if (v == null) return "—";
  return v.toFixed(digits);
}
