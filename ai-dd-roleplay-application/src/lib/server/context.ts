import type { Settings } from "@/lib/config";
import { clipToTokens, estimateTokens } from "@/lib/tokens";
import { abilityMod, fmtMod, profBonus } from "@/lib/dice";
import { SKILLS } from "@/lib/dnd/data";
import { abilityScores, analyzeAction, saveMod, skillMod, skillLevel, type PlayerLike } from "@/lib/dnd/validate";
import type { ChatMessage } from "./ai";
import { buildSystemPrompt } from "./prompts";
import type { Bundle, Entity, Memory, Message, Player } from "./store";

export type Group = "system" | "rules" | "party" | "world" | "lore" | "memory" | "history" | "notes";

export interface CtxBlock {
  id: string;
  group: Group;
  title: string;
  text: string;
  tokens: number;
  included: boolean;
  reason: string;
  entityId?: number;
}

export interface Candidate {
  id: number;
  name: string;
  type: string;
  mode: string;
  why: "trigger" | "logic" | "current" | "sticky" | "related";
  score: number;
  brief: string;
}

export interface RollResultInfo {
  playerId: number;
  playerName: string;
  text: string; // готовая строка для ИИ
}

export interface Decision {
  include: number[];
  exclude: number[];
  plan?: string;
  notes?: string[];
}

export interface Retrieval {
  always: Entity[];
  triggered: Candidate[];
  logic: Candidate[];
  sticky: Candidate[];
  current: Entity[];
}

export interface BuildArgs {
  settings: Settings;
  b: Bundle;
  userText: string;
  actingPlayerIds: number[];
  roll?: RollResultInfo | null;
  decision?: Decision | null;
  retrieval?: Retrieval;
  rollTag: boolean;
  inlineState: boolean;
  turn: number;
  preview?: boolean;
}

export interface BuildResult {
  messages: ChatMessage[];
  blocks: CtxBlock[];
  totalTokens: number;
  budget: number;
  limits: Record<string, { used: number; limit: number }>;
  includedEntityIds: number[];
  retrieval: Retrieval;
  overflowUnsummarized: number;
  historyTokens: number;
  historyBudget: number;
}

/* ---------- текстовые утилиты ---------- */

export const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е");
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function stem(w: string) {
  if (w.length > 6) return w.slice(0, w.length - 2);
  if (w.length > 4) return w.slice(0, w.length - 1);
  return w;
}

export function triggerHit(trigger: string, hayNorm: string): boolean {
  const t = norm(trigger).trim();
  if (!t) return false;
  const words = t.split(/\s+/).filter(Boolean);
  return words.every((w) => new RegExp("(^|[^\\p{L}\\p{N}])" + esc(stem(w)), "u").test(hayNorm));
}

function words(text: string): string[] {
  return (norm(text).match(/[\p{L}\p{N}]{3,}/gu) ?? []).map((w) => w.slice(0, 5));
}

export function splitList(s: string): string[] {
  return s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

const TYPE_LABEL: Record<string, string> = { character: "NPC", location: "PLACE", faction: "FACTION", quest: "QUEST", rumor: "RUMOR", item: "ITEM", event: "EVENT" };

function firstSentence(t: string) {
  const m = t.match(/^.*?[.!?](\s|$)/s);
  return (m ? m[0] : t).trim();
}

export function entityBase(e: Entity, s: Settings) {
  return (s.optimize.compactCards ? e.compact || e.description : e.description || e.compact).trim();
}

export function renderEntity(e: Entity, level: 0 | 1 | 2, s: Settings): string {
  const T = TYPE_LABEL[e.type] ?? e.type.toUpperCase();
  const base = entityBase(e, s);
  const status = e.status ? ` (${e.status})` : "";
  if (level === 2) return `[${T}] ${e.name}${status}: ${clipToTokens(firstSentence(base), 28)}`;
  if (level === 1) return `[${T}] ${e.name}${status}: ${clipToTokens(base, 90)}${e.knowledge ? ` | Knows: ${clipToTokens(e.knowledge, 40)}` : ""}`;
  return (
    `[${T}] ${e.name}${status}: ${clipToTokens(base, 220)}` +
    (e.knowledge ? ` | Knows: ${clipToTokens(e.knowledge, 80)}` : "") +
    (e.history ? ` | Arc: ${clipToTokens(e.history, 80)}` : "") +
    (e.secrets ? ` | GM-only: ${clipToTokens(e.secrets, 60)}` : "")
  );
}

/* ---------- карточка игрока ---------- */

export function renderPlayer(p: Player, level: 0 | 1 | 2, s: Settings): string {
  const sc = abilityScores(p);
  const pb = profBonus(p.level);
  const ab = (["str", "dex", "con", "int", "wis", "cha"] as const).map((k) => `${k.toUpperCase()} ${sc[k]}(${fmtMod(abilityMod(sc[k]))})`).join(" ");
  const inv = ((p.inventory ?? []) as { name: string; qty?: number }[]).map((i) => ((i.qty ?? 1) > 1 ? `${i.name} x${i.qty}` : i.name));
  const conds = (p.conditions ?? []) as string[];
  const head = `PC ${p.name}: ${p.race} ${p.className}${p.subclass ? ` (${p.subclass})` : ""} L${p.level}${p.alignment ? `, ${p.alignment}` : ""}. HP ${p.hp}/${p.maxHp}${p.tempHp ? `+${p.tempHp}t` : ""} AC ${p.ac} Spd ${p.speed}. ${ab}.`;
  if (level === 2) return `${head}${conds.length ? ` Cond: ${conds.join(",")}.` : ""}`;
  const skills = ((p.skills ?? []) as { key: string; level?: number }[])
    .filter((x) => (x.level ?? 1) > 0)
    .map((x) => {
      const sk = SKILLS.find((k) => k.key === x.key);
      return sk ? `${sk.name}${(x.level ?? 1) > 1 ? "*" : ""} ${fmtMod(skillMod(p as PlayerLike, x.key))}` : "";
    })
    .filter(Boolean);
  const saves = ((p.saves ?? []) as string[]).map((k) => `${k.toUpperCase()} ${fmtMod(saveMod(p as PlayerLike, k as never))}`);
  const passive = 10 + skillMod(p as PlayerLike, "perception");
  let mid = ` Prof +${pb}. Saves: ${saves.join(" ") || "-"}. Skills: ${skills.join(", ") || "-"}. Passive Perception ${passive}. Gold ${p.gold}. Items: ${inv.join(", ") || "none"}.${conds.length ? ` Conditions: ${conds.join(", ")}.` : ""}`;
  if (level === 1) return head + mid;
  const story = s.optimize.compactCards && p.compact ? p.compact : [p.backstory, p.personality].filter(Boolean).join(" ");
  mid += (p.features ? ` Features: ${clipToTokens(p.features, 90)}.` : "") + (story ? ` Story: ${clipToTokens(story, 90)}` : "") + (p.history ? ` Arc: ${clipToTokens(p.history, 70)}` : "");
  return head + mid;
}

/* ---------- книги правил ---------- */

interface Section {
  title: string;
  kw: string[];
  always: boolean;
  body: string;
}

export function parseSections(text: string): Section[] {
  const out: Section[] = [];
  const parts = text.split(/^##\s+/m).filter((x) => x.trim());
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const headLine = nl >= 0 ? part.slice(0, nl) : part;
    const body = nl >= 0 ? part.slice(nl + 1).trim() : "";
    const [title, kwPart] = headLine.split("| kw:");
    const kw = (kwPart ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    out.push({ title: title.trim(), kw, always: kw.includes("*"), body });
  }
  return out;
}

/* ---------- retrieval ---------- */

function currentLocations(b: Bundle): Entity[] {
  const name = b.scene.location ? norm(b.scene.location) : "";
  if (!name) return [];
  const loc = b.entities.find((e) => e.type === "location" && e.mode !== "off" && (norm(e.name) === name || name.includes(norm(e.name)) || norm(e.name).includes(name)));
  if (!loc) return [];
  const chain = [loc];
  let cur = loc;
  for (let i = 0; i < 3 && cur.parentId; i++) {
    const par = b.entities.find((e) => e.id === cur.parentId);
    if (!par) break;
    chain.push(par);
    cur = par;
  }
  return chain;
}

export function retrieve(settings: Settings, b: Bundle, userText: string, turn: number): Retrieval {
  const recent = b.messages.slice(-4).map((m) => m.content).join("\n");
  const hay = norm(userText + "\n" + recent);
  const hayUser = norm(userText);
  const live = b.entities.filter((e) => e.mode !== "off");
  const always = live.filter((e) => e.mode === "always");
  const current = currentLocations(b);
  const triggered: Candidate[] = [];
  const logic: Candidate[] = [];

  const df = new Map<string, number>();
  const docs = new Map<number, Set<string>>();
  for (const e of live) {
    const set = new Set(words(`${e.name} ${e.aliases} ${e.triggers} ${e.compact || e.description}`));
    docs.set(e.id, set);
    set.forEach((w) => df.set(w, (df.get(w) ?? 0) + 1));
  }
  const q = new Set(words(userText + " " + b.messages.slice(-2).map((m) => m.content).join(" ")));
  const n = Math.max(1, live.length);

  for (const e of live) {
    if (e.mode === "always") continue;
    const trig = [e.name, ...splitList(e.aliases), ...splitList(e.triggers)];
    let hits = 0;
    let inUser = false;
    for (const t of trig) {
      if (triggerHit(t, hay)) {
        hits++;
        if (triggerHit(t, hayUser)) inUser = true;
      }
    }
    const brief = clipToTokens(firstSentence(entityBase(e, settings)), 30);
    if (e.mode === "trigger" && hits > 0) {
      triggered.push({ id: e.id, name: e.name, type: e.type, mode: e.mode, why: "trigger", score: 10 + hits + (inUser ? 3 : 0), brief });
      continue;
    }
    // BM25-lite по пересечению основ слов
    let score = 0;
    const doc = docs.get(e.id)!;
    q.forEach((w) => {
      if (doc.has(w)) score += Math.log(1 + n / (df.get(w) ?? 1));
    });
    if (hits > 0) score += 4 * hits;
    if (e.mode === "logic" || (e.mode === "trigger" && hits === 0)) {
      if (e.mode === "logic" && score > 1.2) logic.push({ id: e.id, name: e.name, type: e.type, mode: e.mode, why: "logic", score, brief });
    }
  }

  // связанные через отношения с уже найденными (1 шаг)
  const found = new Set([...triggered.map((c) => c.id), ...current.map((c) => c.id)]);
  for (const r of b.relations) {
    for (const [a, o] of [[r.fromId, r.toId], [r.toId, r.fromId]]) {
      if (found.has(a) && !found.has(o)) {
        const e = live.find((x) => x.id === o);
        if (e && e.mode === "logic" && !logic.some((c) => c.id === o)) {
          logic.push({ id: o, name: e.name, type: e.type, mode: e.mode, why: "related", score: 1.5, brief: clipToTokens(firstSentence(entityBase(e, settings)), 30) });
        }
      }
    }
  }

  const sticky: Candidate[] = [];
  const st = b.scene.sticky ?? {};
  for (const [id, last] of Object.entries(st)) {
    if (turn - last > settings.optimize.stickyTurns || turn - last <= 0) continue;
    const e = live.find((x) => x.id === Number(id));
    if (!e || e.mode === "always") continue;
    if (triggered.some((c) => c.id === e.id)) continue;
    sticky.push({ id: e.id, name: e.name, type: e.type, mode: e.mode, why: "sticky", score: 5 - (turn - last), brief: "" });
  }

  triggered.sort((a, c) => c.score - a.score);
  logic.sort((a, c) => c.score - a.score);
  return { always, triggered, logic, sticky, current };
}

/* ---------- память ---------- */

function memoryRelevance(m: Memory, q: Set<string>, newestTo: number): number {
  const w = words(m.content);
  let hit = 0;
  for (const x of w) if (q.has(x)) hit++;
  const rel = w.length ? hit / Math.sqrt(w.length) : 0;
  const recency = newestTo > 0 ? m.toTurn / newestTo : 0;
  return rel * 2 + recency + m.importance + (m.locked ? 5 : 0) + (m.level >= 1 ? 0.5 : 0);
}

/* ---------- сборка ---------- */

export function buildContext(a: BuildArgs): BuildResult {
  const { settings: s, b } = a;
  const blocks: CtxBlock[] = [];
  const limits: BuildResult["limits"] = {};
  const total = Math.max(1000, s.context.size - s.context.reserveReply);
  const split = s.context.split;
  const splitSum = Object.values(split).reduce((x, y) => x + y, 0) || 100;
  const seen = new Set<string>();

  const edition = b.adv.edition === "2024" ? "2024" : "2014";
  const party = b.players.map((p) => p.name);
  let sys = buildSystemPrompt(s, { edition, chatStyle: b.adv.chatStyle, rollTag: a.rollTag, inlineState: a.inlineState, party });
  if (estimateTokens(sys) > total * 0.25 && s.optimize.systemSize !== "min") {
    sys = buildSystemPrompt({ ...s, optimize: { ...s.optimize, systemSize: "min" } }, { edition, chatStyle: b.adv.chatStyle, rollTag: a.rollTag, inlineState: a.inlineState, party });
  }
  const sysTokens = estimateTokens(sys);

  /* --- заметки к последнему ходу (в конце: свежесть для модели) --- */
  const notes: string[] = [];
  const acting = a.actingPlayerIds.map((id) => b.players.find((p) => p.id === id)).filter(Boolean) as Player[];
  if (a.roll) notes.push(a.roll.text);
  else if (acting.length) {
    for (const p of acting) {
      const an = analyzeAction(a.userText, p);
      if (an.suggested && an.suggested.kind !== "spell") notes.push(`Hint (${p.name}): relevant check ${an.suggested.label} ${fmtMod(an.suggested.mod)}; roll only if outcome is uncertain.`);
      for (const nt of an.notes) notes.push(`Note (${p.name}): ${nt}`);
    }
  }
  if (a.decision?.notes?.length) notes.push(...a.decision.notes.map((x) => `Check: ${x}`));
  if (a.decision?.plan) notes.push(`Plan for this reply: ${a.decision.plan}`);
  if (acting.length > 1) notes.push(`Several PCs act this turn, answer each in the given order: ${acting.map((p) => p.name).join(" → ")}.`);
  const notesText = notes.length ? `[GM notes — not visible to players]\n${notes.join("\n")}` : "";
  const notesTokens = estimateTokens(notesText);

  const avail = Math.max(500, total - sysTokens - notesTokens);
  const lim = (g: keyof typeof split) => Math.floor((avail * split[g]) / splitSum);
  const used: Record<string, number> = { system: sysTokens, notes: notesTokens, rules: 0, party: 0, world: 0, lore: 0, memory: 0, history: 0 };

  const push = (blk: Omit<CtxBlock, "tokens">) => {
    const tokens = estimateTokens(blk.text);
    blocks.push({ ...blk, tokens });
    return tokens;
  };

  push({ id: "system", group: "system", title: "Системный промт мастера", text: sys, included: true, reason: `размер: ${s.optimize.systemSize}` });
  if (notesText) push({ id: "notes", group: "notes", title: "Заметки к ходу (проверки, подсказки)", text: notesText, included: true, reason: "в конец последнего сообщения" });

  /* --- мир --- */
  const worldParts: string[] = [];
  if (b.world) {
    const wc = (s.optimize.compactCards ? b.world.compact || b.world.description : b.world.description).trim();
    worldParts.push(`WORLD ${b.world.name}: ${wc}${b.world.rules ? ` Laws: ${b.world.rules}` : ""}${b.world.tone ? ` Tone: ${b.world.tone}` : ""}`);
  }
  const prem = (b.adv.premiseCompact || b.adv.premise).trim();
  if (prem) worldParts.push(`PREMISE: ${prem}`);
  const worldText = clipToTokens(worldParts.join("\n"), lim("world"));
  if (worldText) used.world += push({ id: "world", group: "world", title: "Мир и сюжет", text: worldText, included: true, reason: "всегда" });

  /* --- правила --- */
  const recentHay = norm(a.userText + "\n" + b.messages.slice(-3).map((m) => m.content).join("\n") + (b.scene.combat ? " combat fight attack battle" : ""));
  const ruleLimit = lim("rules");
  const sections = b.rulebooks.flatMap((r) => parseSections(r.compact || r.content));
  const alwaysSec = sections.filter((x) => x.always);
  const matched = sections
    .filter((x) => !x.always)
    .map((x) => ({ x, hits: x.kw.filter((k) => triggerHit(k, recentHay)).length }))
    .filter((r) => r.hits > 0)
    .sort((p, q) => q.hits - p.hits);
  let ruleUsed = 0;
  const ruleBlocks: { sec: Section; why: string }[] = [];
  for (const sec of alwaysSec) ruleBlocks.push({ sec, why: "ядро" });
  for (const r of matched) ruleBlocks.push({ sec: r.x, why: `ключевые слова (${r.hits})` });
  const stableRules: string[] = [];
  const dynRules: string[] = [];
  for (const { sec, why } of ruleBlocks) {
    const txt = `## ${sec.title}\n${sec.body}`;
    const t = estimateTokens(txt);
    // ядро занимает не больше 60% бюджета: остальное — для разделов, нужных именно сейчас (бой, магия, торговля…)
    const cap = why === "ядро" ? ruleLimit * 0.6 : ruleLimit;
    if (ruleUsed + t > cap) {
      blocks.push({ id: `rule-${sec.title}`, group: "rules", title: `Правило: ${sec.title}`, text: txt, tokens: t, included: false, reason: "не влезло в бюджет правил" });
      continue;
    }
    ruleUsed += t;
    (why === "ядро" ? stableRules : dynRules).push(txt);
    blocks.push({ id: `rule-${sec.title}`, group: "rules", title: `Правило: ${sec.title}`, text: txt, tokens: t, included: true, reason: why });
  }
  used.rules = ruleUsed;

  /* --- игроки и сцена --- */
  const partyLimit = lim("party");
  const sceneLines: string[] = [];
  const sc = b.scene;
  if (sc.location || sc.time || sc.combat || sc.summary) {
    sceneLines.push(`SCENE: ${[sc.location && `at ${sc.location}`, sc.time, sc.combat ? `COMBAT round ${sc.round ?? 1}` : ""].filter(Boolean).join(", ")}${sc.summary ? `. ${sc.summary}` : ""}`);
  }
  if (sc.enemies?.length) sceneLines.push(`ENEMIES: ${sc.enemies.map((e) => `${e.name} ${e.hp}/${e.maxHp}hp${e.ac ? ` AC${e.ac}` : ""}${e.notes ? ` (${e.notes})` : ""}`).join("; ")}`);
  const hot = (sc.active ?? []).map((id) => b.players.find((p) => p.id === id)?.name).filter(Boolean);
  if (hot.length) sceneLines.push(`ADDRESS NEXT: ${hot.join(", ")}`);
  const sceneText = sceneLines.join("\n");
  const sceneTok = sceneText ? push({ id: "scene", group: "party", title: "Сцена и враги", text: sceneText, included: true, reason: "состояние сцены" }) : 0;

  let level: 0 | 1 | 2 = 0;
  let partyTexts = b.players.map((p) => renderPlayer(p, level, s));
  const tokOf = (arr: string[]) => arr.reduce((x, y) => x + estimateTokens(y), 0);
  while (level < 2 && tokOf(partyTexts) + sceneTok > partyLimit) {
    level = (level + 1) as 0 | 1 | 2;
    partyTexts = b.players.map((p) => renderPlayer(p, level, s));
  }
  b.players.forEach((p, i) => {
    used.party += push({ id: `pc-${p.id}`, group: "party", title: `Игрок: ${p.name}`, text: partyTexts[i], included: true, reason: level === 0 ? "полная карточка" : level === 1 ? "сжатая карточка" : "минимальная карточка" });
  });
  used.party += sceneTok;

  /* --- лорбук --- */
  const r = a.retrieval ?? retrieve(s, b, a.userText, a.turn);
  const loreLimit = lim("lore");
  let loreUsed = 0;
  const includedIds: number[] = [];
  const excluded = new Set(a.decision?.exclude ?? []);
  const forced = new Set(a.decision?.include ?? []);
  const byId = new Map(b.entities.map((e) => [e.id, e]));
  const stableLore: string[] = [];
  const dynLore: string[] = [];
  const maxPer = s.optimize.maxEntitiesPerTurn;
  let dynCount = 0;

  const order: { e: Entity; why: string; stable: boolean }[] = [];
  for (const e of [...r.always].sort((x, y) => Number(y.neverForget) - Number(x.neverForget))) order.push({ e, why: e.neverForget ? "всегда (нельзя забывать)" : "режим «всегда»", stable: true });
  for (const e of r.current) order.push({ e, why: "текущая локация", stable: false });
  const dyn: Candidate[] = [
    ...r.triggered,
    ...[...forced].map((id) => ({ id, name: "", type: "", mode: "", why: "logic" as const, score: 9, brief: "" })),
    ...r.logic.filter((c) => s.optimize.logicSelector === "ai" ? forced.has(c.id) : true),
    ...r.sticky,
  ];
  const reasonLabel: Record<string, string> = { trigger: "сработал триггер", logic: "по логике", related: "связь с найденным", sticky: "липкость (был недавно)", current: "локация" };
  for (const c of dyn) {
    const e = byId.get(c.id);
    if (!e) continue;
    order.push({ e, why: forced.has(c.id) && c.why !== "trigger" ? "выбрал режиссёр" : reasonLabel[c.why], stable: false });
  }

  const done = new Set<number>();
  for (const { e, why, stable } of order) {
    if (done.has(e.id)) continue;
    done.add(e.id);
    if (excluded.has(e.id) && e.mode !== "always") {
      blocks.push({ id: `ent-${e.id}`, group: "lore", title: e.name, text: "", tokens: 0, included: false, reason: "режиссёр: не нужна в этой сцене", entityId: e.id });
      continue;
    }
    if (!stable && why !== "текущая локация" && dynCount >= maxPer) {
      blocks.push({ id: `ent-${e.id}`, group: "lore", title: e.name, text: renderEntity(e, 2, s), tokens: 0, included: false, reason: `лимит карточек за ход (${maxPer})`, entityId: e.id });
      continue;
    }
    let chosen: string | null = null;
    let lv: 0 | 1 | 2 = 0;
    for (lv = 0; lv <= 2; lv = (lv + 1) as 0 | 1 | 2) {
      const txt = renderEntity(e, lv, s);
      if (loreUsed + estimateTokens(txt) <= loreLimit) {
        chosen = txt;
        break;
      }
      if (lv === 2) break;
    }
    if (!chosen) {
      blocks.push({ id: `ent-${e.id}`, group: "lore", title: e.name, text: renderEntity(e, 2, s), tokens: 0, included: false, reason: "не влезло в бюджет лорбука", entityId: e.id });
      continue;
    }
    const key = norm(chosen);
    if (s.optimize.dedupe && seen.has(key)) continue;
    seen.add(key);
    loreUsed += estimateTokens(chosen);
    includedIds.push(e.id);
    if (!stable) dynCount++;
    (stable ? stableLore : dynLore).push(chosen);
    blocks.push({ id: `ent-${e.id}`, group: "lore", title: e.name, text: chosen, tokens: estimateTokens(chosen), included: true, reason: why + (lv > 0 ? " · сжато" : ""), entityId: e.id });
  }
  // отношения между включёнными
  const relLines: string[] = [];
  for (const rel of b.relations) {
    if (includedIds.includes(rel.fromId) && includedIds.includes(rel.toId)) {
      const f = byId.get(rel.fromId)?.name;
      const t = byId.get(rel.toId)?.name;
      if (f && t && rel.label) relLines.push(`${f} → ${t}: ${rel.label}`);
    }
  }
  if (relLines.length && loreUsed + estimateTokens(relLines.join("\n")) <= loreLimit) {
    const txt = "RELATIONS: " + relLines.join("; ");
    loreUsed += estimateTokens(txt);
    dynLore.push(txt);
    push({ id: "relations", group: "lore", title: "Отношения", text: txt, included: true, reason: "между подтянутыми сущностями" });
  }
  used.lore = loreUsed;

  /* --- память --- */
  const memLimit = lim("memory");
  let memUsed = 0;
  const memLines: string[] = [];
  const never = s.memory.neverForget.filter(Boolean);
  if (never.length) {
    const txt = "NEVER FORGET: " + never.join(" | ");
    memUsed += estimateTokens(txt);
    memLines.push(txt);
    blocks.push({ id: "never", group: "memory", title: "Нельзя забывать (список пользователя)", text: txt, tokens: estimateTokens(txt), included: true, reason: "закреплено пользователем" });
  }
  const newestTo = b.memories.reduce((m, x) => Math.max(m, x.toTurn), 0);
  const qset = new Set(words(a.userText + " " + b.messages.slice(-2).map((m) => m.content).join(" ")));
  const scored = b.memories
    .map((m) => ({ m, score: memoryRelevance(m, qset, newestTo) }))
    .sort((x, y) => y.score - x.score);
  const lastTwo = new Set([...b.memories].filter((m) => m.level === 0).slice(-2).map((m) => m.id));
  const picked: Memory[] = [];
  const pool = [...scored.filter((x) => x.m.locked || lastTwo.has(x.m.id)), ...scored.filter((x) => !(x.m.locked || lastTwo.has(x.m.id)))];
  let topK = 0;
  for (const { m, score } of pool) {
    const mandatory = m.locked || lastTwo.has(m.id);
    if (!mandatory && topK >= s.memory.notebookTopK) {
      blocks.push({ id: `mem-${m.id}`, group: "memory", title: `Блокнот #${m.id} (ходы ${m.fromTurn}–${m.toTurn})`, text: m.content, tokens: m.tokens, included: false, reason: "менее релевантна", entityId: undefined });
      continue;
    }
    const t = estimateTokens(m.content) + 6;
    if (memUsed + t > memLimit && !m.locked) {
      blocks.push({ id: `mem-${m.id}`, group: "memory", title: `Блокнот #${m.id} (ходы ${m.fromTurn}–${m.toTurn})`, text: m.content, tokens: t, included: false, reason: "не влезла в бюджет памяти" });
      continue;
    }
    memUsed += t;
    if (!mandatory) topK++;
    picked.push(m);
    blocks.push({ id: `mem-${m.id}`, group: "memory", title: `Блокнот #${m.id} (ходы ${m.fromTurn}–${m.toTurn})`, text: m.content, tokens: t, included: true, reason: m.locked ? "закреплена" : lastTwo.has(m.id) ? "последняя сцена" : `релевантность ${score.toFixed(1)}` });
  }
  picked.sort((x, y) => x.fromTurn - y.fromTurn || x.id - y.id);
  for (const m of picked) memLines.push(`(t${m.fromTurn}${m.toTurn !== m.fromTurn ? `–${m.toTurn}` : ""}) ${m.content}`);
  const pinnedMsgs = b.messages.filter((m) => m.pinned);
  used.memory = memUsed;

  /* --- история --- */
  const fixed = used.system + used.notes + used.rules + used.party + used.world + used.lore + used.memory;
  const historyBudget = Math.max(Math.floor((avail * split.history) / splitSum), total - fixed);
  const unsum = b.messages.filter((m) => !m.summarized && m.role !== "system");
  const hist: { m: Message; text: string; t: number }[] = [];
  let histUsed = 0;
  const lastAssistantIdx = [...unsum].map((m) => m.role).lastIndexOf("assistant");
  const nameOf = (m: Message) => b.players.find((p) => p.id === m.playerId)?.name;
  const fmt = (m: Message, idx: number): string => {
    if (m.role === "user") {
      const rollInfo = (m.meta as { rollText?: string } | null)?.rollText;
      return `${nameOf(m) ? `[${nameOf(m)}] ` : ""}${m.content}${rollInfo ? `\n(${rollInfo})` : ""}`;
    }
    let txt = m.content;
    if (s.optimize.historyTrimLongReplies && idx !== lastAssistantIdx && idx < unsum.length - 3) txt = clipToTokens(txt, 260);
    return txt;
  };
  let cut = 0;
  for (let i = unsum.length - 1; i >= 0; i--) {
    const m = unsum[i];
    const text = fmt(m, i);
    const t = estimateTokens(text) + 4;
    if (histUsed + t > historyBudget && hist.length >= 2) {
      cut = i + 1;
      break;
    }
    hist.unshift({ m, text, t });
    histUsed += t;
  }
  used.history = histUsed;
  const histIds = new Set(hist.map((h) => h.m.id));
  const extraPins = pinnedMsgs.filter((m) => !histIds.has(m.id) && m.summarized);
  if (extraPins.length) {
    const txt = "PINNED: " + extraPins.map((m) => `${nameOf(m) ?? m.role}: ${clipToTokens(m.content, 80)}`).join(" | ");
    memLines.push(txt);
    push({ id: "pins", group: "memory", title: "Закреплённые сообщения", text: txt, included: true, reason: "закреплены пользователем" });
  }
  blocks.push({ id: "history", group: "history", title: `История: ${hist.length} сообщ. (из ${unsum.length} несжатых)`, text: hist.map((h) => h.text).join("\n---\n"), tokens: histUsed, included: true, reason: cut ? `обрезано ${cut} старых (будут сжаты в блокнот)` : "всё влезло" });

  /* --- итоговый порядок: стабильный префикс → полустабильное → динамика --- */
  const systemMsgs: ChatMessage[] = [];
  const memBlock = memLines.length ? `CHRONICLE (notebook of past events):\n${memLines.join("\n")}` : "";
  const sceneBlock = sceneText;
  const partyBlock = partyTexts.join("\n");
  const stablePart = [sys, worldText, stableRules.join("\n\n"), stableLore.join("\n")].filter(Boolean).join("\n\n");
  if (s.optimize.stablePrefix) {
    systemMsgs.push({ role: "system", content: stablePart, cache: true });
    systemMsgs.push({ role: "system", content: [partyBlock, sceneBlock, dynRules.join("\n\n"), dynLore.join("\n"), memBlock].filter(Boolean).join("\n\n") });
  } else {
    systemMsgs.push({ role: "system", content: [sys, worldText, partyBlock, sceneBlock, stableRules.join("\n\n"), dynRules.join("\n\n"), stableLore.join("\n"), dynLore.join("\n"), memBlock].filter(Boolean).join("\n\n"), cache: true });
  }

  const chat: ChatMessage[] = hist.map((h) => ({ role: h.m.role === "assistant" ? "assistant" : "user", content: h.text }));
  if (!chat.length || chat[chat.length - 1].role !== "user") chat.push({ role: "user", content: a.userText || "Continue." });
  if (notesText) chat[chat.length - 1] = { ...chat[chat.length - 1], content: chat[chat.length - 1].content + "\n\n" + notesText };

  const totalTokens = systemMsgs.reduce((x, y) => x + estimateTokens(y.content), 0) + chat.reduce((x, y) => x + estimateTokens(y.content) + 4, 0);
  for (const g of ["rules", "party", "world", "lore", "memory"] as const) limits[g] = { used: used[g], limit: lim(g) };
  limits.history = { used: used.history, limit: historyBudget };
  limits.system = { used: used.system + used.notes, limit: sysTokens + notesTokens };

  return {
    messages: [...systemMsgs, ...chat],
    blocks,
    totalTokens,
    budget: total,
    limits,
    includedEntityIds: includedIds,
    retrieval: r,
    overflowUnsummarized: cut,
    historyTokens: histUsed,
    historyBudget,
  };
}

/** Упаковка отчёта для хранения/показа (без тяжёлых полей). */
export function reportOf(res: BuildResult) {
  return {
    at: Date.now(),
    totalTokens: res.totalTokens,
    budget: res.budget,
    limits: res.limits,
    blocks: res.blocks.map((b) => ({ id: b.id, group: b.group, title: b.title, tokens: b.tokens, included: b.included, reason: b.reason, text: b.text.length > 1800 ? b.text.slice(0, 1800) + "…" : b.text })),
    messages: res.messages.map((m) => ({ role: m.role, content: m.content.length > 6000 ? m.content.slice(0, 6000) + "…" : m.content })),
  };
}

export { skillLevel };
