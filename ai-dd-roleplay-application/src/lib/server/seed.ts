import { db } from "@/db";
import { entities, library, relations, worlds } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { BUILTIN_RULEBOOKS, SEED_WORLDS } from "@/lib/dnd/rules";

let done = false;

/** Идемпотентно добавляет встроенные книги правил и два стартовых мира. */
export async function ensureSeed() {
  if (done) return;
  const have = await db.select({ title: library.title }).from(library).where(eq(library.builtin, true));
  const titles = new Set(have.map((h) => h.title));
  for (const r of BUILTIN_RULEBOOKS) {
    if (titles.has(r.title)) continue;
    await db.insert(library).values({ kind: "rulebook", title: r.title, edition: r.edition, content: r.content, compact: r.content, builtin: true, source: "встроено" });
  }
  const existing = await db.select({ name: worlds.name }).from(worlds);
  const names = new Set(existing.map((w) => w.name));
  for (const w of SEED_WORLDS) {
    if (names.has(w.name)) continue;
    const [world] = await db.insert(worlds).values({ name: w.name, description: w.description, compact: w.compact, tone: w.tone, rules: w.rules }).returning();
    const map = new Map<string, number>();
    for (const e of w.entities) {
      const [row] = await db
        .insert(entities)
        .values({ worldId: world.id, adventureId: null, type: e.type, name: e.name, triggers: e.triggers, mode: e.mode, description: e.description, compact: e.compact, secrets: e.secrets ?? "", knowledge: e.knowledge ?? "", status: e.status ?? "" })
        .returning();
      map.set(e.name, row.id);
    }
    for (const e of w.entities) {
      if (e.parent && map.get(e.parent)) await db.update(entities).set({ parentId: map.get(e.parent)! }).where(eq(entities.id, map.get(e.name)!));
    }
    for (const r of w.relations) {
      const f = map.get(r.from);
      const t = map.get(r.to);
      if (f && t) await db.insert(relations).values({ worldId: world.id, adventureId: null, fromId: f, toId: t, label: r.label });
    }
    // сюжет-заготовка хранится в библиотеке
    await db.insert(library).values({ kind: "plot", title: `Сюжет: ${w.name}`, content: `${w.premise}\n\n${w.opening}`, compact: w.premise, builtin: true, source: w.name });
  }
  done = true;
}

export function seedPlot(worldName: string) {
  const w = SEED_WORLDS.find((x) => x.name === worldName);
  return w ? { premise: w.premise, opening: w.opening } : null;
}

export async function cloneWorldIntoAdventure(worldId: number, advId: number) {
  const base = await db.select().from(entities).where(and(eq(entities.worldId, worldId)));
  const canon = base.filter((e) => e.adventureId === null);
  const map = new Map<number, number>();
  for (const e of canon) {
    const { id, createdAt, updatedAt, ...rest } = e;
    void createdAt;
    void updatedAt;
    const [row] = await db.insert(entities).values({ ...rest, adventureId: advId, parentId: null }).returning();
    map.set(id, row.id);
  }
  for (const e of canon) {
    if (e.parentId && map.get(e.parentId)) await db.update(entities).set({ parentId: map.get(e.parentId)! }).where(eq(entities.id, map.get(e.id)!));
  }
  const rels = await db.select().from(relations).where(eq(relations.worldId, worldId));
  for (const r of rels.filter((x) => x.adventureId === null)) {
    const f = map.get(r.fromId);
    const t = map.get(r.toId);
    if (f && t) await db.insert(relations).values({ worldId, adventureId: advId, fromId: f, toId: t, label: r.label, note: r.note });
  }
  return map.size;
}
