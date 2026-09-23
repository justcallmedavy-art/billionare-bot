"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Users, Wallet, Bot, Activity, ScrollText } from "lucide-react";
import { useAuth } from "@/components/providers/auth";
import { useToast } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/modal";
import { fmtMoney, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

type AdminUser = {
  id: string; email: string; fullName: string; country: string; status: string; role: string;
  emailVerified: boolean; createdAt: string; lastLoginAt: string | null;
  demoBalance: number | null; walletBalance: number;
  positions: number; deals: number; bots: number; sessions: number;
};

type AuditRow = { id: string; action: string; detail: string; email: string; createdAt: string };

type AdminData = {
  metrics: {
    users: number; demoAccounts: number; runningBots: number; openPositions: number;
    depositsCompleted: number; depositsVolume: number; withdrawalsTotal: number; withdrawalsPending: number;
    demoBalanceTotal: number;
  };
  users: AdminUser[];
  auditLog: AuditRow[];
};

export default function AdminPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const [data, setData] = useState<AdminData | null>(null);
  const [search, setSearch] = useState("");
  const [suspendId, setSuspendId] = useState<{ id: string; email: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setData(j.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  async function patchUser(userId: string, patch: Record<string, unknown>) {
    const res = await fetch("/api/admin", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...patch }),
    });
    const json = await res.json();
    if (json.ok) push({ kind: "success", title: "Account updated" });
    else push({ kind: "error", title: "Update failed", body: json.error });
    load();
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="panel p-8 text-center">
        <ShieldCheck size={24} className="text-faint mx-auto mb-2" />
        <div className="text-[14px] font-semibold">Admin access required</div>
        <p className="text-[12.5px] text-dim mt-1">This area is restricted to platform administrators.</p>
      </div>
    );
  }

  if (!data) {
    return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skel h-10" />)}</div>;
  }

  const filtered = data.users.filter((u) =>
    !search || u.email.toLowerCase().includes(search.toLowerCase()) || u.fullName.toLowerCase().includes(search.toLowerCase()),
  );

  const metrics = [
    { label: "Registered users", value: String(data.metrics.users), icon: Users },
    { label: "Demo accounts", value: String(data.metrics.demoAccounts), icon: Wallet },
    { label: "Running bots", value: String(data.metrics.runningBots), icon: Bot },
    { label: "Open positions", value: String(data.metrics.openPositions), icon: Activity },
    { label: "Demo economy (total)", value: fmtMoney(data.metrics.demoBalanceTotal), icon: Wallet },
    { label: "Deposits completed", value: String(data.metrics.depositsCompleted), icon: Wallet },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/25 flex items-center justify-center">
          <ShieldCheck size={19} className="text-brand" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Admin dashboard</h1>
          <p className="text-[11.5px] text-faint">Account oversight, deposits, and audit trail · read-only on trade data</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="panel p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-faint uppercase tracking-wide">{m.label}</span>
              <m.icon size={13} className="text-cyan" />
            </div>
            <div className="mono text-[16px] font-bold mt-1.5">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-semibold">All users ({data.users.length})</span>
          <div className="flex-1" />
          <input
            className="inp max-w-[240px] py-1.5 text-xs"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>User</th><th>Status</th><th>Demo balance</th><th>Wallet</th><th>Positions</th>
                <th>Deals</th><th>Bots</th><th>Joined</th><th>Last login</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="font-semibold text-[12.5px]">{u.fullName}{u.role === "admin" && <span className="tag tag-live ml-1.5">admin</span>}</div>
                    <div className="text-[10.5px] text-faint">{u.email} · {u.country || "—"}</div>
                  </td>
                  <td>
                    <span className={cn("text-[11.5px] font-semibold uppercase",
                      u.status === "active" ? "text-up" : u.status === "suspended" ? "text-amber" : "text-down")}>
                      {u.status}
                    </span>
                    {!u.emailVerified && <div className="text-[10px] text-faint">unverified</div>}
                  </td>
                  <td className="mono">{u.demoBalance != null ? fmtMoney(u.demoBalance) : "—"}</td>
                  <td className="mono text-faint">{fmtMoney(u.walletBalance)}</td>
                  <td className="mono">{u.positions}</td>
                  <td className="mono">{u.deals}</td>
                  <td className="mono">{u.bots}</td>
                  <td className="text-[11px] text-faint">{fmtDateTime(u.createdAt)}</td>
                  <td className="text-[11px] text-faint">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "never"}</td>
                  <td>
                    <div className="flex gap-1">
                      {u.status === "active" ? (
                        <button className="btn btn-ghost btn-xs" onClick={() => setSuspendId({ id: u.id, email: u.email })}>Suspend</button>
                      ) : (
                        <button className="btn btn-ghost btn-xs" onClick={() => patchUser(u.id, { status: "active" })}>Reactivate</button>
                      )}
                      {!u.emailVerified && (
                        <button className="btn btn-ghost btn-xs" onClick={() => patchUser(u.id, { verifyEmail: true })}>Verify</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={10} className="text-center py-6 text-xs text-faint">No users match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit log */}
      <div className="panel overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center gap-2">
          <ScrollText size={13} className="text-cyan" />
          <span className="text-[13px] font-semibold">Recent audit events</span>
        </div>
        <table className="tbl">
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>
            {data.auditLog.map((l) => (
              <tr key={l.id}>
                <td className="text-[11px] text-faint">{fmtDateTime(l.createdAt)}</td>
                <td className="text-[12px]">{l.email}</td>
                <td className="mono text-[11.5px] text-cyan">{l.action}</td>
                <td className="text-[11.5px] text-faint">{l.detail || "—"}</td>
              </tr>
            ))}
            {data.auditLog.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-xs text-faint">No audit events yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="panel-2 p-4 text-[12px] text-dim">
        <strong className="text-ink">Scope note:</strong> admin controls manage <em>accounts</em> —
        status, verification, visibility, and audit. Trade outcomes, balances, and prices are
        engine-driven and are deliberately outside admin influence, keeping the platform auditable
        and fair for every trader.
      </div>

      <ConfirmModal
        open={!!suspendId}
        onClose={() => setSuspendId(null)}
        onConfirm={() => { if (suspendId) void patchUser(suspendId.id, { status: "suspended" }); }}
        title="Suspend account"
        body={`Suspend ${suspendId?.email}? All active sessions will be revoked immediately and the user cannot sign in until reactivated.`}
        confirmLabel="Suspend"
        danger
      />
    </div>
  );
}
