"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/providers/auth";
import { useToast } from "@/components/ui/toast";
import { fmtMoney } from "@/lib/format";
import type { AssetMeta } from "@/components/trading/watchlist";

const STRATEGIES = [
  { id: "rsi_ema", name: "RSI + EMA reversal", desc: "UP when RSI < 30 and price above EMA20; DOWN when RSI > 70 and price below EMA20." },
  { id: "breakout", name: "Range breakout", desc: "UP when price breaks above the 25-candle high; DOWN below the 25-candle low." },
  { id: "digit_evenodd", name: "Digit even/odd", desc: "Pattern strategy on the last price digit. Strictly a demo-teaching strategy — statistically it has no edge." },
];

export default function CreateBotPage() {
  const router = useRouter();
  const { account } = useAuth();
  const { push } = useToast();
  const [assets, setAssets] = useState<AssetMeta[]>([]);
  const [form, setForm] = useState({
    name: "",
    assetSymbol: "EURUSD",
    strategyType: "rsi_ema",
    stake: 1,
    durationSec: 60,
    maxDailyLoss: 25,
    maxTrades: 40,
    maxConsecutiveLosses: 4,
  });
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    fetch("/api/markets")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setAssets(j.data.assets); })
      .catch(() => {});
  }, []);

  const balance = account?.demo.balance ?? 0;
  const invalid = !form.name.trim() || !confirmed || form.stake > balance;

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/bots", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, demo: true, strategyParams: { durationSec: form.durationSec } }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: "error", title: "Could not create bot", body: json.error });
        return;
      }
      push({ kind: "success", title: "Bot created", body: "Start it from the DollarPrinter dashboard." });
      router.push("/bots");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-bold flex items-center gap-2"><Bot size={18} className="text-cyan" /> Create DOLLARPRINTER bot</h1>
        <p className="text-xs text-dim mt-0.5">Bots run in DEMO mode on the simulated feed. Real-mode bots unlock only after a verified broker connection.</p>
      </div>

      <div className="panel p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Bot name</label>
            <input className="inp" placeholder="e.g. London Reversal V1" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Account</label>
            <div className="inp flex items-center gap-2 opacity-80">
              <span className="tag tag-demo">Demo</span>
              <span className="text-[12px] text-dim">simulated ledger · {fmtMoney(balance)}</span>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Asset</label>
            <select className="inp" value={form.assetSymbol} onChange={(e) => setForm((f) => ({ ...f, assetSymbol: e.target.value }))}>
              {assets.map((a) => <option key={a.symbol} value={a.symbol}>{a.symbol} — {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Trade duration</label>
            <select className="inp" value={form.durationSec} onChange={(e) => setForm((f) => ({ ...f, durationSec: Number(e.target.value) }))}>
              <option value={60}>1 minute</option>
              <option value={300}>5 minutes</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Strategy</label>
          <div className="space-y-2">
            {STRATEGIES.map((s) => (
              <button
                key={s.id}
                className={`w-full text-left panel-2 px-3.5 py-3 transition-colors ${form.strategyType === s.id ? "border-cyan" : "hover:border-line2"}`}
                onClick={() => setForm((f) => ({ ...f, strategyType: s.id }))}
              >
                <div className="text-[13px] font-semibold flex items-center gap-2">
                  {form.strategyType === s.id && <span className="w-1.5 h-1.5 rounded-full bg-cyan" />}
                  {s.name}
                </div>
                <div className="text-[11.5px] text-faint mt-0.5">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="label">Stake / trade</label>
            <input className="inp mono" type="number" min={1} value={form.stake}
              onChange={(e) => setForm((f) => ({ ...f, stake: Math.max(1, Number(e.target.value) || 1) }))} />
          </div>
          <div>
            <label className="label">Max daily loss</label>
            <input className="inp mono" type="number" min={1} value={form.maxDailyLoss}
              onChange={(e) => setForm((f) => ({ ...f, maxDailyLoss: Math.max(1, Number(e.target.value) || 1) }))} />
          </div>
          <div>
            <label className="label">Max trades / day</label>
            <input className="inp mono" type="number" min={1} value={form.maxTrades}
              onChange={(e) => setForm((f) => ({ ...f, maxTrades: Math.max(1, Number(e.target.value) || 1) }))} />
          </div>
          <div>
            <label className="label">Max consec. losses</label>
            <input className="inp mono" type="number" min={1} value={form.maxConsecutiveLosses}
              onChange={(e) => setForm((f) => ({ ...f, maxConsecutiveLosses: Math.max(1, Number(e.target.value) || 1) }))} />
          </div>
        </div>

        <div className="panel-2 p-3.5 flex items-start gap-3 border-amber/30">
          <ShieldAlert size={16} className="text-amber shrink-0 mt-0.5" />
          <div className="text-[12px] text-dim">
            <strong className="text-ink">Risk acknowledgement.</strong> Even in demo, this bot will place
            trades automatically and can lose repeatedly. The daily loss limit ({fmtMoney(form.maxDailyLoss)})
            and consecutive-loss pause are enforced server-side. Automated strategies do not guarantee
            profits under any circumstances.
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-[12.5px] text-dim cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}
            className="w-4 h-4 accent-blue-500" />
          I understand this bot trades automatically in DEMO mode and that results are simulated.
        </label>

        <button className="btn btn-primary w-full" disabled={invalid || busy} onClick={create}>
          {busy ? "Creating…" : "Create demo bot"}
        </button>
      </div>
    </div>
  );
}
