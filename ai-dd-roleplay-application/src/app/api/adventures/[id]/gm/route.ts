import { runTurn, type Stage } from "@/lib/server/turn";

export const dynamic = "force-dynamic";
export const maxDuration = 600;
type Ctx = { params: Promise<{ id: string }> };

/** SSE-поток хода мастера: status, context, token, reset, roll_request, roll, replace, done, changes, image, memory, end, error. */
export async function POST(req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const { stage } = (await req.json()) as { stage: Stage };
  const enc = new TextEncoder();
  const ac = new AbortController();
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          closed = true;
        }
      };
      req.signal.addEventListener("abort", () => {
        closed = true;
        ac.abort();
      });
      try {
        await runTurn(id, stage ?? "start", emit, ac.signal);
        if (!closed) emit({ type: "end" });
      } catch (e) {
        if (!ac.signal.aborted) emit({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        try {
          controller.close();
        } catch {
          /* уже закрыт */
        }
      }
    },
    cancel() {
      closed = true;
      ac.abort();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
