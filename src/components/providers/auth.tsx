"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type AccountInfo = {
  user: { id: string; email: string; fullName: string; role: string; emailVerified: boolean };
  demo: { balance: number; openPnl: number; marginUsed: number; stakedInFixedTime: number; equity: number };
  wallet: { balance: number };
  real: {
    linked: boolean; balance: number; currency: string;
    balanceFrom: string; syncedAt: string | null; loginId: string;
  };
  activeAccount: "demo" | "real";
  realTradingEnabled: boolean;
  unreadNotifications: number;
};

type AuthState = {
  user: AccountInfo["user"] | null;
  account: AccountInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setUserNull: () => void;
};

const AuthCtx = createContext<AuthState>({
  user: null, account: null, loading: true,
  refresh: async () => {}, setUserNull: () => {},
});

export function useAuth() {
  return useContext(AuthCtx);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/account", { cache: "no-store" });
      if (res.status === 401) {
        setAccount(null);
      } else if (res.ok) {
        const json = await res.json();
        if (json.ok) setAccount(json.data as AccountInfo);
      }
    } catch {
      // network hiccup — keep previous state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <AuthCtx.Provider
      value={{
        user: account?.user ?? null,
        account,
        loading,
        refresh,
        setUserNull: () => setAccount(null),
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
