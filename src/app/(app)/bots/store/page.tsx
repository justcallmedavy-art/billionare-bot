"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Search, Zap } from "lucide-react";
import { useAuth } from "@/components/providers/auth";
import { useToast } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/modal";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/cn";

type StoreBot = {
  slug: string; name: string; origin: string; category: string; description: string;
  suggestedAsset: string; durationSec: number; martingale: boolean; riskNote: string;
  risk: { maxDailyLoss: number; maxTrades: number; maxConsecutiveLosses: number; takeProfit?: number };
};

type Asset = { symbol: string; name: string; digits: number };

export default function BotStorePage() {
  const router = useRouter();
  const { account } = useAuth();
  const { push } = useToast();
  const [bots, setBots] = useState<StoreBot[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [deploy, setDeploy] = useState<StoreBot | null>(null);
  const [form, setForm] = useState({ asset: "", stake: 1, maxDailyLoss: 20, maxTrades: 40, maxConsecutiveLosses: 5 });
  const [busy, setBusy] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);

  const load = useCallback(() => {
    fetch("/api/bots/store").then((r) => r.json()).then((j) => { if (j.ok) setBots(j.data.bots); }).catch(() => {});
    fetch("/api/markets").then((r) => r.json()).then((j) => { if (j.ok) setAssets(j.data.assets); }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  function openDeploy(b: StoreBot) {
    setDeploy(b);
    setForm({
      asset: b.suggestedAsset,
      stake: 1,
      maxDailyLoss: b.risk.maxDailyLoss,
      maxTrades: b.risk.maxTrades,
      maxConsecutiveLosses: b.risk.maxConsecutiveLosses,
    });
    setDeployOpen(true);
  }

  async function doDeploy() {
    if (!deploy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/bots/store", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: deploy.slug, assetSymbol: form.asset, ...form }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: "error", title: "Load failed", body: json.error });
        return;
      }
      await fetch(`/api/bots/${json.data.botId}/actions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      push({ kind: "success", title: `${deploy.name} loaded & running`, body: "Demo paper execution — track it in My Bots." });
      setDeployOpen(false);
      router.push("/bots");
    } finally {
      setBusy(false);
    }
  }

  const cats = ["All", ...new Set(bots.map((b) => b.category))];
  const filtered = bots.filter((b) =>
    (cat === "All" || b.category === cat) &&
    (!search || b.name.toLowerCase().includes(search.toLowerCase()) || b.description.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-extrabold flex items-center gap-2"><Bot size={19} className="text-brand" /> Bot Store</h1>
          <p className="text-xs text-dim mt-0.5">
            Strategy templates you can load and run instantly as your own demo bots. Configurations, not profit promises.
          </p>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
          <input className="inp pl-7 py-2 text-xs max-w-[240px]" placeholder="Search bots…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {cats.map((c) => (
          <button key={c} className={`btn btn-xs ${cat === c ? "btn-primary" : "btn-ghost"}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((b) => (
          <div key={b.slug} className="panel p-5 flex flex-col gap-3 relative overflow-hidden">
            <span className="badge-premium absolute top-3 right-0" style={{ borderRadius: "6px 0 0 6px" }}>Loadable</span>
            <div className="flex items-start gap-3 pt-4">
              <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
                <Bot size={18} className="text-brand" />
              </div>
              <div>
                <div className="font-extrabold text-[14px] text-brand">{b.name}</div>
                <div className="text-[10.5px] text-faint uppercase font-bold tracking-wide">{b.category}</div>
                <div className="text-[10px] text-dim mt-0.5">{b.origin}</div>
              </div>
            </div>
            <p className="text-[12.5px] text-dim leading-relaxed flex-1">{b.description}</p>
            <div className="text-[11px] text-faint space-y-0.5">
              <div>Suggested market: <strong className="text-dim">{b.suggestedAsset}</strong> · {b.durationSec / 60} min deals</div>
              {b.martingale && <div className="text-amber font-semibold">Uses martingale stake escalation</div>}
            </div>
            <div className="panel-2 px-3 py-2 text-[11px] text-dim flex items-start gap-2">
              <Zap size={12} className="text-amber shrink-0 mt-0.5" /> {b.riskNote}
            </div>
            <button className="btn btn-primary w-full" onClick={() => openDeploy(b)}>LOAD &amp; RUN DEMO</button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="panel p-10 text-center text-[13px] text-faint col-span-full">No bots match your search.</div>
        )}
      </div>

      <ConfirmModal
        open={deployOpen}
        onClose={() => setDeployOpen(false)}
        onConfirm={doDeploy}
        title={`Load ${deploy?.name ?? "bot"}`}
        confirmLabel="Load & run"
        busy={busy}
        body={
          <div className="space-y-3">
            <p>Configures and starts this bot on your demo account ({fmtMoney(account?.demo.balance)} available):</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Market</label>
                <select className="inp" value={form.asset} onChange={(e) => setForm((f) => ({ ...f, asset: e.target.value }))}>
                  {assets.map((a) => <option key={a.symbol} value={a.symbol}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Stake per trade</label>
                <input className="inp mono" type="number" min={0.5} step={0.5} value={form.stake}
                  onChange={(e) => setForm((f) => ({ ...f, stake: Math.max(0.5, Number(e.target.value) || 0.5) }))} />
              </div>
              <div>
                <label className="label">Max daily loss</label>
                <input className="inp mono" type="number" min={1} value={form.maxDailyLoss}
                  onChange={(e) => setForm((f) => ({ ...f, maxDailyLoss: Math.max(1, Number(e.target.value) || 1) }))} />
              </div>
              <div>
                <label className="label">Max trades/day</label>
                <input className="inp mono" type="number" min={1} value={form.maxTrades}
                  onChange={(e) => setForm((f) => ({ ...f, maxTrades: Math.max(1, Number(e.target.value) || 1) }))} />
              </div>
            </div>
            <div className="text-[11.5px] text-amber bg-amber/10 border border-amber/25 rounded-lg px-3 py-2">
              {deploy?.riskNote}
            </div>
          </div>
        }
      />
    </div>
  );
}
