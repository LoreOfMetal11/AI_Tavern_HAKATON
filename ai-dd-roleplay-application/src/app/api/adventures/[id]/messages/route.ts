import { db } from "@/db";
import { adventures, messages } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { estimateTokens } from "@/lib/tokens";
import { loadBundle } from "@/lib/server/store";
import { norm } from "@/lib/server/context";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/**
 * Новое действие игроков. Текст делится по /n между выбранными игроками (по порядку),
 * либо по префиксу «Имя: ...». Все сообщения одного хода получают общий номер turn.
 */
export async function POST(req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const { text, playerIds = [], role } = (await req.json()) as { text: string; playerIds?: number[]; role?: "assistant" };
  const b = await loadBundle(id);
  if (!b) return Response.json({ error: "not found" }, { status: 404 });
  const raw = (text ?? "").trim();
  if (!raw) return Response.json({ error: "empty" }, { status: 400 });

  // ручная запись мастера в историю («вписать» событие)
  if (role === "assistant") {
    const last = b.adv.turn;
    const hasReply = b.messages.some((m) => m.turn === last && m.role === "assistant");
    const turn = hasReply ? last + 1 : last;
    const [row] = await db.insert(messages).values({ adventureId: id, turn, role: "assistant", content: raw, tokens: estimateTokens(raw), meta: { manual: true } }).returning();
    await db.update(adventures).set({ turn, updatedAt: new Date() }).where(eq(adventures.id, id));
    return Response.json({ turn, messages: [row] });
  }

  let segs = raw.split(/\s*\/n\s*/i).map((x) => x.trim()).filter(Boolean);
  const ids = playerIds.length ? playerIds : b.players.slice(0, 1).map((p) => p.id);
  const assigned: { playerId: number | null; text: string }[] = [];
  if (ids.length <= 1) {
    assigned.push({ playerId: ids[0] ?? null, text: segs.join("\n") });
  } else {
    if (segs.length > ids.length) segs = [...segs.slice(0, ids.length - 1), segs.slice(ids.length - 1).join("\n")];
    segs.forEach((seg, i) => {
      let pid = ids[i];
      let t = seg;
      const m = seg.match(/^([^:\n]{2,30}):\s*([\s\S]+)$/);
      if (m) {
        const p = b.players.find((x) => norm(x.name) === norm(m[1].trim()));
        if (p) {
          pid = p.id;
          t = m[2];
        }
      }
      assigned.push({ playerId: pid, text: t });
    });
  }

  // если у последнего хода ещё нет ответа мастера (ошибка/ожидание броска) — дописываем в тот же ход
  const lastTurn = b.adv.turn;
  const hasReply = b.messages.some((m) => m.turn === lastTurn && m.role === "assistant");
  const hasUser = b.messages.some((m) => m.turn === lastTurn && m.role === "user");
  const turn = hasUser && !hasReply ? lastTurn : lastTurn + 1;
  const rows = await db
    .insert(messages)
    .values(assigned.map((a) => ({ adventureId: id, turn, role: "user", playerId: a.playerId, content: a.text, tokens: estimateTokens(a.text) })))
    .returning();
  await db.update(adventures).set({ turn, pending: null, updatedAt: new Date() }).where(and(eq(adventures.id, id)));
  return Response.json({ turn, messages: rows });
}
