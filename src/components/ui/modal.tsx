"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  open, onClose, title, children, width = 480,
}: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 modal-backdrop" onClick={onClose}>
      <div
        className="modal-in panel w-full p-5 max-h-[90vh] overflow-y-auto"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[15px]">{title}</h3>
          <button onClick={onClose} className="text-faint hover:text-ink" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({
  open, onClose, onConfirm, title, body, confirmLabel = "Confirm", danger = false, busy = false,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; body: ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={420}>
      <div className="text-sm text-dim space-y-3">{body}</div>
      <div className="flex gap-2 justify-end mt-5">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className={`btn ${danger ? "btn-down" : "btn-primary"}`} onClick={() => { onConfirm(); onClose(); }} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
