import { db } from "@/db";
import { messages } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { estimateTokens } from "@/lib/tokens";
import { invalidateMemories, revertMessageChanges, rewindFrom } from "@/lib/server/apply";
import { waitLock } from "@/lib/server/turn";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; mid: string }> };

async function load(id: number, mid: number) {
  const [m] = await db.select().from(messages).where(and(eq(messages.id, mid), eq(messages.adventureId, id)));
  return m;
}

/** Правка: сообщение игрока → откат таймлайна до этого хода и новый ответ; ответ мастера → правка текста; pinned → закрепление. */
export async function PATCH(req: Request, { params }: Ctx) {
  const p = await params;
  const id = Number(p.id);
  const mid = Number(p.mid);
  await waitLock(id);
  const body = (await req.json()) as { content?: string; pinned?: boolean };
  const m = await load(id, mid);
  if (!m) return Response.json({ error: "not found" }, { status: 404 });
  if (typeof body.pinned === "boolean") await db.update(messages).set({ pinned: body.pinned }).where(eq(messages.id, mid));
  let regenerate = false;
  if (typeof body.content === "string" && body.content.trim() && body.content !== m.content) {
    if (m.role === "user") {
      await rewindFrom(id, m.turn, false);
      await db.update(messages).set({ content: body.content, tokens: estimateTokens(body.content), meta: {}, summarized: false }).where(eq(messages.id, mid));
      regenerate = true;
    } else {
      await db.update(messages).set({ content: body.content, tokens: estimateTokens(body.content) }).where(eq(messages.id, mid));
      await invalidateMemories(id, m.turn, m.turn);
    }
  }
  return Response.json({ ok: true, regenerate });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const p = await params;
  const id = Number(p.id);
  const mid = Number(p.mid);
  await waitLock(id);
  const m = await load(id, mid);
  if (!m) return Response.json({ ok: true });
  if (m.role === "assistant") {
    await revertMessageChanges(id, m.id);
    await db.update(messages).set({ status: "deleted" }).where(eq(messages.id, mid));
    await invalidateMemories(id, m.turn, m.turn);
  } else {
    await db.update(messages).set({ status: "deleted" }).where(eq(messages.id, mid));
    await rewindFrom(id, m.turn, false);
  }
  return Response.json({ ok: true });
}
