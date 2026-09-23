"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Zap, ArrowLeft } from "lucide-react";
import { fmtPct, fmtPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

type Quote = { symbol: string; mid: number | null; changePct: number | null; digits: number };

export default function MarketsPreviewPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  useEffect(() => {
    const es = new EventSource("/api/market/stream");
    es.addEventListener("snapshot", (ev) => {
      setQuotes(JSON.parse((ev as MessageEvent).data).quotes);
    });
    es.addEventListener("quotes", (ev) => {
      const msg = JSON.parse((ev as MessageEvent).data);
      setQuotes((prev) => {
        const map = new Map(prev.map((q) => [q.symbol, q]));
        for (const q of msg.quotes) if (map.has(q.symbol)) map.set(q.symbol, q);
        return [...map.values()];
      });
    });
    es.onerror = () => es.close();
    return () => es.close();
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-panel sticky top-0 z-40 h-13 flex items-center px-4 gap-3">
        <Link href="/" className="flex items-center gap-2 text-dim hover:text-ink text-[13px]">
          <ArrowLeft size={15} /> Back
        </Link>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <span className="font-extrabold text-sm text-ink">Billinare <span className="text-brand">Deal Option</span></span>
        </div>
        <div className="flex-1" />
        <Link href="/register" className="btn btn-primary btn-sm">Create account</Link>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-baseline gap-3 mb-1">
          <h1 className="text-2xl font-bold">Live market overview</h1>
          <span className="tag tag-demo">Simulated feed</span>
        </div>
        <p className="text-[13px] text-dim mb-6">
          Prices update in real time from the platform's simulated feed. Create a free demo account to
          trade them with professional tools.
        </p>

        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Asset</th><th>Price</th><th>Change</th></tr></thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.symbol}>
                  <td className="font-semibold">{q.symbol}</td>
                  <td className="mono">{fmtPrice(q.mid, q.digits)}</td>
                  <td className={cn("mono", (q.changePct ?? 0) >= 0 ? "text-up" : "text-down")}>{fmtPct(q.changePct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
