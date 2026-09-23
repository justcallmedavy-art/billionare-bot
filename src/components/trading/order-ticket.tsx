"use client";

import { useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useFeed } from "@/components/providers/market-feed";
import { useAuth } from "@/components/providers/auth";
import { useToast } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/modal";
import { fmtMoney, fmtPrice } from "@/lib/format";
import type { AssetMeta } from "@/components/trading/watchlist";

const DURATIONS = [
  { sec: 60, label: "1 min" },
  { sec: 300, label: "5 min" },
  { sec: 900, label: "15 min" },
  { sec: 1800, label: "30 min" },
  { sec: 3600, label: "1 hour" },
];

export function OrderTicket({
  asset, onPlaced,
}: {
  asset: AssetMeta;
  onPlaced: () => void;
}) {
  const { quotes } = useFeed();
  const { account, refresh } = useAuth();
  const { push } = useToast();
  const [tab, setTab] = useState<"forex" | "fixed-time">("fixed-time");
  const [confirm, setConfirm] = useState<null | { label: string; body: string; run: () => Promise<void> }>(null);
  const [busy, setBusy] = useState(false);

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [lots, setLots] = useState(0.1);
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");

  const [direction, setDirection] = useState<"up" | "down">("up");
  const [stake, setStake] = useState(10);
  const [durationSec, setDurationSec] = useState(60);

  const q = quotes.get(asset.symbol);
  const payoutRate = asset.payoutRate;
  const potentialPayout = useMemo(() => stake * (1 + payoutRate), [stake, payoutRate]);
  const potentialProfit = useMemo(() => stake * payoutRate, [stake, payoutRate]);
  const margin = useMemo(() => lots * 1000, [lots]);

  function submitForex(s: "buy" | "sell") {
    const balance = account?.demo.balance ?? 0;
    if (margin > balance) {
      push({ kind: "error", title: "Insufficient demo margin", body: `Needed ${fmtMoney(margin)}, available ${fmtMoney(balance)}.` });
      return;
    }
    setConfirm({
      label: `${s.toUpperCase()} ${lots} ${asset.symbol}`,
      body: `Open a demo ${s.toUpperCase()} position of ${lots} lots on ${asset.symbol} at ~${fmtPrice(s === "buy" ? q?.ask : q?.bid, asset.digits)}? Margin: ${fmtMoney(margin)}. This is a DEMO trade.`,
      run: async () => {
        await place({ mode: "forex", demo: true, symbol: asset.symbol, side: s, lots, sl: sl ? Number(sl) : null, tp: tp ? Number(tp) : null });
      },
    });
  }

  function submitFixedTime(d: "up" | "down") {
    const balance = account?.demo.balance ?? 0;
    if (stake > balance) {
      push({ kind: "error", title: "Insufficient demo balance", body: `Stake ${fmtMoney(stake)} exceeds available ${fmtMoney(balance)}.` });
      return;
    }
    setConfirm({
      label: `${d.toUpperCase()} · ${fmtMoney(stake)}`,
      body: `Place a DEMO fixed-time deal: ${asset.symbol} will be ${d === "up" ? "higher" : "lower"} than ${fmtPrice(q?.mid, asset.digits)} in ${DURATIONS.find((x) => x.sec === durationSec)?.label}? Payout if correct: ${fmtMoney(potentialPayout)}.`,
      run: async () => {
        await place({ mode: "fixed-time", demo: true, symbol: asset.symbol, direction: d, stake, durationSec });
      },
    });
  }

  async function place(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/trades", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: "error", title: "Order rejected", body: json.error ?? "The order could not be placed." });
        return;
      }
      push({
        kind: "success",
        title: json.data.kind === "position" ? "Position opened" : "Deal placed",
        body: `Entry ${fmtPrice(json.data.entryPrice, asset.digits)} · DEMO`,
      });
      await refresh();
      onPlaced();
    } catch {
      push({ kind: "error", title: "Network error", body: "The order could not be submitted. Check your connection." });
    } finally {
      setBusy(false);
    }
  }

  const balance = account?.demo.balance ?? 0;

  return (
    <div className="panel flex flex-col overflow-hidden">
      {/* Mode tabs */}
      <div className="grid grid-cols-2 border-b border-line shrink-0">
        <button
          className={`py-3 text-[12.5px] font-bold ${tab === "fixed-time" ? "text-ink border-b-2 border-brand bg-brand/5" : "text-dim hover:text-ink"}`}
          onClick={() => setTab("fixed-time")}
        >
          Fixed-Time
        </button>
        <button
          className={`py-3 text-[12.5px] font-bold ${tab === "forex" ? "text-ink border-b-2 border-brand bg-brand/5" : "text-dim hover:text-ink"}`}
          onClick={() => setTab("forex")}
        >
          Forex / CFD
        </button>
      </div>

      <div className="p-3.5 space-y-3 overflow-y-auto">
        <div className="flex items-center justify-between text-[11.5px]">
          <span className="tag tag-demo">Demo account</span>
          <span className="text-faint">Balance <span className="mono text-ink font-bold">{fmtMoney(balance)}</span></span>
        </div>

        {tab === "forex" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button className={`btn ${side === "buy" ? "btn-up" : "btn-ghost"}`} onClick={() => setSide("buy")}>
                <TrendingUp size={14} /> BUY <span className="mono text-[10.5px] opacity-85">{fmtPrice(q?.ask, asset.digits)}</span>
              </button>
              <button className={`btn ${side === "sell" ? "btn-down" : "btn-ghost"}`} onClick={() => setSide("sell")}>
                <TrendingDown size={14} /> SELL <span className="mono text-[10.5px] opacity-85">{fmtPrice(q?.bid, asset.digits)}</span>
              </button>
            </div>

            <div>
              <label className="label">Lots</label>
              <select className="inp mono" value={lots} onChange={(e) => setLots(Number(e.target.value))}>
                <option value={0.01}>0.01</option>
                <option value={0.05}>0.05</option>
                <option value={0.1}>0.10</option>
                <option value={0.5}>0.50</option>
                <option value={1}>1.00</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Stop loss</label>
                <input className="inp mono" placeholder="—" value={sl} onChange={(e) => setSl(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <label className="label">Take profit</label>
                <input className="inp mono" placeholder="—" value={tp} onChange={(e) => setTp(e.target.value)} inputMode="decimal" />
              </div>
            </div>

            <div className="panel-2 p-3 space-y-1.5 text-[11.5px]">
              <Row label="Required margin" value={fmtMoney(margin)} />
              <Row label="Pip value (approx.)" value={fmtMoney(lots * (asset.contractSize * 0.0001))} />
              <Row label="Current spread" value={fmtPrice((q?.ask ?? 0) - (q?.bid ?? 0), asset.digits)} />
            </div>

            <button className="btn btn-primary w-full" onClick={() => submitForex(side)} disabled={busy}>
              {side.toUpperCase()} {lots} {asset.symbol}
            </button>
          </>
        ) : (
          <>
            <div>
              <label className="label">Stake</label>
              <div className="flex gap-1.5">
                {[5, 10, 25, 50, 100].map((v) => (
                  <button key={v} className={`btn btn-xs flex-1 ${stake === v ? "btn-primary" : "btn-ghost"}`} onClick={() => setStake(v)}>${v}</button>
                ))}
              </div>
              <input
                className="inp mono mt-1.5" type="number" min={1} max={5000} value={stake}
                onChange={(e) => setStake(Math.max(1, Math.min(5000, Number(e.target.value) || 1)))}
              />
            </div>

            <div>
              <label className="label">Duration</label>
              <div className="grid grid-cols-5 gap-1">
                {DURATIONS.map((d) => (
                  <button
                    key={d.sec}
                    className={`btn btn-xs ${durationSec === d.sec ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setDurationSec(d.sec)}
                  >
                    {d.label.replace(" ", "")}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-2 p-3 space-y-1.5 text-[11.5px]">
              <Row label="Payout rate" value={`${(payoutRate * 100).toFixed(0)}%`} />
              <Row label="Potential payout" value={fmtMoney(potentialPayout)} strong />
              <Row label="Potential profit" value={fmtMoney(potentialProfit)} />
              <Row label="Entry reference" value={fmtPrice(q?.mid, asset.digits)} />
            </div>

            {/* Reference-style split trade buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <button className="btn btn-up py-3.5 text-[14px]" onClick={() => submitFixedTime("up")} disabled={busy}>
                <TrendingUp size={17} /> UP
              </button>
              <button className="btn btn-down py-3.5 text-[14px]" onClick={() => submitFixedTime("down")} disabled={busy}>
                <TrendingDown size={17} /> DOWN
              </button>
            </div>
            <p className="text-[10.5px] text-faint text-center">
              Percentages shown describe the demo feed only. Demo trades carry no real-money risk.
            </p>
          </>
        )}
      </div>

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => { void confirm?.run(); }}
        title="Confirm demo order"
        confirmLabel="Place demo order"
        body={<span>{confirm?.body}</span>}
      />
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-faint">{label}</span>
      <span className={`mono ${strong ? "text-up font-extrabold" : "font-semibold text-ink"}`}>{value}</span>
    </div>
  );
}
