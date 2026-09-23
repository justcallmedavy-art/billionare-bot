"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Users } from "lucide-react";
import { useAuth } from "@/components/providers/auth";
import { useToast } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/modal";
import { fmtMoney, pnlColor } from "@/lib/format";
import { cn } from "@/lib/cn";

type BotRow = {
  id: string; name: string; assetSymbol: string; status: string; stake: number;
  tradeCount: number; winCount: number; lossCount: number; pnl: number; strategyType: string;
};

export default function CopyTradingPage() {
  const router = useRouter();
  const { account } = useAuth();
  const { push } = useToast();
  const [bots, setBots] = useState<BotRow[]>([]);
  const [assets, setAssets] = useState<Array<{ symbol: string; name: string }>>([]);
  const [copy, setCopy] = useState<BotRow | null>(null);
  const [form, setForm] = useState({ name: "", asset: "", stake: 1 });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/bots").then((r) => r.json()).then((j) => { if (j.ok) setBots(j.data.bots); }).catch(() => {});
    fetch("/api/markets").then((r) => r.json()).then((j) => { if (j.ok) setAssets(j.data.assets); }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doCopy() {
    if (!copy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/bots", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cloneFrom: copy.id,
          name: form.name || undefined,
          assetSymbol: form.asset || undefined,
          stake: form.stake,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: "error", title: "Copy failed", body: json.error });
        return;
      }
      push({ kind: "success", title: "Strategy copied", body: "Find it in My Bots — start it when ready." });
      setCopy(null);
      router.push("/bots");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h1 className="text-lg font-extrabold flex items-center gap-2"><Users size={19} className="text-brand" /> Copy trading</h1>
        <p className="text-xs text-dim mt-0.5">
          Replicate any of your own bot strategies onto a different market or stake — same risk engine, separate ledger.
          Leaderboards and third-party strategy copying arrive with the Deriv integration.
        </p>
      </div>

      {bots.length === 0 ? (
        <div className="panel p-10 text-center">
          <Copy size={24} className="text-faint mx-auto mb-3" />
          <div className="text-[14px] font-bold">No bots to copy yet</div>
          <p className="text-[12.5px] text-dim mt-1">Create or load a bot first, then clone its exact configuration here.</p>
          <a href="/bots/store" className="btn btn-primary btn-sm mt-4">Browse the Bot Store</a>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr><th>Bot</th><th>Market</th><th>Status</th><th>Stake</th><th>Trades</th><th>W/L</th><th>P/L</th><th></th></tr>
            </thead>
            <tbody>
              {bots.map((b) => (
                <tr key={b.id}>
                  <td className="font-bold">{b.name}</td>
                  <td>{b.assetSymbol}</td>
                  <td className={cn("font-bold uppercase text-[11px]", b.status === "running" ? "text-up" : b.status === "paused" ? "text-amber" : "text-faint")}>{b.status}</td>
                  <td className="mono">{fmtMoney(b.stake)}</td>
                  <td className="mono">{b.tradeCount}</td>
                  <td className="mono">{b.winCount}/{b.lossCount}</td>
                  <td className={cn("mono font-bold", pnlColor(b.pnl))}>{fmtMoney(b.pnl)}</td>
                  <td>
                    <button
                      className="btn btn-primary btn-xs"
                      onClick={() => { setCopy(b); setForm({ name: `${b.name} (copy)`, asset: b.assetSymbol, stake: b.stake }); }}
                    >
                      <Copy size={11} /> Copy
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={!!copy}
        onClose={() => setCopy(null)}
        onConfirm={doCopy}
        title={`Copy "${copy?.name ?? ""}"`}
        confirmLabel="Create copy"
        busy={busy}
        body={
          <div className="space-y-3">
            <p>Creates a new demo bot with the exact same strategy and risk configuration:</p>
            <div>
              <label className="label">Bot name</label>
              <input className="inp" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Market</label>
                <select className="inp" value={form.asset} onChange={(e) => setForm((f) => ({ ...f, asset: e.target.value }))}>
                  {assets.map((a) => <option key={a.symbol} value={a.symbol}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Stake</label>
                <input className="inp mono" type="number" min={0.5} step={0.5} value={form.stake}
                  onChange={(e) => setForm((f) => ({ ...f, stake: Math.max(0.5, Number(e.target.value) || 0.5) }))} />
              </div>
            </div>
            <div className="text-[11.5px] text-faint">Demo balance: {fmtMoney(account?.demo.balance)}</div>
          </div>
        }
      />
    </div>
  );
}
