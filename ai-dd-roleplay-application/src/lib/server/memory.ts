import { db } from "@/db";
import { memories, messages } from "@/db/schema";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import type { Settings } from "@/lib/config";
import { estimateTokens } from "@/lib/tokens";
import { completeChat } from "./ai";
import { langName } from "./prompts";
import { loadBundle, type Message } from "./store";
import { norm, splitList } from "./context";

const RATIO = { light: 0.45, medium: 0.25, strong: 0.12 } as const;

/** Извлекающее сжатие без нейросети: выбираем самые «нагруженные фактами» предложения в исходном порядке. */
export function extractiveSummary(text: string, targetTokens: number, s: Settings): string {
  const keepWords = [...splitList(s.memory.mustKeep), ...splitList(s.memory.keepDetails), ...s.memory.neverForget]
    .flatMap((x) => norm(x).split(/\s+/))
    .filter((w) => w.length > 3)
    .map((w) => w.slice(0, 5));
  const dropWords = splitList(s.memory.mayDrop).flatMap((x) => norm(x).split(/\s+/)).filter((w) => w.length > 4).map((w) => w.slice(0, 5));
  const sents = text.split(/(?<=[.!?…])\s+|\n+/).map((x) => x.trim()).filter((x) => x.length > 12);
  const scored = sents.map((t, i) => {
    const low = norm(t);
    let sc = 0;
    sc += (t.match(/\d+/g) ?? []).length * 1.5;
    sc += (t.match(/(?<=[\s«"—])[A-ZА-ЯЁ][\p{L}]{2,}/gu) ?? []).length * 0.8;
    sc += /[«"—]/.test(t) ? 0.5 : 0;
    sc += /урон|ранен|убит|умер|смерт|нашёл|нашел|получил|украл|клятв|обещ|золот|зм\b|проклят|dmg|killed|found|oath|gold|cursed/i.test(t) ? 2 : 0;
    for (const w of keepWords) if (low.includes(w)) sc += 1.5;
    for (const w of dropWords) if (low.includes(w)) sc -= 1;
    sc -= Math.max(0, t.length - 220) / 200;
    return { t, i, sc };
  });
  const chosen: typeof scored = [];
  let tok = 0;
  for (const x of [...scored].sort((a, b) => b.sc - a.sc)) {
    const t = estimateTokens(x.t);
    if (tok + t > targetTokens && chosen.length) continue;
    chosen.push(x);
    tok += t;
  }
  return chosen.sort((a, b) => a.i - b.i).map((x) => x.t).join(" ");
}

function memoryPrompt(s: Settings, targetTokens: number) {
  const lang = langName(s.language.internal);
  return `You compress the log of a D&D roleplay into notebook entries for the GM. Write in ${lang}, compact telegraphic style, third person, past tense, about ${targetTokens} tokens at most.
KEEP: ${s.memory.mustKeep}.
KEEP DETAILS: ${s.memory.keepDetails}.
YOU MAY DROP: ${s.memory.mayDrop}.
NEVER LOSE these facts: ${s.memory.neverForget.join("; ") || "(none)"}.
Format: one line per important event; "Name: fact". Note who knows what when it matters (secrets vs public). Keep numbers exact (gold, damage, dates). Do NOT invent. Do not add commentary.`;
}

export interface Draft {
  content: string;
  fromTurn: number;
  toTurn: number;
  messageIds: number[];
  sourceTokens: number;
  usedModel: boolean;
}

async function summarizeText(s: Settings, source: string, sourceTokens: number): Promise<{ text: string; usedModel: boolean }> {
  const target = Math.max(40, Math.round(sourceTokens * RATIO[s.memory.compression]));
  if (s.memory.useModel) {
    try {
      const text = await completeChat(s, {
        task: "memory",
        messages: [
          { role: "system", content: memoryPrompt(s, target) },
          { role: "user", content: source },
        ],
        maxTokens: Math.min(900, target * 2 + 60),
        temperature: 0.2,
        frequencyPenalty: 0,
        presencePenalty: 0,
        timeoutSec: 90,
      });
      if (text.length > 10) return { text: text.trim(), usedModel: true };
    } catch {
      /* падаем в алгоритмический режим */
    }
  }
  return { text: extractiveSummary(source, target, s), usedModel: false };
}

function turnsOf(msgs: Message[]) {
  const m = new Map<number, Message[]>();
  for (const x of msgs) m.set(x.turn, [...(m.get(x.turn) ?? []), x]);
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
}

export function historyBudgetOf(s: Settings) {
  const total = s.context.size - s.context.reserveReply;
  const sum = Object.values(s.context.split).reduce((a, b) => a + b, 0) || 100;
  return Math.floor((total * s.context.split.history) / sum);
}

export async function pendingStats(advId: number, s: Settings) {
  const b = await loadBundle(advId);
  if (!b) return null;
  const unsum = b.messages.filter((m) => !m.summarized);
  const tokens = unsum.reduce((a, m) => a + m.tokens, 0);
  return { tokens, budget: historyBudgetOf(s), messages: unsum.length, shouldCompact: tokens > historyBudgetOf(s) * s.memory.triggerRatio };
}

/** Готовит черновик сжатия самых старых несжатых ходов (кроме последних N). */
export async function draftCompaction(advId: number, s: Settings, force = false): Promise<Draft | null> {
  const b = await loadBundle(advId);
  if (!b) return null;
  const unsum = b.messages.filter((m) => !m.summarized && m.role !== "system");
  const tokens = unsum.reduce((a, m) => a + m.tokens, 0);
  const budget = historyBudgetOf(s);
  if (!force && tokens <= budget * s.memory.triggerRatio) return null;
  const turns = turnsOf(unsum);
  const maxTurn = b.adv.turn;
  const candidates = turns.filter(([t]) => t <= maxTurn - s.memory.keepRecentTurns);
  if (!candidates.length) return null;
  // сколько нужно освободить: до 55% бюджета, но не больше ~2500 токенов за вызов
  let need = Math.max(tokens - budget * 0.55, 200);
  need = Math.min(need, 2500);
  const chosen: Message[] = [];
  let got = 0;
  for (const [, ms] of candidates) {
    chosen.push(...ms);
    got += ms.reduce((a, m) => a + m.tokens, 0);
    if (got >= need) break;
  }
  if (!chosen.length) return null;
  const names = new Map(b.players.map((p) => [p.id, p.name]));
  const source = chosen
    .map((m) => (m.role === "user" ? `[${names.get(m.playerId ?? -1) ?? "Player"}] ${m.content}${(m.meta as { rollText?: string })?.rollText ? ` (${(m.meta as { rollText?: string }).rollText})` : ""}` : `GM: ${m.content}`))
    .join("\n");
  const from = chosen[0].turn;
  const to = chosen[chosen.length - 1].turn;
  const facts = [...new Set(b.memories.filter((m) => m.kind === "fact" && !m.locked && m.author === "ai" && m.fromTurn >= from && m.toTurn <= to).map((m) => m.content))];
  const { text, usedModel } = await summarizeText(s, facts.length ? `${source}\nKEY FACTS NOTED BY SCRIBE: ${facts.join("; ")}` : source, got);
  return {
    content: text,
    fromTurn: chosen[0].turn,
    toTurn: chosen[chosen.length - 1].turn,
    messageIds: chosen.map((m) => m.id),
    sourceTokens: got,
    usedModel,
  };
}

export async function commitCompaction(advId: number, d: { content: string; fromTurn: number; toTurn: number; messageIds: number[] }, s: Settings) {
  const text = d.content.trim();
  if (!text) return null;
  const must = [...splitList(s.memory.mustKeep), ...s.memory.neverForget].flatMap((x) => norm(x).split(/\s+/)).filter((w) => w.length > 4);
  const low = norm(text);
  const hit = must.filter((w) => low.includes(w.slice(0, 5))).length;
  const importance = Math.min(1, 0.4 + hit * 0.05);
  const [row] = await db
    .insert(memories)
    .values({ adventureId: advId, level: 0, kind: "summary", content: text, fromTurn: d.fromTurn, toTurn: d.toTurn, importance, tokens: estimateTokens(text), author: "ai" })
    .returning();
  await db.update(messages).set({ summarized: true }).where(inArray(messages.id, d.messageIds));
  // отдельные «факты писаря» за сжатый период уже вошли в сводку — убираем дубли
  await db.delete(memories).where(and(eq(memories.adventureId, advId), eq(memories.kind, "fact"), eq(memories.author, "ai"), eq(memories.locked, false), gte(memories.fromTurn, d.fromTurn), lte(memories.toTurn, d.toTurn)));
  return row;
}

/** Иерархия: сцены → главы → хроника, когда блокнот разрастается. Закреплённые записи не трогаем. */
export async function mergeNotebook(advId: number, s: Settings) {
  if (!s.memory.mergeChapters) return 0;
  const total = s.context.size - s.context.reserveReply;
  const sum = Object.values(s.context.split).reduce((a, b) => a + b, 0) || 100;
  const memBudget = Math.floor((total * s.context.split.memory) / sum);
  let merged = 0;
  for (let level = 0; level <= 1; level++) {
    const rows = await db.select().from(memories).where(and(eq(memories.adventureId, advId), eq(memories.level, level)));
    const free = rows.filter((m) => !m.locked).sort((a, b) => a.fromTurn - b.fromTurn || a.id - b.id);
    const tok = free.reduce((a, m) => a + m.tokens, 0);
    const limit = memBudget * (level === 0 ? 0.6 : 0.5);
    if (tok <= limit || free.length < 4) continue;
    const take: typeof free = [];
    let t = 0;
    for (const m of free) {
      take.push(m);
      t += m.tokens;
      if (t >= tok * 0.6 && take.length >= 3) break;
    }
    const source = take.map((m) => m.content).join("\n");
    const { text } = await summarizeText(s, source, t);
    if (!text) continue;
    await db.insert(memories).values({
      adventureId: advId,
      level: level + 1,
      kind: "summary",
      content: text,
      fromTurn: take[0].fromTurn,
      toTurn: take[take.length - 1].toTurn,
      importance: Math.max(...take.map((m) => m.importance)),
      tokens: estimateTokens(text),
      author: "ai",
    });
    await db.delete(memories).where(inArray(memories.id, take.map((m) => m.id)));
    merged++;
  }
  return merged;
}

/** Автоматический режим: одно сжатие за вызов (+ слияние блокнота). */
export async function autoCompact(advId: number, s: Settings) {
  if (s.memory.mode !== "auto") return null;
  const d = await draftCompaction(advId, s, false);
  if (!d) return null;
  const row = await commitCompaction(advId, d, s);
  await mergeNotebook(advId, s);
  return row;
}
