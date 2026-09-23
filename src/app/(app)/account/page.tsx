"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth";
import { useToast } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/modal";
import { fmtDateTime } from "@/lib/format";

type LoginEvent = { id: string; ip: string; device: string; success: boolean; createdAt: string };

export default function AccountPage() {
  const { user, refresh } = useAuth();
  const { push } = useToast();
  const [tab, setTab] = useState<"profile" | "security" | "sessions">("profile");
  const [profile, setProfile] = useState({ fullName: "", phone: "", country: "" });
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [logins, setLogins] = useState<LoginEvent[]>([]);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) setProfile({ fullName: user.fullName, phone: "", country: "" });
  }, [user]);

  const loadLogins = useCallback(() => {
    // Login history is surfaced via the account audit trail; simple fetch:
    fetch("/api/account/activity")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setLogins(j.data.events); })
      .catch(() => {});
  }, []);

  useEffect(() => { loadLogins(); }, [loadLogins]);

  async function saveProfile() {
    setBusy(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const json = await res.json();
      if (json.ok) { push({ kind: "success", title: "Profile updated" }); void refresh(); }
      else push({ kind: "error", title: "Update failed", body: json.error });
    } finally { setBusy(false); }
  }

  async function changePassword() {
    if (pwd.next !== pwd.confirm) {
      push({ kind: "error", title: "Passwords don't match" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwd.current, newPassword: pwd.next }),
      });
      const json = await res.json();
      if (json.ok) {
        push({ kind: "success", title: "Password changed", body: "Other sessions were signed out." });
        setPwd({ current: "", next: "", confirm: "" });
      } else {
        push({ kind: "error", title: "Change failed", body: json.error });
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-bold">Account & security</h1>

      <div className="flex gap-1.5">
        {(["profile", "security", "sessions"] as const).map((t) => (
          <button key={t} className={`btn btn-sm ${tab === t ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="panel p-5 space-y-3.5">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Full name</label>
              <input className="inp" value={profile.fullName} onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="inp" value={user?.email ?? ""} disabled />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="inp" placeholder="+27…" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">Country</label>
              <input className="inp" value={profile.country} onChange={(e) => setProfile((p) => ({ ...p, country: e.target.value }))} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={saveProfile} disabled={busy}>Save changes</button>

          <div className="border-t border-line pt-3.5 mt-1">
            <div className="text-[13px] font-extrabold text-ink mb-1">Deriv connection</div>
            <p className="text-[11.5px] text-dim leading-relaxed mb-2.5">
              Link your Deriv account to sync your real balance and enable real trading once the
              broker connection is verified. Sign-in happens on Deriv&apos;s own site.
            </p>
            <a href="/api/auth/deriv" className="btn btn-sm font-bold inline-flex items-center gap-1.5"
              style={{ background: "#ff444f", color: "white" }}>
              Link Deriv account
            </a>
          </div>
        </div>
      )}

      {tab === "security" && (
        <div className="panel p-5 space-y-3.5">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Current password</label>
              <input className="inp" type="password" value={pwd.current} onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))} />
            </div>
            <div>
              <label className="label">New password</label>
              <input className="inp" type="password" value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} />
            </div>
            <div>
              <label className="label">Confirm new</label>
              <input className="inp" type="password" value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} />
            </div>
          </div>
          <div className="text-[11.5px] text-faint">Changing your password signs out all other sessions.</div>
          <button className="btn btn-primary" onClick={changePassword} disabled={busy || !pwd.current || !pwd.next}>Update password</button>
        </div>
      )}

      {tab === "sessions" && (
        <div className="space-y-3">
          <div className="panel p-5">
            <div className="text-[13px] font-semibold mb-2">Login activity</div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {logins.length === 0 && <div className="text-xs text-faint">No recorded activity yet.</div>}
              {logins.map((l) => (
                <div key={l.id} className="flex items-center justify-between text-[12px] py-1.5 border-b border-line/50">
                  <div>
                    <span className={l.success ? "text-up" : "text-down"}>{l.success ? "Sign-in" : "Failed attempt"}</span>
                    <span className="text-faint"> · {l.ip || "local"}</span>
                  </div>
                  <span className="text-faint text-[10.5px]">{fmtDateTime(l.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel p-5 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold">Sign out everywhere</div>
              <div className="text-[11.5px] text-faint mt-0.5">Revokes every active session, including this one.</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setRevokeOpen(true)}>Revoke all</button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        onConfirm={async () => {
          await fetch("/api/account/sessions/revoke-all", { method: "POST" });
          window.location.href = "/login";
        }}
        title="Revoke all sessions"
        body="You will be signed out on all devices and returned to the sign-in page."
        confirmLabel="Revoke all"
        danger
      />
    </div>
  );
}
