import { db } from "@/db";
import { entities, relations } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import type { Settings } from "@/lib/config";
import { clipToTokens } from "@/lib/tokens";
import { completeChat, jsonTask } from "./ai";
import { norm } from "./context";
import { extractiveSummary } from "./memory";
import { langName } from "./prompts";

export async function fetchUrlText(url: string): Promise<string> {
  if (!/^https?:\/\//i.test(url)) throw new Error("Нужна ссылка http(s)://");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 (Letopisets D&D GM)" } });
    if (!r.ok) throw new Error(`Сайт ответил ${r.status}`);
    const html = await r.text();
    const ct = r.headers.get("content-type") ?? "";
    if (!/html/i.test(ct) && !/<html/i.test(html.slice(0, 500))) return html.slice(0, 300000);
    const body = html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
    return body
      .replace(/<(script|style|nav|footer|header|aside|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, l, t2) => `\n\n${"#".repeat(Number(l))} ${t2.replace(/<[^>]+>/g, "")}\n`)
      .replace(/<(br|\/p|\/li|\/tr|\/div)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n\s*\n+/g, "\n\n")
      .trim()
      .slice(0, 300000);
  } finally {
    clearTimeout(t);
  }
}

const STOP = new Set("this that with from have will your their they them were been into when then than also which what only some such each other more most many very over under about after before while where would could should".split(" "));

function keywordsOf(title: string, body: string): string[] {
  const words = (norm(title + " " + title + " " + body).match(/[\p{L}]{4,}/gu) ?? []).filter((w) => !STOP.has(w));
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
}

export function splitSections(text: string): { title: string; body: string }[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: { title: string; body: string[] }[] = [];
  let cur: { title: string; body: string[] } = { title: "Введение", body: [] };
  for (const line of lines) {
    const h = line.match(/^#{1,4}\s+(.{2,80})$/) ?? line.match(/^((?:Глава|Раздел|Chapter|Part)\s+[\dIVXLC]+[.:]?.{0,60})$/i) ?? (line.length < 60 && /^[A-ZА-ЯЁ0-9 ,.'-]{6,}$/.test(line.trim()) ? [line, line.trim()] : null);
    if (h) {
      if (cur.body.join("").trim()) out.push(cur);
      cur = { title: h[1].trim(), body: [] };
    } else cur.body.push(line);
  }
  if (cur.body.join("").trim()) out.push(cur);
  // слишком длинные разделы режем, слишком короткие склеиваем
  const res: { title: string; body: string }[] = [];
  for (const s of out) {
    const body = s.body.join("\n").trim();
    if (body.length > 5000) {
      const parts = body.match(/[\s\S]{1,4000}(?:\n\n|$)/g) ?? [body];
      parts.forEach((p, i) => res.push({ title: `${s.title} (${i + 1})`, body: p.trim() }));
    } else if (res.length && body.length < 250) res[res.length - 1].body += `\n${s.title}: ${body}`;
    else res.push({ title: s.title, body });
  }
  return res;
}

/** Адаптация книги: «алгоритм» (быстро, без модели) или «нейросеть» (сжатие в телеграфный стиль). */
export async function adaptRulebook(s: Settings, text: string, useModel: boolean, progress?: (n: number, total: number) => void): Promise<string> {
  const sections = splitSections(text).slice(0, 80);
  const outParts: string[] = new Array(sections.length).fill("");
  let idx = 0;
  let done = 0;
  const worker = async () => {
    while (idx < sections.length) {
      const i = idx++;
      const sec = sections[i];
      let body = "";
      if (useModel) {
        try {
          body = await completeChat(s, {
            task: "translator",
            messages: [
              { role: "system", content: `Rewrite this tabletop RPG rules text for an AI game master: ${langName(s.language.internal)}, telegraphic, keep every number, DC, dice, condition and exception; drop flavor and examples. Output only the rewritten text.` },
              { role: "user", content: sec.body.slice(0, 5000) },
            ],
            maxTokens: 700,
            temperature: 0.2,
            timeoutSec: 90,
          });
        } catch {
          body = "";
        }
      }
      if (!body) body = extractiveSummary(sec.body, Math.max(60, Math.round(sec.body.length / 3.5 * 0.4)), s);
      const kw = keywordsOf(sec.title, sec.body);
      outParts[i] = `## ${sec.title} | kw: ${kw.join(", ")}\n${clipToTokens(body.trim(), 600)}`;
      progress?.(++done, sections.length);
    }
  };
  await Promise.all(Array.from({ length: useModel ? 3 : 1 }, worker));
  return outParts.filter(Boolean).join("\n\n");
}

interface Extracted {
  entities?: { name: string; type?: string; description?: string; compact?: string; triggers?: string; secrets?: string; knowledge?: string; status?: string; parent?: string }[];
  relations?: { from: string; to: string; label: string }[];
}

/** Глубокий разбор текста в базу знаний: персонажи, локации, фракции, квесты, слухи, связи. */
export async function analyzeIntoEntities(s: Settings, text: string, target: { worldId: number | null; adventureId: number | null }, deep: boolean) {
  const size = deep ? 2200 : 4200;
  const chunks: string[] = [];
  for (let i = 0; i < text.length && chunks.length < (deep ? 40 : 20); i += size - 200) chunks.push(text.slice(i, i + size));
  const merged = new Map<string, NonNullable<Extracted["entities"]>[number]>();
  const rels: NonNullable<Extracted["relations"]> = [];
  const sys = `You analyse setting/lore text for a D&D game master and extract database cards. Return ONLY JSON:
{"entities":[{"name":"","type":"character|location|faction|quest|rumor","description":"2-4 sentences in ${langName(s.language.narration)}","compact":"telegraphic summary in ${langName(s.language.internal)}","triggers":"comma separated keywords incl. aliases","secrets":"hidden truths known only to the GM","knowledge":"what a character knows","status":"","parent":"parent location name or empty"}],"relations":[{"from":"","to":"","label":"short relation in ${langName(s.language.narration)}"}]}
Rules: only entities that really appear; no invention; ${deep ? "extract minor named NPCs, rumors, secrets and relations too" : "main entities only"}; keep names exactly as in text.`;
  let idx = 0;
  const worker = async () => {
    while (idx < chunks.length) {
      const c = chunks[idx++];
      const out = await jsonTask<Extracted>(s, "scribe", [{ role: "system", content: sys }, { role: "user", content: c }], 1400).catch(() => null);
      for (const e of out?.entities ?? []) {
        if (!e?.name) continue;
        const k = norm(e.name);
        const ex = merged.get(k);
        if (!ex) merged.set(k, e);
        else {
          ex.description = ((ex.description ?? "") + " " + (e.description ?? "")).trim().slice(0, 900);
          ex.compact = ((ex.compact ?? "") + " " + (e.compact ?? "")).trim().slice(0, 700);
          ex.secrets = ((ex.secrets ?? "") + " " + (e.secrets ?? "")).trim().slice(0, 500);
          ex.triggers = [ex.triggers, e.triggers].filter(Boolean).join(", ");
        }
      }
      rels.push(...(out?.relations ?? []));
    }
  };
  await Promise.all(Array.from({ length: 2 }, worker));

  const cond = target.adventureId ? eq(entities.adventureId, target.adventureId) : and(eq(entities.worldId, target.worldId ?? -1), isNull(entities.adventureId));
  const existing = await db.select().from(entities).where(cond);
  const ids = new Map(existing.map((e) => [norm(e.name), e.id]));
  let created = 0;
  for (const e of merged.values()) {
    if (ids.has(norm(e.name))) continue;
    const type = ["character", "location", "faction", "quest", "rumor", "item", "event"].includes(e.type ?? "") ? e.type! : "character";
    const [row] = await db
      .insert(entities)
      .values({
        worldId: target.worldId,
        adventureId: target.adventureId,
        type,
        name: e.name.trim(),
        triggers: e.triggers || e.name,
        mode: type === "quest" ? "always" : "trigger",
        description: e.description ?? "",
        compact: e.compact || e.description || "",
        secrets: e.secrets ?? "",
        knowledge: e.knowledge ?? "",
        status: e.status ?? "",
      })
      .returning();
    ids.set(norm(e.name), row.id);
    created++;
  }
  for (const e of merged.values()) {
    if (e.parent && ids.get(norm(e.parent)) && ids.get(norm(e.name))) await db.update(entities).set({ parentId: ids.get(norm(e.parent))! }).where(eq(entities.id, ids.get(norm(e.name))!));
  }
  let relCount = 0;
  for (const r of rels) {
    const f = ids.get(norm(r.from ?? ""));
    const t = ids.get(norm(r.to ?? ""));
    if (f && t && f !== t && r.label) {
      await db.insert(relations).values({ worldId: target.worldId, adventureId: target.adventureId, fromId: f, toId: t, label: r.label });
      relCount++;
    }
  }
  return { created, relations: relCount, chunks: chunks.length };
}

export async function parseCharacter(s: Settings, text: string) {
  return jsonTask<Record<string, unknown>>(
    s,
    "scribe",
    [
      {
        role: "system",
        content: `Extract a D&D 5e player character from the text. Return ONLY JSON: {"name":"","race":"","className":"","subclass":"","level":1,"background":"","alignment":"","abilities":{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10},"hp":10,"maxHp":10,"ac":10,"gold":0,"inventory":[{"name":"","qty":1,"desc":""}],"features":"","backstory":"","personality":"","appearance":""}. Texts in ${langName(s.language.narration)}. Use sensible defaults for missing data; never exceed ability 20.`,
      },
      { role: "user", content: text.slice(0, 6000) },
    ],
    900,
  );
}
