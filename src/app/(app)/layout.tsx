"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/providers/auth";
import { MarketFeedProvider } from "@/components/providers/market-feed";
import { Topbar } from "@/components/navigation/topbar";
import { BottomNav } from "@/components/navigation/bottom-nav";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand animate-pulse" />
          <div className="text-xs text-faint font-semibold">Loading terminal…</div>
        </div>
      </div>
    );
  }
  if (!user) return null;
  return <>{children}</>;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MarketFeedProvider>
        <AuthGate>
          <div className="min-h-screen pb-14 xl:pb-0 overflow-x-hidden">
            <Topbar />
            <main className="p-3 xl:p-4 max-w-[1700px] mx-auto w-full">{children}</main>
            <BottomNav />
          </div>
        </AuthGate>
      </MarketFeedProvider>
    </AuthProvider>
  );
}
