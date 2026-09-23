"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type Quote = {
  symbol: string; bid: number | null; ask: number | null; mid: number | null;
  changePct: number | null; digits: number; serverTs: number;
};

type FeedState = {
  quotes: Map<string, Quote>;
  status: "connecting" | "live" | "reconnecting" | "offline";
  lastTickAt: number | null;
};

const FeedCtx = createContext<FeedState>({
  quotes: new Map(),
  status: "connecting",
  lastTickAt: null,
});

export function useFeed() {
  return useContext(FeedCtx);
}

const STALE_MS = 12_000;

export function MarketFeedProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [status, setStatus] = useState<FeedState["status"]>("connecting");
  const [lastTickAt, setLastTickAt] = useState<number | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const backoffRef = useRef(1000);

  useEffect(() => {
    let stopped = false;
    let staleTimer: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      if (stopped) return;
      setStatus((s) => (s === "live" ? "reconnecting" : "connecting"));
      const es = new EventSource("/api/market/stream");
      esRef.current = es;

      es.addEventListener("snapshot", (ev) => {
        const msg = JSON.parse((ev as MessageEvent).data);
        const m = new Map<string, Quote>();
        for (const q of msg.quotes) m.set(q.symbol, q);
        setQuotes(m);
        setLastTickAt(Date.now());
        setStatus("live");
        backoffRef.current = 1000;
      });

      es.addEventListener("quotes", (ev) => {
        const msg = JSON.parse((ev as MessageEvent).data);
        setQuotes((prev) => {
          const m = new Map(prev);
          for (const q of msg.quotes) m.set(q.symbol, q);
          return m;
        });
        setLastTickAt(Date.now());
        setStatus("live");
      });

      es.addEventListener("heartbeat", () => {
        setLastTickAt(Date.now());
      });

      es.onerror = () => {
        es.close();
        if (stopped) return;
        setStatus("reconnecting");
        const delay = Math.min(backoffRef.current, 15_000);
        backoffRef.current = Math.min(backoffRef.current * 2, 15_000);
        setTimeout(connect, delay);
      };
    };

    connect();

    // Stale-price detection: if no tick for 12s, mark feed degraded.
    staleTimer = setInterval(() => {
      setLastTickAt((t) => {
        if (t && Date.now() - t > STALE_MS) setStatus((s) => (s === "live" ? "reconnecting" : s));
        return t;
      });
    }, 3000);

    return () => {
      stopped = true;
      if (staleTimer) clearInterval(staleTimer);
      esRef.current?.close();
    };
  }, []);

  return (
    <FeedCtx.Provider value={{ quotes, status, lastTickAt }}>{children}</FeedCtx.Provider>
  );
}
