import { db } from "@/db";
import { adventures, entities, library, memories, messages, players, relations, worlds } from "@/db/schema";
import { and, asc, eq, ne } from "drizzle-orm";

export type Adventure = typeof adventures.$inferSelect;
export type Entity = typeof entities.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type Relation = typeof relations.$inferSelect;
export type World = typeof worlds.$inferSelect;
export type LibraryRow = typeof library.$inferSelect;

export interface Enemy {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  ac?: number;
  notes?: string;
}

export interface Scene {
  location?: string;
  time?: string;
  summary?: string;
  combat?: boolean;
  round?: number;
  enemies?: Enemy[];
  active?: number[]; // id игроков, к кому сейчас обращается мастер
  underAttack?: number[];
  sticky?: Record<string, number>; // entityId -> последний ход, когда карточка была подтянута
  lastLanguageIssue?: string;
}

export interface Bundle {
  adv: Adventure;
  world: World | null;
  players: Player[];
  entities: Entity[];
  relations: Relation[];
  memories: Memory[];
  messages: Message[]; // только active
  rulebooks: LibraryRow[];
  scene: Scene;
}

export async function loadBundle(id: number): Promise<Bundle | null> {
  const [adv] = await db.select().from(adventures).where(eq(adventures.id, id));
  if (!adv) return null;
  const [world] = adv.worldId ? await db.select().from(worlds).where(eq(worlds.id, adv.worldId)) : [];
  const [pl, ent, rel, mem, msgs, books] = await Promise.all([
    db.select().from(players).where(eq(players.adventureId, id)).orderBy(asc(players.sortOrder), asc(players.id)),
    db.select().from(entities).where(eq(entities.adventureId, id)).orderBy(asc(entities.id)),
    db.select().from(relations).where(eq(relations.adventureId, id)),
    db.select().from(memories).where(eq(memories.adventureId, id)).orderBy(asc(memories.fromTurn), asc(memories.id)),
    db
      .select()
      .from(messages)
      .where(and(eq(messages.adventureId, id), eq(messages.status, "active")))
      .orderBy(asc(messages.turn), asc(messages.id)),
    db.select().from(library),
  ]);
  const ids = new Set(((adv.rulebookIds ?? []) as number[]).map(Number));
  return {
    adv,
    world: world ?? null,
    players: pl,
    entities: ent,
    relations: rel,
    memories: mem,
    messages: msgs,
    rulebooks: books.filter((b) => ids.has(b.id)),
    scene: (adv.scene ?? {}) as Scene,
  };
}

export async function nonDeletedCount(advId: number) {
  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.adventureId, advId), ne(messages.status, "deleted")));
  return rows.length;
}
