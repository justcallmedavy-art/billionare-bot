"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { useToast } from "@/components/ui/toast";

const COUNTRIES = [
  "United States", "United Kingdom", "Germany", "France", "Spain", "Italy", "Netherlands",
  "South Africa", "Nigeria", "Kenya", "Ghana", "India", "Pakistan", "Brazil", "Mexico",
  "Canada", "Australia", "United Arab Emirates", "Saudi Arabia", "Other",
];

export default function RegisterPage() {
  const router = useRouter();
  const { push } = useToast();
  const [form, setForm] = useState({
    fullName: "", email: "", password: "", country: "", phone: "", referralCode: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, referralCode: form.referralCode || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Registration failed. Please review the form and try again.");
        return;
      }
      push({ kind: "success", title: "Account created", body: "Your demo account is funded with simulated balance." });
      router.push("/trade");
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel p-7 anim-fadeup">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-10 h-10 rounded-lg bg-brand flex items-center justify-center">
          <Zap size={18} className="text-white" />
        </div>
        <div>
          <div className="font-extrabold text-ink">Create your account</div>
          <div className="text-[11px] text-faint">Demo-funded · no card required</div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3.5">
        <div>
          <label className="label" htmlFor="fullName">Full name</label>
          <input id="fullName" required minLength={2} className="inp" placeholder="Jane Trader" value={form.fullName} onChange={set("fullName")} />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="inp" placeholder="you@example.com" value={form.email} onChange={set("email")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" required className="inp" placeholder="8+ chars, Aa1"
              value={form.password} onChange={set("password")} autoComplete="new-password" />
            <div className="text-[10.5px] text-faint mt-1">8+ characters with upper, lower & a number</div>
          </div>
          <div>
            <label className="label" htmlFor="phone">Phone (optional)</label>
            <input id="phone" className="inp" placeholder="+27…" value={form.phone} onChange={set("phone")} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="country">Country</label>
            <select id="country" required className="inp" value={form.country} onChange={set("country")}>
              <option value="" disabled>Select…</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ref">Referral code (optional)</label>
            <input id="ref" className="inp" placeholder="ABCD1234" value={form.referralCode} onChange={set("referralCode")} />
          </div>
        </div>

        {error && (
          <div className="text-[12.5px] text-down bg-down/10 border border-down/25 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account & start demo"}
        </button>

        <p className="text-[11px] text-faint leading-relaxed">
          By creating an account you accept the platform's terms and risk disclosure. Trading involves
          substantial risk; simulated demo results do not indicate future performance.
        </p>
      </form>

      <div className="text-[12.5px] text-dim mt-4 text-center">
        Already registered? <Link href="/login" className="text-brand font-bold hover:underline">Sign in</Link>
      </div>
    </div>
  );
}
