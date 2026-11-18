import { db } from "@/db";
import { adventures, changes, entities, memories, messages, players, relations } from "@/db/schema";
import { and, desc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { estimateTokens } from "@/lib/tokens";
import { norm, splitList } from "./context";
import type { Bundle, Entity, Enemy, Player, Scene } from "./store";

export interface StateChanges {
  players?: {
    name: string;
    hp_delta?: number;
    hp_set?: number | null;
    inventory_add?: { name: string; qty?: number; desc?: string }[];
    inventory_remove?: { name: string; qty?: number }[];
    conditions_add?: string[];
    conditions_remove?: string[];
    gold_delta?: number;
    xp_delta?: number;
    history_append?: string;
  }[];
  enemies?: { name: string; hp_delta?: number; hp?: number | null; max_hp?: number | null; ac?: number | null; remove?: boolean }[];
  entities?: {
    name: string;
    type?: string;
    op?: string;
    description?: string;
    status?: string;
    note?: string;
    knowledge_add?: string;
    history_append?: string;
    secrets?: string;
    triggers?: string;
    parent?: string;
  }[];
  relations?: { from: string; to: string; label: string }[];
  scene?: { location?: string; time?: string; combat?: boolean | null; active?: string[]; under_attack?: string[] };
  facts?: string[];
  image?: { prompt: string; kind?: string } | null;
}

export interface ApplyResult {
  summaries: string[];
  changedEntityIds: number[];
  image: { prompt: string; kind: string } | null;
}

function findByName<T extends { name: string }>(list: T[], name: string): T | undefined {
  const n = norm(name).trim();
  if (!n) return undefined;
  return list.find((x) => norm(x.name) === n) ?? list.find((x) => norm(x.name).includes(n) || n.includes(norm(x.name)));
}

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

async function log(advId: number, messageId: number | null, turn: number, target: string, targetId: number | null, op: string, summary: string, before: unknown, after: unknown) {
  await db.insert(changes).values({ adventureId: advId, messageId, turn, target, targetId, op, summary, before: before ?? null, after: after ?? null });
}

function appendCapped(old: string, add: string, cap = 1400) {
  const out = old ? `${old}\n${add}` : add;
  return out.length > cap ? "…" + out.slice(out.length - cap) : out;
}

export async function applyChanges(b: Bundle, messageId: number, turn: number, ch: StateChanges): Promise<ApplyResult> {
  const advId = b.adv.id;
  const res: ApplyResult = { summaries: [], changedEntityIds: [], image: null };
  const sceneBefore = JSON.parse(JSON.stringify(b.scene)) as Scene;
  const scene: Scene = { ...b.scene };

  /* --- игроки --- */
  for (const pc of arr<NonNullable<StateChanges["players"]>[number]>(ch.players)) {
    const p = findByName(b.players, str(pc.name)) as Player | undefined;
    if (!p) continue;
    const before = { hp: p.hp, tempHp: p.tempHp, gold: p.gold, xp: p.xp, inventory: p.inventory, conditions: p.conditions, history: p.history };
    let hp = p.hp;
    let temp = p.tempHp;
    const parts: string[] = [];
    if (typeof pc.hp_set === "number") {
      hp = Math.max(0, Math.min(p.maxHp, Math.round(pc.hp_set)));
      parts.push(`ЗД ${p.hp}→${hp}`);
    } else if (num(pc.hp_delta)) {
      let d = Math.round(num(pc.hp_delta));
      if (d < 0 && temp > 0) {
        const a = Math.min(temp, -d);
        temp -= a;
        d += a;
      }
      hp = Math.max(0, Math.min(p.maxHp, hp + d));
      parts.push(`ЗД ${p.hp}→${hp}${hp === 0 ? " (без сознания)" : ""}`);
    }
    let inv = arr<{ name: string; qty?: number; desc?: string; consumable?: boolean }>(p.inventory).map((i) => ({ ...i }));
    for (const it of arr<{ name: string; qty?: number; desc?: string }>(pc.inventory_add)) {
      const nm = str(it.name);
      if (!nm) continue;
      const ex = inv.find((i) => norm(i.name) === norm(nm));
      const q = Math.max(1, Math.round(num(it.qty, 1)));
      if (ex) ex.qty = (ex.qty ?? 1) + q;
      else inv.push({ name: nm, qty: q, desc: str(it.desc) });
      parts.push(`+${nm}${q > 1 ? ` x${q}` : ""}`);
    }
    for (const it of arr<{ name: string; qty?: number }>(pc.inventory_remove)) {
      const nm = norm(str(it.name));
      const ex = inv.find((i) => norm(i.name) === nm) ?? inv.find((i) => norm(i.name).includes(nm) && nm.length > 2);
      if (!ex) continue;
      ex.qty = (ex.qty ?? 1) - Math.max(1, Math.round(num(it.qty, 1)));
      parts.push(`−${ex.name}`);
    }
    inv = inv.filter((i) => (i.qty ?? 1) > 0);
    let conds = arr<string>(p.conditions).slice();
    for (const c of arr<string>(pc.conditions_add)) if (c && !conds.some((x) => norm(x) === norm(c))) (conds.push(c), parts.push(`состояние: ${c}`));
    for (const c of arr<string>(pc.conditions_remove)) {
      const before2 = conds.length;
      conds = conds.filter((x) => norm(x) !== norm(c));
      if (conds.length < before2) parts.push(`снято: ${c}`);
    }
    const gold = Math.max(0, p.gold + Math.round(num(pc.gold_delta)));
    if (gold !== p.gold) parts.push(`золото ${p.gold}→${gold}`);
    const xp = Math.max(0, p.xp + Math.round(num(pc.xp_delta)));
    if (xp !== p.xp) parts.push(`опыт +${xp - p.xp}`);
    let history = p.history;
    const ha = str(pc.history_append);
    if (ha) {
      history = appendCapped(history, `[ход ${turn}] ${ha}`);
      parts.push("история персонажа");
    }
    if (!parts.length) continue;
    const after = { hp, tempHp: temp, gold, xp, inventory: inv, conditions: conds, history };
    await db.update(players).set({ ...after, updatedAt: new Date() }).where(eq(players.id, p.id));
    await log(advId, messageId, turn, "player", p.id, "update", `${p.name}: ${parts.join(", ")}`, before, after);
    res.summaries.push(`${p.name}: ${parts.join(", ")}`);
  }

  /* --- враги --- */
  if (ch.enemies?.length) {
    let list: Enemy[] = (scene.enemies ?? []).map((e) => ({ ...e }));
    const parts: string[] = [];
    for (const en of arr<NonNullable<StateChanges["enemies"]>[number]>(ch.enemies)) {
      const nm = str(en.name);
      if (!nm) continue;
      let e = findByName(list, nm);
      if (!e) {
        const mx = Math.max(1, Math.round(num(en.max_hp ?? en.hp, 10)));
        e = { id: `e${Date.now()}${list.length}`, name: nm, hp: Math.round(num(en.hp, mx)), maxHp: mx, ac: en.ac ? Math.round(num(en.ac)) : undefined };
        list.push(e);
        parts.push(`${nm} вступает в бой`);
      }
      if (typeof en.max_hp === "number") e.maxHp = en.max_hp;
      if (typeof en.hp === "number") e.hp = Math.round(en.hp);
      if (num(en.hp_delta)) {
        e.hp = Math.max(0, Math.min(e.maxHp, e.hp + Math.round(num(en.hp_delta))));
        parts.push(`${e.name} ${e.hp}/${e.maxHp}`);
      }
      if (typeof en.ac === "number") e.ac = en.ac;
      if (en.remove || e.hp <= 0) {
        list = list.filter((x) => x.id !== e!.id);
        parts.push(`${e.name} повержен`);
      }
    }
    scene.enemies = list;
    if (parts.length) res.summaries.push("Враги: " + parts.join(", "));
  }

  /* --- сцена --- */
  if (ch.scene) {
    const sc = ch.scene;
    if (str(sc.location)) scene.location = str(sc.location);
    if (str(sc.time)) scene.time = str(sc.time);
    if (typeof sc.combat === "boolean") {
      if (sc.combat && !scene.combat) scene.round = 1;
      else if (sc.combat) scene.round = (scene.round ?? 1) + 1;
      scene.combat = sc.combat;
      if (!sc.combat) scene.enemies = [];
    }
    const toIds = (names: unknown) =>
      arr<string>(names)
        .map((n) => findByName(b.players, str(n))?.id)
        .filter((x): x is number => typeof x === "number");
    if (sc.active) scene.active = toIds(sc.active);
    if (sc.under_attack) scene.underAttack = toIds(sc.under_attack);
  }

  /* --- сущности --- */
  const ents: Entity[] = [...b.entities];
  for (const ec of arr<NonNullable<StateChanges["entities"]>[number]>(ch.entities)) {
    const nm = str(ec.name);
    if (!nm) continue;
    const ex = findByName(ents, nm) as Entity | undefined;
    if (!ex && (ec.op === "create" || ec.description)) {
      const type = ["character", "location", "faction", "quest", "rumor", "item", "event"].includes(str(ec.type)) ? str(ec.type) : "character";
      const parent = ec.parent ? findByName(ents.filter((e) => e.type === "location"), str(ec.parent)) : undefined;
      const [row] = await db
        .insert(entities)
        .values({
          worldId: b.adv.worldId,
          adventureId: b.adv.id,
          type,
          name: nm,
          triggers: str(ec.triggers) || nm,
          mode: type === "quest" ? "always" : "trigger",
          compact: str(ec.description),
          description: str(ec.description),
          status: str(ec.status),
          secrets: str(ec.secrets),
          knowledge: str(ec.knowledge_add),
          parentId: parent?.id ?? null,
        })
        .returning();
      ents.push(row);
      res.changedEntityIds.push(row.id);
      await log(advId, messageId, turn, "entity", row.id, "create", `Новая карточка: ${nm} (${type})`, null, row);
      res.summaries.push(`Новая карточка: ${nm}`);
      continue;
    }
    if (!ex || ex.locked) continue;
    const before = { compact: ex.compact, description: ex.description, status: ex.status, knowledge: ex.knowledge, history: ex.history, secrets: ex.secrets, triggers: ex.triggers };
    const after = { ...before };
    const parts: string[] = [];
    if (str(ec.description) && norm(str(ec.description)) !== norm(ex.compact)) {
      after.compact = str(ec.description);
      parts.push("описание");
    }
    if (str(ec.status) && str(ec.status) !== ex.status) {
      after.status = str(ec.status);
      parts.push(`статус: ${after.status}`);
    }
    if (str(ec.knowledge_add)) {
      after.knowledge = appendCapped(ex.knowledge, str(ec.knowledge_add), 900);
      parts.push("знания");
    }
    if (str(ec.history_append) || str(ec.note)) {
      after.history = appendCapped(ex.history, `[ход ${turn}] ${str(ec.history_append) || str(ec.note)}`);
      parts.push("история");
    }
    if (str(ec.secrets)) {
      after.secrets = str(ec.secrets);
      parts.push("тайны");
    }
    if (str(ec.triggers)) {
      const set = new Set([...splitList(ex.triggers), ...splitList(str(ec.triggers))]);
      after.triggers = [...set].join(", ");
    }
    if (!parts.length) continue;
    await db.update(entities).set({ ...after, updatedAt: new Date() }).where(eq(entities.id, ex.id));
    res.changedEntityIds.push(ex.id);
    await log(advId, messageId, turn, "entity", ex.id, "update", `${ex.name}: ${parts.join(", ")}`, before, after);
    res.summaries.push(`${ex.name}: ${parts.join(", ")}`);
  }

  /* --- отношения --- */
  for (const r of arr<NonNullable<StateChanges["relations"]>[number]>(ch.relations)) {
    const f = findByName(ents, str(r.from));
    const t = findByName(ents, str(r.to));
    if (!f || !t || f.id === t.id || !str(r.label)) continue;
    const exist = b.relations.find((x) => x.fromId === f.id && x.toId === t.id);
    if (exist) {
      if (exist.label === str(r.label)) continue;
      await db.update(relations).set({ label: str(r.label) }).where(eq(relations.id, exist.id));
      await log(advId, messageId, turn, "relation", exist.id, "update", `${f.name} → ${t.name}: ${str(r.label)}`, { label: exist.label }, { label: str(r.label) });
    } else {
      const [row] = await db.insert(relations).values({ worldId: b.adv.worldId, adventureId: advId, fromId: f.id, toId: t.id, label: str(r.label) }).returning();
      await log(advId, messageId, turn, "relation", row.id, "create", `${f.name} → ${t.name}: ${str(r.label)}`, null, row);
    }
    res.summaries.push(`Отношение: ${f.name} → ${t.name}: ${str(r.label)}`);
  }

  /* --- сцена (сохранение) --- */
  if (JSON.stringify(scene) !== JSON.stringify(sceneBefore)) {
    await db.update(adventures).set({ scene, updatedAt: new Date() }).where(eq(adventures.id, advId));
    await log(advId, messageId, turn, "scene", advId, "update", "Сцена обновлена", sceneBefore, scene);
  }

  /* --- факты в блокнот --- */
  for (const f of arr<string>(ch.facts).slice(0, 3)) {
    const text = str(f);
    if (text.length < 8) continue;
    const [m] = await db
      .insert(memories)
      .values({ adventureId: advId, level: 0, kind: "fact", content: text, fromTurn: turn, toTurn: turn, importance: 0.65, tokens: estimateTokens(text), author: "ai" })
      .returning();
    await log(advId, messageId, turn, "memory", m.id, "create", `Факт: ${text}`, null, m);
  }

  if (ch.image?.prompt) res.image = { prompt: str(ch.image.prompt), kind: str(ch.image.kind) || "background" };
  return res;
}

/** Откат всех изменений карточек, сделанных ответом (регенерация/удаление/правка). */
export async function revertMessageChanges(advId: number, messageId: number): Promise<number> {
  const rows = await db
    .select()
    .from(changes)
    .where(and(eq(changes.adventureId, advId), eq(changes.messageId, messageId), eq(changes.reverted, false)))
    .orderBy(desc(changes.id));
  for (const c of rows) {
    const before = (c.before ?? {}) as Record<string, unknown>;
    try {
      if (c.target === "player" && c.targetId) await db.update(players).set(before).where(eq(players.id, c.targetId));
      else if (c.target === "entity" && c.targetId) {
        if (c.op === "create") await db.delete(entities).where(eq(entities.id, c.targetId));
        else await db.update(entities).set(before).where(eq(entities.id, c.targetId));
      } else if (c.target === "scene") await db.update(adventures).set({ scene: before }).where(eq(adventures.id, advId));
      else if (c.target === "relation" && c.targetId) {
        if (c.op === "create") await db.delete(relations).where(eq(relations.id, c.targetId));
        else await db.update(relations).set(before).where(eq(relations.id, c.targetId));
      } else if (c.target === "memory" && c.targetId) await db.delete(memories).where(eq(memories.id, c.targetId));
    } catch {
      /* карточку могли удалить вручную */
    }
    await db.update(changes).set({ reverted: true }).where(eq(changes.id, c.id));
  }
  return rows.length;
}

/** Блокнот не должен хранить «ложные факты»: записи, покрывающие изменённый ход, удаляются, сообщения возвращаются на пересжатие. */
export async function invalidateMemories(advId: number, fromTurn: number, toTurn = Number.MAX_SAFE_INTEGER): Promise<number> {
  const rows = await db.select().from(memories).where(eq(memories.adventureId, advId));
  const bad = rows.filter((m) => m.toTurn >= fromTurn && m.fromTurn <= toTurn && !m.locked && m.author === "ai");
  for (const m of bad) {
    await db
      .update(messages)
      .set({ summarized: false })
      .where(and(eq(messages.adventureId, advId), gte(messages.turn, m.fromTurn), lte(messages.turn, m.toTurn), ne(messages.status, "deleted")));
    await db.delete(memories).where(eq(memories.id, m.id));
  }
  return bad.length;
}

/** Откат таймлайна: все ответы с turn >= T теряют эффект. */
export async function rewindFrom(advId: number, turn: number, includeUserOfTurn: boolean) {
  const msgs = await db.select().from(messages).where(and(eq(messages.adventureId, advId), gte(messages.turn, turn), eq(messages.status, "active")));
  const assistants = msgs.filter((m) => m.role === "assistant").sort((a, c) => c.id - a.id);
  for (const m of assistants) await revertMessageChanges(advId, m.id);
  const ids = msgs.filter((m) => (m.role === "assistant" && m.turn >= turn) || (m.turn > turn) || (includeUserOfTurn && m.turn === turn)).map((m) => m.id);
  if (ids.length) await db.update(messages).set({ status: "superseded" }).where(inArray(messages.id, ids));
  await invalidateMemories(advId, turn);
  const [{ maxTurn }] = (await db.select({ maxTurn: messages.turn }).from(messages).where(and(eq(messages.adventureId, advId), eq(messages.status, "active"))).orderBy(desc(messages.turn)).limit(1)).map((x) => ({ maxTurn: x.maxTurn })).concat([{ maxTurn: 0 }]);
  await db.update(adventures).set({ turn: maxTurn, pending: null, updatedAt: new Date() }).where(eq(adventures.id, advId));
}
