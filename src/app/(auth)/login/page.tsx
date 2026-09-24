"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap } from "lucide-react";
import { useToast } from "@/components/ui/toast";

const DERIV_ERRORS: Record<string, string> = {
  deriv_not_configured: "Deriv sign-in is not configured on this deployment yet.",
  deriv_state_mismatch: "Sign-in session expired or invalid. Please try the Deriv button again.",
  deriv_denied: "Deriv authorization was cancelled or returned no accounts.",
  deriv_verify_failed: "We could not verify your Deriv token with Deriv's servers. Nothing was linked.",
  deriv_error: "Something went wrong during Deriv sign-in. Please try again.",
  deriv_rate_limited: "Too many attempts. Please wait a minute and try again.",
  suspended: "This account is suspended. Contact support.",
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { push } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const derivError = params.get("error");
  const derivConfigured = !!process.env.NEXT_PUBLIC_DERIV_APP_ID;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Sign-in failed. Please try again.");
        return;
      }
      push({ kind: "success", title: "Welcome back" });
      router.push(json.data.role === "admin" ? "/admin" : "/trade");
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel p-7 anim-fadeup">
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-10 h-10 rounded-lg bg-brand flex items-center justify-center">
          <Zap size={18} className="text-white" />
        </div>
        <div>
          <div className="font-extrabold text-ink">Billinare <span className="text-brand">Deal Option</span></div>
          <div className="text-[11px] text-faint">Sign in to the trading terminal</div>
        </div>
      </div>

      {derivError && DERIV_ERRORS[derivError] && (
        <div className="text-[12.5px] text-down bg-down/10 border border-down/25 rounded-lg px-3 py-2 mb-4">
          {DERIV_ERRORS[derivError]}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="inp" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" required className="inp" placeholder="••••••••"
            value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>

        {error && (
          <div className="text-[12.5px] text-down bg-down/10 border border-down/25 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-4">
        <div className="h-px flex-1 bg-line" />
        <span className="text-[10.5px] font-bold uppercase tracking-wide text-faint">or</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      {derivConfigured ? (
        <a href="/api/auth/deriv" className="btn w-full py-2.5 font-extrabold flex items-center justify-center gap-2"
          style={{ background: "#ff444f", color: "white" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.59 6.59L13 12l3.59 3.41L15 17l-5-5 5-5 1.59 1.59z" />
          </svg>
          Sign in with Deriv
        </a>
      ) : (
        <button className="btn w-full py-2.5 font-extrabold flex items-center justify-center gap-2 opacity-60 cursor-not-allowed"
          style={{ background: "#ff444f", color: "white" }} disabled
          title="Set NEXT_PUBLIC_DERIV_APP_ID to enable"
          onClick={(e) => { e.preventDefault(); push({ kind: "info", title: "Deriv sign-in not configured", body: "Add a Deriv app id to the deployment environment to enable this." }); }}>
          Sign in with Deriv
        </button>
      )}
      <p className="text-[10.5px] text-faint mt-2 text-center leading-relaxed">
        Credentials are entered on Deriv&apos;s own site — we never see your Deriv password.
      </p>

      <div className="text-[12.5px] text-dim mt-5 text-center">
        New here? <Link href="/register" className="text-brand font-bold hover:underline">Create a demo account</Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="panel p-7 anim-fadeup"><div className="text-xs text-faint">Loading…</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
