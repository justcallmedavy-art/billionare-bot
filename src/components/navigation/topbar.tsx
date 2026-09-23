"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell, CreditCard, LogOut, Settings, User, LayoutDashboard, CandlestickChart,
  Bot, Layers, Wallet, LineChart, ChevronDown, Phone,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth";
import { useFeed } from "@/components/providers/market-feed";
import { useToast } from "@/components/ui/toast";
import { fmtMoney, fmtPrice } from "@/lib/format";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/markets", label: "Markets", icon: LineChart },
  { href: "/trade", label: "Trade", icon: CandlestickChart },
  { href: "/bots", label: "DollarPrinter", icon: Bot },
  { href: "/positions", label: "Positions", icon: Layers },
  { href: "/portfolio", label: "Portfolio", icon: LineChart },
  { href: "/history", label: "History", icon: Layers },
  { href: "/wallet", label: "Wallet", icon: Wallet },
];

type Notif = { id: string; title: string; body: string; read: boolean; createdAt: string };

export function Topbar() {
  const { user, account, refresh } = useAuth();
  const { status, quotes } = useFeed();
  const pathname = usePathname();
  const router = useRouter();
  const { push } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [switching, setSwitching] = useState(false);

  const active = account?.activeAccount ?? "demo";
  const real = account?.real;

  async function switchAccount(target: "demo" | "real") {
    if (switching || target === active) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/account/switch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: target }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        push({ kind: "error", title: "Cannot switch", body: json.error });
        return;
      }
      await refresh();
      push({
        kind: "info",
        title: target === "real" ? "REAL account selected" : "Demo account selected",
        body: json.data.notice ?? (target === "real" ? "Real balance is shown. Trades execute only through the connected provider." : "Simulated funds — no real-money risk."),
      });
    } finally {
      setSwitching(false);
    }
  }

  useEffect(() => {
    if (!notifOpen) return;
    fetch("/api/notifications?limit=8")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setNotifs(j.data.notifications); })
      .catch(() => {});
  }, [notifOpen]);

  const feedDot = status === "live" ? "dot dot-live" : status === "offline" ? "dot dot-off" : "dot dot-warn";
  const feedLabel = status === "live" ? "Live" : status === "offline" ? "Offline" : "Connecting…";

  const tickerQuotes = quotes.size
    ? [...quotes.values()].slice(0, 14)
    : [];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    push({ kind: "info", title: "Signed out" });
    router.push("/login");
    router.refresh();
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    void refresh();
  }

  return (
    <div className="sticky top-0 z-40">
      {/* ---- White account strip ---- */}
      <div className="bg-white border-b border-line">
        <div className="h-14 px-3 sm:px-4 flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            className="flex items-center gap-2 sm:gap-2.5 min-w-0"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Account menu"
          >
            <span className={`w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-full text-white font-extrabold flex items-center justify-center text-[15px] ${active === "real" ? "bg-down" : "bg-brand"}`}>B</span>
            <span className="text-left leading-tight min-w-0">
              <span className="hidden xs:block sm:block text-[13px] font-bold text-ink truncate max-w-[110px]">{user?.fullName?.split(" ")[0] ?? "Account"}</span>
              <span className="flex items-baseline gap-1 sm:gap-1.5">
                <span className="mono text-[16px] sm:text-[19px] font-extrabold text-ink">
                  {fmtMoney(active === "real" ? real?.balance : account?.demo.balance)}
                </span>
                <span className="text-[11px] font-bold text-dim">USD</span>
                {active === "real" ? (
                  <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-down px-2 py-[1px] text-[9.5px] font-extrabold uppercase tracking-wide text-white">🔴 Live</span>
                ) : (
                  <span className="tag tag-demo ml-1">Demo</span>
                )}
              </span>
            </span>
            <ChevronDown size={16} className="text-dim shrink-0" />
          </button>

          <div className="flex-1 min-w-2" />

          <div className="hidden md:flex items-center gap-2 text-[12px] text-dim">
            <Phone size={14} className="text-icred" />
            <span className="flex items-center gap-1.5"><span className={feedDot} /> {feedLabel} · simulated feed</span>
          </div>

          <button
            className="p-2 rounded-full text-dim hover:text-ink hover:bg-panel2 relative shrink-0"
            onClick={() => setNotifOpen((v) => !v)}
            aria-label="Notifications"
          >
            <Bell size={18} />
            {(account?.unreadNotifications ?? 0) > 0 && (
              <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-down text-white text-[9px] font-bold flex items-center justify-center">
                {account!.unreadNotifications}
              </span>
            )}
          </button>

          <button className="btn btn-primary btn-sm shrink-0" onClick={() => router.push("/wallet")}>
            <CreditCard size={13} /> <span className="hidden xs:inline">Funds</span>
          </button>

          {user?.role === "admin" && (
            <Link href="/admin" className="btn btn-run btn-sm hidden sm:inline-flex">Admin</Link>
          )}
        </div>

        {/* account dropdown */}
        {menuOpen && (
          <div className="absolute left-4 top-16 w-72 panel shadow-2xl py-1.5 z-50" onClick={() => setMenuOpen(false)}>
            <div className="px-3.5 py-2.5 border-b border-line">
              <div className="text-[13px] font-bold truncate">{user?.fullName ?? "—"}</div>
              <div className="text-[11px] text-faint truncate">{user?.email ?? ""}</div>
            </div>

            {/* Account switcher */}
            <div className="px-3.5 py-2.5 border-b border-line">
              <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-faint mb-1.5">Active account</div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  disabled={switching}
                  onClick={() => switchAccount("demo")}
                  className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    active === "demo" ? "border-brand bg-brand/10" : "border-line hover:border-border-2"
                  }`}
                >
                  <div className="text-[11px] font-extrabold text-ink">DEMO</div>
                  <div className="mono text-[12.5px] font-bold text-dim">{fmtMoney(account?.demo.balance)}</div>
                </button>
                <button
                  disabled={switching}
                  onClick={() => switchAccount("real")}
                  className={`rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    active === "real" ? "border-down bg-down/10" : "border-line hover:border-border-2"
                  }`}
                >
                  <div className="flex items-center gap-1 text-[11px] font-extrabold text-ink">
                    REAL {real?.linked === false && <span className="text-[9px] text-faint font-bold">(not linked)</span>}
                  </div>
                  <div className="mono text-[12.5px] font-bold text-dim">{real?.linked ? fmtMoney(real.balance) : "—"}</div>
                </button>
              </div>
              {active === "real" && (
                <div className="mt-1.5 text-[10.5px] text-down font-semibold">
                  🔴 REAL — funds are real. {real?.balanceFrom === "deriv_api" ? "Synced from Deriv." : "Local ledger — syncs once Deriv is connected."}
                </div>
              )}
            </div>

            <Link href="/account" className="flex items-center gap-2 px-3.5 py-2 text-[13px] text-dim hover:text-ink hover:bg-panel2">
              <Settings size={14} /> Account & security
            </Link>
            {user?.role === "admin" && (
              <Link href="/admin" className="flex items-center gap-2 px-3.5 py-2 text-[13px] text-dim hover:text-ink hover:bg-panel2">
                <User size={14} /> Admin dashboard
              </Link>
            )}
            <button onClick={logout} className="w-full flex items-center gap-2 px-3.5 py-2 text-[13px] text-dim hover:text-ink hover:bg-panel2">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}

        {/* notifications dropdown */}
        {notifOpen && (
          <div className="absolute right-4 top-16 w-80 panel shadow-2xl z-50">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-line">
              <span className="text-xs font-bold text-dim">Notifications</span>
              <button className="text-[11px] text-brand hover:underline" onClick={markAllRead}>Mark all read</button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 && <div className="px-3 py-8 text-center text-xs text-faint">No notifications yet</div>}
              {notifs.map((n) => (
                <div key={n.id} className={`px-3.5 py-2.5 border-b border-line/60 ${!n.read ? "bg-brand/5" : ""}`}>
                  <div className="text-[12.5px] font-bold">{n.title}</div>
                  <div className="text-[11.5px] text-dim mt-0.5">{n.body}</div>
                  <div className="text-[10px] text-faint mt-1">{new Date(n.createdAt).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---- Red announcement ticker ---- */}
      <div className="bg-redbar text-white overflow-hidden">
        <div className="h-7 flex items-center">
          <div className="anim-ticker flex gap-12 w-max whitespace-nowrap text-[11px] font-bold tracking-wide px-4">
            {[0, 1].map((dup) => (
              <span key={dup} className="flex gap-12">
                <span>WELCOME TO BILLINARE DEAL OPTION — YOUR TERMINAL FOR FOREX, DIGITAL OPTIONS & AUTOMATED STRATEGIES</span>
                {tickerQuotes.map((q) => (
                  <span key={`${dup}-${q.symbol}`} className="mono">
                    {q.symbol} {fmtPrice(q.mid, q.digits)}{" "}
                    <span className={(q.changePct ?? 0) >= 0 ? "text-emerald-200" : "text-red-200"}>
                      {(q.changePct ?? 0) >= 0 ? "▲" : "▼"}{Math.abs(q.changePct ?? 0).toFixed(2)}%
                    </span>
                  </span>
                ))}
                <span>DEMO-FIRST PLATFORM · SIMULATED FEED · NO REAL DEPOSITS PROCESSED</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ---- Navy navigation ---- */}
      <nav className="bg-navy">
        <div className="flex items-stretch overflow-x-auto">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-2 px-4 py-3 text-[12.5px] font-bold whitespace-nowrap transition-colors ${
                  active ? "bg-navy2 text-white" : "text-white/85 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon size={15} className={active ? "text-white" : "text-icred"} />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
