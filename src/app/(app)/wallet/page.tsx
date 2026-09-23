"use client";

import { useCallback, useEffect, useState } from "react";
import { Info, Plus, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/components/providers/auth";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { fmtMoney, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

type Tx = {
  id: string; type: string; demo: boolean; amount: number; method: string;
  status: string; reference: string; note: string; createdAt: string;
};

const STATUS_COLOR: Record<string, string> = {
  completed: "text-up", pending: "text-amber", processing: "text-cyan",
  failed: "text-down", rejected: "text-down", cancelled: "text-faint",
};

export default function WalletPage() {
  const { account, refresh } = useAuth();
  const { push } = useToast();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [depositOpen, setDepositOpen] = useState(false);
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/wallet/transactions")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setTxs(j.data.transactions); })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deposit() {
    setBusy(true);
    try {
      const res = await fetch("/api/wallet/transactions?intent=deposit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), method: "demo_credit" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: "error", title: "Credit failed", body: json.error });
        return;
      }
      push({ kind: "success", title: "Demo balance credited", body: "Simulated funds added to your demo ledger." });
      setDepositOpen(false);
      void refresh();
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-lg font-bold">Wallet & funding</h1>

      <div className="panel-2 p-4 flex items-start gap-3 border-cyan/20">
        <Info size={16} className="text-cyan shrink-0 mt-0.5" />
        <div className="text-[12.5px] text-dim">
          This deployment runs in <strong className="text-ink">demo-only mode</strong>. "Funding" adds
          simulated demo balance for practice — it is not a real deposit, no payment is processed, and
          demo funds cannot be withdrawn. Real deposits/withdrawals will appear here only after a
          verified payment provider is connected, and every status change will come from that
          provider's actual confirmation — never simulated.
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="panel p-4">
          <div className="text-[11px] text-faint uppercase tracking-wide">Demo balance</div>
          <div className="mono text-2xl font-bold mt-1.5">{fmtMoney(account?.demo.balance)}</div>
          <div className="text-[10.5px] text-faint mt-1">simulated funds for demo trading</div>
          <button className="btn btn-primary btn-sm mt-3" onClick={() => setDepositOpen(true)}>
            <Plus size={13} /> Add demo funds
          </button>
        </div>
        <div className="panel p-4">
          <div className="text-[11px] text-faint uppercase tracking-wide">Real wallet</div>
          <div className="mono text-2xl font-bold mt-1.5">{fmtMoney(account?.wallet.balance)}</div>
          <div className="text-[10.5px] text-faint mt-1">no payment provider configured</div>
          <button
            className="btn btn-ghost btn-sm mt-3"
            onClick={() => push({
              kind: "info",
              title: "Withdrawals unavailable",
              body: "Real withdrawals require a completed real deposit, which requires a verified payment provider. None is configured on this deployment.",
            })}
          >
            <ArrowUpRight size={13} /> Withdraw
          </button>
        </div>
      </div>

      <div className="panel overflow-x-auto">
        <div className="px-4 py-3 border-b border-line">
          <span className="text-[13px] font-semibold">Transaction ledger</span>
        </div>
        <table className="tbl">
          <thead>
            <tr><th>Reference</th><th>Type</th><th>Mode</th><th>Amount</th><th>Status</th><th>Date</th></tr>
          </thead>
          <tbody>
            {txs.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-xs text-faint">No transactions yet.</td></tr>
            )}
            {txs.map((t) => (
              <tr key={t.id}>
                <td className="mono text-[10.5px] text-faint">{t.reference}</td>
                <td className="capitalize">{t.type}</td>
                <td><span className={t.demo ? "tag tag-demo" : "tag tag-real"}>{t.demo ? "Demo" : "Real"}</span></td>
                <td className="mono font-semibold">{fmtMoney(t.amount)}</td>
                <td className={cn("text-[11.5px] font-semibold uppercase", STATUS_COLOR[t.status] ?? "text-dim")}>{t.status}</td>
                <td className="text-[11px] text-faint">{fmtDateTime(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={depositOpen} onClose={() => setDepositOpen(false)} title="Add demo funds">
        <p className="text-[12.5px] text-dim mb-4">
          Adds simulated balance to your demo account. Clearly labeled demo credit — not real money.
        </p>
        <label className="label">Amount (USD)</label>
        <div className="flex gap-1.5 mb-3">
          {[100, 500, 1000, 5000].map((v) => (
            <button key={v} className={`btn btn-xs flex-1 ${Number(amount) === v ? "btn-primary" : "btn-ghost"}`} onClick={() => setAmount(String(v))}>
              ${v.toLocaleString()}
            </button>
          ))}
        </div>
        <input className="inp mono" type="number" min={1} max={100000} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button className="btn btn-primary w-full mt-4" onClick={deposit} disabled={busy}>
          {busy ? "Crediting…" : "Credit demo balance"}
        </button>
      </Modal>
    </div>
  );
}
