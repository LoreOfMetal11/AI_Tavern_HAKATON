import { db } from "@/db";
import { adventures, entities, messages } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { Settings } from "@/lib/config";
import { estimateTokens, clipToTokens } from "@/lib/tokens";
import { extractJson, jsonTask, streamChat, type ChatMessage } from "./ai";
import { applyChanges, invalidateMemories, revertMessageChanges, type StateChanges } from "./apply";
import { buildContext, renderPlayer, reportOf, retrieve, type Decision, type Retrieval, type RollResultInfo } from "./context";
import { craftImagePrompt, generateImage } from "./media";
import { autoCompact, pendingStats } from "./memory";
import { langName, scribePrompt } from "./prompts";
import { checkQuality, hasCjk, sanitize } from "./quality";
import { makeCheck, resolveCheck, type Check, type RawCheck, type RollOutcome } from "./roll";
import { getSettings, withOverrides } from "./settings";
import { loadBundle, type Bundle, type Scene } from "./store";
import { translateBatch } from "./translate";

export type Emit = (e: Record<string, unknown>) => void;
export type Stage = "start" | "resume" | "regenerate";

export interface Pending {
  turn: number;
  check: Check;
  roll?: RollOutcome;
}

/* ---- блокировка по приключению: фоновые задачи прошлого хода не пересекаются со следующим ---- */
const locks = new Map<number, Promise<unknown>>();
export function waitLock(id: number) {
  return (locks.get(id) ?? Promise.resolve()).catch(() => undefined);
}
function runLocked(id: number, fn: () => Promise<void>) {
  const next = waitLock(id).then(fn);
  locks.set(id, next);
  next.catch(() => undefined).finally(() => {
    if (locks.get(id) === next) locks.delete(id);
  });
  return next;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CJK_LANGS = new Set(["zh", "ja", "ko"]);

/* ---------- режиссёр (режим размышления) ---------- */
interface DirectorOut {
  pull?: number[];
  skip?: number[];
  check?: RawCheck | null;
  plan?: string;
  issues?: string[];
}

async function runDirector(s: Settings, b: Bundle, userText: string, r: Retrieval, actingIds: number[]): Promise<(Decision & { check?: RawCheck | null }) | null> {
  const t = s.thinking;
  const cands = [...r.triggered, ...r.logic].slice(0, t.candidateLimit);
  const others = b.entities
    .filter((e) => e.mode !== "off" && e.mode !== "always" && !cands.some((c) => c.id === e.id))
    .slice(0, t.candidateLimit);
  const lastGm = [...b.messages].reverse().find((m) => m.role === "assistant")?.content ?? "";
  const fields: string[] = [`"pull":[ids of candidate cards the GM really needs now]`, `"skip":[ids of candidates NOT relevant in this scene]`];
  if (s.optimize.checkMode === "director") fields.push(`"check":null or {"p":"PC name","t":"skill|ability|save|attack","s":"key","dc":15,"adv":0,"dmg":"","ac":0,"why":""}`);
  if (t.plan) fields.push(`"plan":"1-3 sentences: what should happen next, a fresh angle, a consequence or complication${t.depth === "deep" ? ", foreshadowing, NPC motives" : ""}"`);
  if (t.checkLogic || t.validateInput) fields.push(`"issues":["short warnings: impossible or illogical player actions, items not owned, contradictions with cards/chronicle, a PC being spoken for"]`);
  const sys = `You are the GM's hidden director (thinking assistant) for a D&D 5e game. Study the player's input and the situation, then return ONLY JSON: {${fields.join(",")}}.
${t.checkTriggers ? "Triggered cards were matched by keywords: read their briefs and drop the ones that are irrelevant (skip)." : "Keep all triggered cards."}
Creativity level ${Math.round(t.creativity * 10)}/10: ${t.creativity > 0.6 ? "propose bold but world-consistent developments" : "stay conservative and consistent"}.
${t.extraInstructions}`;
  const party = b.players.map((p) => renderPlayer(p, 2, s)).join("\n");
  const user = `SCENE: ${JSON.stringify({ location: b.scene.location, time: b.scene.time, combat: b.scene.combat, enemies: b.scene.enemies?.map((e) => `${e.name} ${e.hp}/${e.maxHp}`) })}
PARTY:\n${party}
LAST GM REPLY: ${clipToTokens(lastGm, 220)}
PLAYER INPUT (${actingIds.map((id) => b.players.find((p) => p.id === id)?.name).join(", ")}): ${userText}
CANDIDATES:\n${cands.map((c) => `${c.id}|${c.name}|${c.type}|${c.why}|${c.brief}`).join("\n") || "(none)"}
OTHER CARDS (pull only if clearly needed):\n${others.map((e) => `${e.id}|${e.name}|${e.type}`).join("\n") || "(none)"}`;
  const out = await jsonTask<DirectorOut>(s, "director", [{ role: "system", content: sys }, { role: "user", content: user }], t.maxTokens);
  if (!out) return null;
  const ids = new Set(b.entities.map((e) => e.id));
  return {
    include: (out.pull ?? []).map(Number).filter((x) => ids.has(x)),
    exclude: t.checkTriggers ? (out.skip ?? []).map(Number).filter((x) => ids.has(x)) : [],
    plan: out.plan,
    notes: (out.issues ?? []).slice(0, 4),
    check: out.check ?? null,
  };
}

/* ---------- один проход генерации ---------- */
type PassResult = { kind: "text"; raw: string; visible: string; state: StateChanges | null } | { kind: "roll"; check: RawCheck };

async function streamPass(
  s: Settings,
  msgs: ChatMessage[],
  o: { rollTag: boolean; inlineState: boolean; emit: Emit; signal?: AbortSignal; boost: number; waitMin: () => Promise<void> },
): Promise<PassResult> {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  o.signal?.addEventListener("abort", onAbort);
  let buf = "";
  let emitted = 0;
  let mode: "undecided" | "tag" | "text" = o.rollTag ? "undecided" : "text";
  let found: RawCheck | null = null;
  const stripCjk = !CJK_LANGS.has(s.language.narration);
  let first = true;
  try {
    for await (const chunk of streamChat(s, {
      task: "gm",
      messages: msgs,
      signal: ctrl.signal,
      frequencyPenalty: Math.min(1.6, s.gen.frequencyPenalty + o.boost),
      presencePenalty: Math.min(1.6, s.gen.presencePenalty + o.boost),
      temperature: Math.min(1.3, s.gen.temperature + o.boost / 3),
    })) {
      buf += chunk;
      if (mode === "undecided") {
        const t = buf.trimStart();
        if (t.length < 2) continue;
        mode = t.startsWith("[[") ? "tag" : "text";
      }
      if (mode === "tag") {
        const m = buf.match(/\[\[ROLL\s*(\{[\s\S]*?\})\s*\]\]/);
        const m2 = !m ? buf.match(/\[\[ROLL\s*(\{[\s\S]*\})/) : null; // стоп-последовательность могла съесть «]]»
        const src = m ?? m2;
        if (src) {
          const j = extractJson<RawCheck>(src[1]);
          if (j) {
            found = j;
            ctrl.abort();
            break;
          }
        }
        if (buf.length < 600 && !/\]\]/.test(buf)) continue;
        mode = "text";
      }
      let vis = buf.replace(/\[\[ROLL[\s\S]*?\]\]/g, "");
      if (stripCjk) vis = vis.replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/g, "");
      const si = vis.indexOf("<state");
      if (si >= 0) vis = vis.slice(0, si);
      else {
        const tail = vis.lastIndexOf("<");
        if (tail >= 0 && vis.length - tail < 7 && "<state>".startsWith(vis.slice(tail))) vis = vis.slice(0, tail);
      }
      if (vis.length > emitted) {
        if (first) {
          await o.waitMin();
          first = false;
        }
        o.emit({ type: "token", text: vis.slice(emitted) });
        emitted = vis.length;
      }
    }
  } catch (e) {
    if (!found) throw e;
  } finally {
    o.signal?.removeEventListener("abort", onAbort);
  }
  if (found) return { kind: "roll", check: found };
  let state: StateChanges | null = null;
  const sm = buf.match(/<state>([\s\S]*?)(<\/state>|$)/);
  if (sm) state = extractJson<StateChanges>(sm[1]);
  const visible = buf.replace(/<state>[\s\S]*$/, "");
  return { kind: "text", raw: buf, visible, state };
}

/* ---------- основной конвейер ---------- */
export async function runTurn(advId: number, stage: Stage, emit: Emit, signal?: AbortSignal) {
  await waitLock(advId);
  let b = await loadBundle(advId);
  if (!b) throw new Error("Приключение не найдено");
  const s = withOverrides(await getSettings(), b.adv.overrides);
  const turn = b.adv.turn;
  const t0 = Date.now();
  const waitMin = async () => {
    const left = s.delay.minResponseMs - (Date.now() - t0);
    if (left > 0) await sleep(left);
  };

  if (stage === "regenerate") {
    const olds = b.messages.filter((m) => m.role === "assistant" && m.turn === turn);
    for (const m of olds) {
      await revertMessageChanges(advId, m.id);
      await db.update(messages).set({ status: "superseded" }).where(eq(messages.id, m.id));
    }
    await invalidateMemories(advId, turn);
    b = (await loadBundle(advId))!;
  }

  const userMsgs = b.messages.filter((m) => m.role === "user" && m.turn === turn);
  if (!userMsgs.length) throw new Error("Сначала напишите действие персонажа.");
  const lastUser = userMsgs[userMsgs.length - 1];
  const userText = userMsgs.map((m) => m.content).join("\n");
  const acting = [...new Set(userMsgs.map((m) => m.playerId).filter((x): x is number => typeof x === "number"))];
  const actingPlayers = acting.map((id) => b!.players.find((p) => p.id === id)!).filter(Boolean);

  /* --- бросок: ожидающий / уже сделанный --- */
  let roll: RollResultInfo | null = null;
  const pending = b.adv.pending as Pending | null;
  const lastMeta = (lastUser.meta ?? {}) as { roll?: RollOutcome };
  if (stage === "resume" && pending?.roll && pending.turn === turn) {
    const o = pending.roll;
    await db.update(messages).set({ meta: { ...lastMeta, roll: o, rollText: o.short } }).where(eq(messages.id, lastUser.id));
    await db.update(adventures).set({ pending: null }).where(eq(adventures.id, advId));
    roll = { playerId: o.check.playerId, playerName: o.check.playerName, text: o.text };
    lastUser.meta = { ...lastMeta, roll: o, rollText: o.short };
  } else if (lastMeta.roll) {
    roll = { playerId: lastMeta.roll.check.playerId, playerName: lastMeta.roll.check.playerName, text: lastMeta.roll.text };
  } else if (pending) {
    await db.update(adventures).set({ pending: null }).where(eq(adventures.id, advId));
  }

  /* --- поиск карточек + режиссёр --- */
  emit({ type: "status", text: "Собираю контекст…" });
  const retrieval = retrieve(s, b, userText, turn);
  let decision: (Decision & { check?: RawCheck | null }) | null = null;
  if (s.thinking.enabled) {
    emit({ type: "status", text: "Режиссёр обдумывает ход…" });
    decision = await runDirector(s, b, userText, retrieval, acting).catch(() => null);
  }

  const requestRoll = async (raw: RawCheck): Promise<boolean> => {
    const check = makeCheck(raw, actingPlayers, b!.players);
    if (!check) return false;
    if (s.dice.autoRoll) {
      const out = resolveCheck(check);
      emit({ type: "roll", outcome: out, auto: true });
      await db.update(messages).set({ meta: { ...((lastUser.meta ?? {}) as object), roll: out, rollText: out.short } }).where(eq(messages.id, lastUser.id));
      roll = { playerId: check.playerId, playerName: check.playerName, text: out.text };
      return false; // продолжаем генерацию
    }
    const p: Pending = { turn, check };
    await db.update(adventures).set({ pending: p }).where(eq(adventures.id, advId));
    emit({ type: "roll_request", check });
    return true;
  };

  if (!roll && decision?.check && s.optimize.checkMode === "director") {
    if (await requestRoll(decision.check)) return;
  }

  /* --- генерация с контролем качества --- */
  const useTag = s.optimize.checkMode === "gm-tag";
  const inline = s.optimize.stateMode === "inline";
  const mk = () =>
    buildContext({ settings: s, b: b!, userText, actingPlayerIds: acting, roll, decision, retrieval, rollTag: useTag && !roll, inlineState: inline, turn });
  let built = mk();
  await db.update(adventures).set({ lastContext: reportOf(built) }).where(eq(adventures.id, advId));
  emit({ type: "context", tokens: built.totalTokens, budget: built.budget, included: built.includedEntityIds.length });
  emit({ type: "status", text: "Мастер пишет…" });

  const prevGm = b.messages.filter((m) => m.role === "assistant").slice(-3).map((m) => m.content);
  const playerNames = b.players.map((p) => p.name);
  let attempt = 0;
  let boost = 0;
  let note = "";
  let result: Extract<PassResult, { kind: "text" }> | null = null;
  let issues: { kind: string; detail: string }[] = [];

  for (let guard = 0; guard < 6; guard++) {
    if (signal?.aborted) return;
    const msgs = built.messages.map((m) => ({ ...m }));
    if (note) msgs[msgs.length - 1].content += note;
    const pass = await streamPass(s, msgs, { rollTag: useTag && !roll, inlineState: inline, emit, signal, boost, waitMin });
    if (pass.kind === "roll") {
      if (await requestRoll(pass.check)) return;
      built = mk(); // автоброска: пересобираем с результатом
      await db.update(adventures).set({ lastContext: reportOf(built) }).where(eq(adventures.id, advId));
      continue;
    }
    const clean = sanitize(pass.visible, s.language.narration);
    issues = checkQuality(pass.raw.replace(/<state>[\s\S]*$/, ""), s, { previous: prevGm, playerNames });
    if (!clean.trim()) issues.push({ kind: "meta", detail: "пустой ответ" });
    if (issues.length && attempt < s.penalties.autoRetry && !signal?.aborted) {
      attempt++;
      boost += s.penalties.retryPenaltyBoost;
      note = `\n\n[Correction: the previous attempt was rejected (${issues.map((i) => i.detail).join("; ")}). Rewrite the reply fully in ${langName(s.language.narration)}, with fresh wording, never speak for the player characters, no foreign-language words.]`;
      emit({ type: "reset", reason: issues.map((i) => i.detail).join("; ") });
      emit({ type: "status", text: `Штраф: ${issues.map((i) => i.detail).join("; ")}. Переписываю…` });
      continue;
    }
    result = { ...pass, visible: clean };
    break;
  }
  if (!result) throw new Error("Не удалось получить ответ мастера");
  if (signal?.aborted) return;

  /* --- сохранение ответа --- */
  const finalText = result.visible;
  const [saved] = await db
    .insert(messages)
    .values({
      adventureId: advId,
      turn,
      role: "assistant",
      content: finalText,
      tokens: estimateTokens(finalText),
      meta: { issues, retries: attempt, ctxTokens: built.totalTokens, plan: decision?.plan ?? null, ms: Date.now() - t0 },
    })
    .returning();
  emit({ type: "replace", text: finalText });
  emit({ type: "done", message: saved });

  /* --- фоновые задачи: писарь, карточки, память, картинка (не блокируют чтение ответа) --- */
  const bundle = b;
  const stateInline = result.state;
  await runLocked(advId, async () => {
    try {
      let changes: StateChanges | null = null;
      if (s.optimize.stateMode === "inline") changes = stateInline;
      else if (s.optimize.stateMode === "separate") {
        emit({ type: "status", text: "Писарь обновляет карточки…" });
        changes = await scribe(s, bundle, userText, finalText, acting).catch(() => null);
      }
      const fresh = (await loadBundle(advId))!;
      if (changes && Object.keys(changes).length) {
        const res = await applyChanges(fresh, saved.id, turn, changes);
        if (res.summaries.length) emit({ type: "changes", items: res.summaries });
        if (res.changedEntityIds.length && s.language.translateView && s.language.internal !== s.language.narration) {
          await refreshViewText(s, res.changedEntityIds).catch(() => undefined);
        }
        if (res.image && s.media.image.enabled && s.media.image.auto) {
          emit({ type: "status", text: "Рисую иллюстрацию…" });
          try {
            const prompt = await craftImagePrompt(s, res.image.prompt, res.image.kind);
            const url = await generateImage(s, prompt);
            await db.update(messages).set({ meta: { ...(saved.meta as object), issues, images: [{ url, kind: res.image.kind, prompt }] } }).where(eq(messages.id, saved.id));
            emit({ type: "image", url, messageId: saved.id });
          } catch (e) {
            emit({ type: "warn", text: "Картинка не создана: " + (e instanceof Error ? e.message : String(e)) });
          }
        }
      }
      // липкость карточек + актуальная сцена
      const f2 = (await loadBundle(advId))!;
      const sc: Scene = { ...f2.scene, sticky: { ...(f2.scene.sticky ?? {}) } };
      for (const id of built.includedEntityIds) sc.sticky![String(id)] = turn;
      for (const [k, v] of Object.entries(sc.sticky!)) if (turn - v > s.optimize.stickyTurns + 2) delete sc.sticky![k];
      await db.update(adventures).set({ scene: sc, updatedAt: new Date() }).where(eq(adventures.id, advId));

      if (s.memory.mode === "auto") {
        const st = await pendingStats(advId, s);
        if (st?.shouldCompact) {
          emit({ type: "status", text: "Сжимаю историю в блокнот…" });
          const row = await autoCompact(advId, s);
          if (row) emit({ type: "memory", text: `В блокнот добавлена запись (ходы ${row.fromTurn}–${row.toTurn})` });
        }
      } else if (s.memory.mode === "assisted") {
        const st = await pendingStats(advId, s);
        if (st?.shouldCompact) emit({ type: "memory_suggest", tokens: st.tokens, budget: st.budget });
      }
    } catch (e) {
      emit({ type: "warn", text: "Фоновая задача: " + (e instanceof Error ? e.message : String(e)) });
    }
    emit({ type: "end" });
  });
}

/* ---------- писарь ---------- */
async function scribe(s: Settings, b: Bundle, userText: string, gm: string, acting: number[]): Promise<StateChanges | null> {
  const pcs = b.players.map((p) => `${p.name}: HP ${p.hp}/${p.maxHp}; items: ${((p.inventory ?? []) as { name: string; qty?: number }[]).map((i) => `${i.name}${(i.qty ?? 1) > 1 ? " x" + i.qty : ""}`).join(", ") || "-"}; cond: ${((p.conditions ?? []) as string[]).join(",") || "-"}`).join("\n");
  const ents = b.entities.filter((e) => e.mode !== "off").slice(0, 80).map((e) => `${e.name} [${e.type}]${e.status ? ` (${e.status})` : ""}`).join("; ");
  const enemies = (b.scene.enemies ?? []).map((e) => `${e.name} ${e.hp}/${e.maxHp}`).join("; ");
  const who = acting.map((id) => b.players.find((p) => p.id === id)?.name).filter(Boolean).join(", ");
  const user = `PCs:\n${pcs}\nKnown cards: ${ents || "-"}\nEnemies now: ${enemies || "-"}\nScene: ${b.scene.location ?? "?"}${b.scene.combat ? " (combat)" : ""}\n\nPLAYER (${who}): ${clipToTokens(userText, 300)}\nGM REPLY: ${clipToTokens(gm, 700)}`;
  return jsonTask<StateChanges>(s, "scribe", [{ role: "system", content: scribePrompt(langName(s.language.internal)) }, { role: "user", content: user }], 700);
}

/** Пользователь видит всё на родном языке: после правок ИИ переводим compact → description. */
async function refreshViewText(s: Settings, ids: number[]) {
  const rows = await db.select().from(entities);
  const list = rows.filter((e) => ids.includes(e.id) && e.compact.trim());
  if (!list.length) return;
  const tr = await translateBatch(s, list.map((e) => e.compact), s.language.narration);
  if (!tr) return;
  for (let i = 0; i < list.length; i++) {
    if (tr[i].trim()) await db.update(entities).set({ description: tr[i] }).where(and(eq(entities.id, list[i].id)));
  }
}

export { hasCjk };
