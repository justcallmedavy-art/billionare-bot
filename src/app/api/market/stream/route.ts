import { marketEngine } from "@/lib/market/engine";
import { getProviderInfo } from "@/lib/providers";

export const dynamic = "force-dynamic";

/**
 * SSE price stream. Server-Sent Events keep this simple and reliable on
 * serverless-style runtimes while behaving like a one-way WebSocket feed.
 * The client auto-reconnects natively (EventSource) with exponential backoff.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get("symbols");
  const symbols = symbolsParam
    ? symbolsParam.split(",").map((s) => s.toUpperCase()).filter(Boolean)
    : null; // null = all

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let unsub: (() => void) | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Initial snapshot so the UI paints instantly
      send("snapshot", { provider: getProviderInfo(), quotes: marketEngine.snapshot(), serverTs: Date.now() });

      unsub = marketEngine.onGlobalTick(() => {
        const all = marketEngine.snapshot();
        const quotes = symbols ? all.filter((q) => symbols.includes(q.symbol)) : all;
        send("quotes", { quotes, serverTs: Date.now() });
      });

      heartbeat = setInterval(() => send("heartbeat", { serverTs: Date.now() }), 15_000);
      (heartbeat as unknown as { unref?: () => void }).unref?.();

      req.signal.addEventListener("abort", () => {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsub?.();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsub?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
