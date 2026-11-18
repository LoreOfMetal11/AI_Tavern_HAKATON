import { db } from "@/db";
import { adventures, changes, entities, memories, messages, players, relations } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { loadBundle } from "@/lib/server/store";
import { getSettings, withOverrides } from "@/lib/server/settings";
import { pendingStats } from "@/lib/server/memory";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const b = await loadBundle(id);
  if (!b) return Response.json({ error: "not found" }, { status: 404 });
  const allMsgs = await db.select().from(messages).where(eq(messages.adventureId, id)).orderBy(messages.turn, messages.id);
  const log = await db.select().from(changes).where(eq(changes.adventureId, id)).orderBy(desc(changes.id)).limit(150);
  const s = withOverrides(await getSettings(), b.adv.overrides);
  const stats = await pendingStats(id, s);
  return Response.json({
    adventure: b.adv,
    world: b.world,
    players: b.players,
    entities: b.entities,
    relations: b.relations,
    memories: b.memories,
    messages: allMsgs,
    changes: log,
    rulebookIds: (b.adv.rulebookIds ?? []) as number[],
    stats,
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const body = (await req.json()) as Record<string, unknown>;
  const allowed = ["name", "edition", "premise", "premiseCompact", "opening", "rulebookIds", "chatStyle", "scene", "overrides", "worldId"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];
  patch.updatedAt = new Date();
  const [row] = await db.update(adventures).set(patch).where(eq(adventures.id, id)).returning();
  return Response.json(row);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  await db.delete(messages).where(eq(messages.adventureId, id));
  await db.delete(memories).where(eq(memories.adventureId, id));
  await db.delete(changes).where(eq(changes.adventureId, id));
  await db.delete(relations).where(eq(relations.adventureId, id));
  await db.delete(entities).where(eq(entities.adventureId, id));
  await db.delete(players).where(eq(players.adventureId, id));
  await db.delete(adventures).where(and(eq(adventures.id, id)));
  return Response.json({ ok: true });
}
