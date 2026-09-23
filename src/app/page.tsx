"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight, BarChart3, Bot, Check, Globe2, Lock, LineChart,
  ShieldCheck, Smartphone, Timer, Wallet, Zap,
} from "lucide-react";

type Quote = { symbol: string; mid: number | null; changePct: number | null; digits: number };

function useLiveQuotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  useEffect(() => {
    const es = new EventSource("/api/market/stream");
    es.addEventListener("snapshot", (ev) => {
      const msg = JSON.parse((ev as MessageEvent).data);
      setQuotes(msg.quotes.slice(0, 14));
    });
    es.addEventListener("quotes", (ev) => {
      const msg = JSON.parse((ev as MessageEvent).data);
      setQuotes((prev) => {
        const map = new Map(prev.map((q) => [q.symbol, q]));
        for (const q of msg.quotes) if (map.has(q.symbol)) map.set(q.symbol, q);
        return [...map.values()].slice(0, 14);
      });
    });
    es.onerror = () => es.close();
    return () => es.close();
  }, []);
  return quotes;
}

const FEATURES = [
  { icon: LineChart, title: "Institutional-grade charts", body: "Candlesticks, six timeframes, and technical indicators — SMA, EMA, Bollinger Bands — rendered live as ticks arrive." },
  { icon: Timer, title: "Fixed-time deals", body: "Take an UP or DOWN view with a defined stake and a transparent, fixed payout rate shown before you confirm. Demo mode." },
  { icon: Bot, title: "DollarPrinter automation", body: "Build rule-based bots with RSI, breakout, and digit strategies — mandatory risk limits, kill switch, full trade logs." },
  { icon: Globe2, title: "Global markets", body: "Forex majors, crypto, indices, commodities, and metals in one dense, watchlist-driven terminal." },
  { icon: ShieldCheck, title: "Risk controls first", body: "Daily loss limits, consecutive-loss pauses, exposure caps, and an emergency stop — enforced server-side." },
  { icon: Smartphone, title: "Built for one hand", body: "Responsive layout with mobile bottom navigation so analysis, order entry, and monitoring work anywhere." },
];

const MARKETS = [
  { name: "Forex", desc: "EUR/USD · GBP/USD · USD/JPY · 10 majors" },
  { name: "Crypto", desc: "BTC/USD · ETH/USD · SOL/USD · XRP/USD" },
  { name: "Indices", desc: "US30 · NAS100 · SPX500 · GER40" },
  { name: "Commodities", desc: "WTI · Brent · Natural Gas" },
  { name: "Metals", desc: "Gold · Silver · Platinum" },
];

export default function LandingPage() {
  const quotes = useLiveQuotes();
  const tickerQuotes = quotes.length ? [...quotes, ...quotes] : [];

  return (
    <div className="min-h-screen bg-bg">
      {/* NAV */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-line">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-extrabold text-ink">Billinare <span className="text-brand">Deal Option</span></span>
          </div>
          <div className="flex-1" />
          <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
          <Link href="/register" className="btn btn-primary btn-sm">Create account</Link>
        </div>
      </header>

      {/* RED ANNOUNCEMENT BAR */}
      <div className="bg-redbar text-white overflow-hidden">
        <div className="h-7 flex items-center">
          <div className="anim-ticker flex gap-12 w-max whitespace-nowrap text-[11px] font-bold tracking-wide px-4">
            {[0, 1].map((dup) => (
              <span key={dup} className="flex gap-12">
                <span>WELCOME TO BILLINARE DEAL OPTION — YOUR TERMINAL FOR FOREX, DIGITAL OPTIONS & AUTOMATED STRATEGIES</span>
                <span>LIVE SIMULATED FEED · DEMO-FIRST PLATFORM</span>
                <span>RISK WARNING: TRADING CARRIES SUBSTANTIAL RISK — PRACTICE ON DEMO FIRST</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 anim-grid pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-16 text-center">
          <div className="anim-fadeup inline-flex items-center gap-2 panel-2 px-3 py-1.5 text-[11.5px] text-dim mb-6">
            <span className="dot dot-live" /> Live simulated feed · demo-first platform
          </div>
          <h1 className="anim-fadeup anim-delay-1 text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.08] text-ink">
            Trade global markets from
            <br />
            <span className="bg-gradient-to-r from-brand via-teal-500 to-brand bg-clip-text text-transparent">one powerful terminal.</span>
          </h1>
          <p className="anim-fadeup anim-delay-2 text-dim text-base md:text-lg mt-5 max-w-2xl mx-auto">
            Real-time market data, advanced charts, fixed-time deals, and rule-based automation —
            in a professional light terminal built for focus.
          </p>
          <div className="anim-fadeup anim-delay-3 flex items-center justify-center gap-3 mt-8">
            <Link href="/register" className="btn btn-primary anim-glow" style={{ padding: "11px 22px", fontSize: 14 }}>
              Start trading <ArrowRight size={15} />
            </Link>
            <Link href="/markets-preview" className="btn btn-ghost" style={{ padding: "11px 22px", fontSize: 14 }}>
              Explore markets
            </Link>
          </div>
          <p className="anim-fadeup anim-delay-4 text-[11.5px] text-faint mt-4">
            Every new account includes a simulated demo balance. No real-money deposits are processed on this deployment.
          </p>

          {/* Terminal mock */}
          <div className="anim-fadeup anim-delay-4 mt-14 panel max-w-4xl mx-auto overflow-hidden text-left anim-float">
            <div className="flex items-center gap-2 px-4 h-10 border-b border-line bg-navy">
              <span className="dot dot-live" />
              <span className="text-[11px] text-white/80 font-semibold">EUR/USD · simulated feed</span>
              <div className="flex-1" />
              <span className="tag tag-demo">Demo</span>
            </div>
            <div className="grid grid-cols-12">
              <div className="col-span-4 sm:col-span-3 border-r border-line p-3 space-y-2 hidden sm:block">
                {(quotes.length ? quotes.slice(0, 6) : Array.from({ length: 6 })).map((q, i) => {
                  const item = q as Quote | undefined;
                  return (
                    <div key={i} className="flex items-center justify-between text-[11.5px]">
                      <span className="text-dim font-semibold">{item?.symbol ?? "······"}</span>
                      <span className={`mono font-bold ${((item?.changePct ?? 0) >= 0 ? "text-up" : "text-down")}`}>
                        {item ? item.mid?.toFixed(item.digits) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="col-span-12 sm:col-span-9 p-4">
                <MockChart />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICE TICKER STRIP */}
      <section className="border-y border-line bg-navy overflow-hidden py-2.5">
        <div className="anim-ticker flex gap-8 w-max">
          {tickerQuotes.map((q, i) => (
            <span key={i} className="text-[12px] mono whitespace-nowrap">
              <span className="text-white/70 font-semibold">{q.symbol}</span>{" "}
              <span className="text-white font-bold">{q.mid?.toFixed(q.digits) ?? "—"}</span>{" "}
              <span className={(q.changePct ?? 0) >= 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                {(q.changePct ?? 0) >= 0 ? "▲" : "▼"} {Math.abs(q.changePct ?? 0).toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <h2 className="text-2xl md:text-3xl font-extrabold text-center text-ink">A terminal, not a toy.</h2>
        <p className="text-dim text-center mt-3 max-w-xl mx-auto">
          Every surface is built for speed and clarity — dense market data, precise order tickets, and honest accounting.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
          {FEATURES.map((f, i) => (
            <div key={f.title} className={`panel p-5 anim-fadeup anim-delay-${(i % 4) + 1}`}>
              <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center mb-3">
                <f.icon size={17} className="text-brand" />
              </div>
              <h3 className="font-bold text-[15px] text-ink">{f.title}</h3>
              <p className="text-[13px] text-dim mt-1.5 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MARKETS */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="panel p-6 md:p-10 border-t-4 border-t-brand">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-ink">All major markets. One watchlist.</h2>
              <p className="text-dim mt-3 text-[14.5px]">
                Organize the instruments you trade with favorites, categories, and live spread data.
                Switch assets in one click and the terminal resubscribes instantly.
              </p>
              <Link href="/register" className="btn btn-primary mt-6">Open the terminal <ArrowRight size={15} /></Link>
            </div>
            <div className="space-y-2">
              {MARKETS.map((m) => (
                <div key={m.name} className="panel-2 px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[13.5px] text-ink">{m.name}</div>
                    <div className="text-[11.5px] text-faint">{m.desc}</div>
                  </div>
                  <BarChart3 size={16} className="text-icred" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HONESTY SECTION */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="panel-2 p-6 md:p-8 border-brand/30">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber/15 border border-amber/40 flex items-center justify-center shrink-0">
              <Lock size={18} className="text-amber" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-ink">Honest by design</h2>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 mt-4 text-[13.5px] text-dim">
                {[
                  "Simulated demo feed, clearly labeled everywhere",
                  "Demo ledger fully separated from any wallet",
                  "No profit guarantees — ever",
                  "Bots require risk limits before they can run",
                  "Real trading stays disabled until a verified broker is connected",
                  "Full trade history with exports you can audit",
                ].map((t) => (
                  <div key={t} className="flex items-center gap-2">
                    <Check size={14} className="text-up shrink-0 font-bold" /> {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 pb-24 text-center">
        <h2 className="text-2xl md:text-4xl font-extrabold text-ink">Practice with purpose.</h2>
        <p className="text-dim mt-3 max-w-lg mx-auto">
          Build strategies in a fully simulated environment with professional tooling — then decide when
          you're ready to connect a real broker.
        </p>
        <Link href="/register" className="btn btn-primary mt-7" style={{ padding: "12px 26px", fontSize: 14 }}>
          <Wallet size={15} /> Create your demo account
        </Link>
      </section>

      <footer className="border-t border-line bg-white py-10">
        <div className="max-w-6xl mx-auto px-4 grid sm:grid-cols-3 gap-8 text-[12.5px] text-faint">
          <div>
            <div className="flex items-center gap-2 text-ink font-bold mb-2">
              <Zap size={14} className="text-brand" /> Billinare Deal Option
            </div>
            A demonstration trading platform. All balances and trades shown are simulated unless a
            verified external provider is explicitly connected.
          </div>
          <div>
            <div className="text-ink font-bold mb-2">Product</div>
            <div className="space-y-1.5">
              <Link href="/login" className="block hover:text-dim">Trading terminal</Link>
              <Link href="/register" className="block hover:text-dim">Create account</Link>
              <Link href="/legal/risk-disclosure" className="block hover:text-dim">Risk disclosure</Link>
            </div>
          </div>
          <div>
            <div className="text-ink font-bold mb-2">Risk warning</div>
            Trading carries a high level of risk. Simulated results have no bearing on future performance.
            Nothing on this platform is financial advice.
          </div>
        </div>
      </footer>
    </div>
  );
}

function MockChart() {
  // Deterministic walk (seeded) so SSR and client markup match exactly.
  const points: number[] = [];
  let v = 60;
  let seed = 42;
  for (let i = 0; i < 90; i++) {
    seed = (seed * 16807) % 2147483647;
    const r = seed / 2147483647;
    v += (r - 0.48) * 6;
    v = Math.max(18, Math.min(96, v));
    points.push(v);
  }
  const w = 640, h = 150;
  const step = w / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - p).toFixed(1)}`).join(" ");
  const area = `${d} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 150 }}>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lg)" />
      <path d={d} fill="none" stroke="#2563eb" strokeWidth="1.8" />
    </svg>
  );
}
