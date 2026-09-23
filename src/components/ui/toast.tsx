"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";

type ToastKind = "success" | "error" | "info" | "warning";
type Toast = { id: number; kind: ToastKind; title: string; body?: string };

const ToastCtx = createContext<{ push: (t: Omit<Toast, "id">) => void }>({ push: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

const ICONS: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 size={16} className="text-up" />,
  error: <XCircle size={16} className="text-down" />,
  info: <Info size={16} className="text-cyan" />,
  warning: <AlertTriangle size={16} className="text-amber" />,
};

const BORDER: Record<ToastKind, string> = {
  success: "border-l-up",
  error: "border-l-down",
  info: "border-l-cyan",
  warning: "border-l-amber",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-4), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-in panel-2 border-l-2 ${BORDER[t.kind]} px-3 py-2.5 shadow-xl flex items-start gap-2.5`}
          >
            <div className="mt-0.5">{ICONS[t.kind]}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold">{t.title}</div>
              {t.body && <div className="text-xs text-dim mt-0.5 break-words">{t.body}</div>}
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-faint hover:text-ink"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
