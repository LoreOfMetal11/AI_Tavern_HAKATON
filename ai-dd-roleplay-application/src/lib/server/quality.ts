import type { Settings } from "@/lib/config";

export interface Issue {
  kind: "language" | "repetition" | "speaks-for-player" | "meta";
  detail: string;
}

const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/g;
const CJK_LANGS = new Set(["zh", "ja", "ko"]);

export function hasCjk(text: string) {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(text);
}

export function sanitize(text: string, lang: string): string {
  let t = text;
  if (!CJK_LANGS.has(lang)) t = t.replace(CJK, "");
  t = t.replace(/<\/?think>/g, "").replace(/\[\[ROLL[\s\S]*?\]\]/g, "");
  return t.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function shingles(text: string, n = 4): Set<string> {
  const w = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).map((x) => x.slice(0, 6));
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

export function repetitionRatio(text: string, previous: string[]): number {
  const cur = shingles(text);
  if (cur.size < 6) return 0;
  const prev = new Set<string>();
  for (const p of previous) shingles(p).forEach((x) => prev.add(x));
  let hit = 0;
  cur.forEach((x) => {
    if (prev.has(x)) hit++;
  });
  // повтор внутри самого ответа: одинаковые предложения
  const sents = text.split(/(?<=[.!?…])\s+/).map((x) => x.trim().toLowerCase()).filter((x) => x.length > 25);
  const dup = sents.length - new Set(sents).size;
  return Math.max(hit / cur.size, sents.length ? dup / sents.length : 0);
}

export function checkQuality(text: string, s: Settings, ctx: { previous: string[]; playerNames: string[] }): Issue[] {
  const issues: Issue[] = [];
  const lang = s.language.narration;
  const pen = s.penalties;
  if (pen.wrongLanguage) {
    if (!CJK_LANGS.has(lang) && hasCjk(text)) issues.push({ kind: "language", detail: "в ответе иероглифы" });
    const letters = text.match(/\p{L}/gu) ?? [];
    if (letters.length > 40) {
      const latin = letters.filter((c) => /[A-Za-z]/.test(c)).length / letters.length;
      const cyr = letters.filter((c) => /[\u0400-\u04ff]/.test(c)).length / letters.length;
      if ((lang === "ru" || lang === "uk") && latin > 0.22) issues.push({ kind: "language", detail: `много латиницы (${Math.round(latin * 100)}%)` });
      if (lang === "en" && cyr > 0.1) issues.push({ kind: "language", detail: "кириллица в английском тексте" });
    }
  }
  if (pen.repetition) {
    const r = repetitionRatio(text, ctx.previous);
    if (r > pen.repetitionThreshold) issues.push({ kind: "repetition", detail: `повтор ${Math.round(r * 100)}% фраз` });
  }
  if (pen.speakForPlayer) {
    for (const name of ctx.playerNames) {
      if (!name) continue;
      const n = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`(^|\\n)\\s*(\\*\\*)?${n}(\\*\\*)?\\s*[:—-]\\s*[«"“—]`, "iu");
      const re2 = new RegExp(`${n}[^.\\n]{0,24}(говорит|отвечает|шепчет|кричит|думает|решает|произносит|says|replies|thinks|decides)[^.\\n]{0,10}[:,—]\\s*[«"“]`, "iu");
      if (re.test(text) || re2.test(text)) {
        issues.push({ kind: "speaks-for-player", detail: `мастер говорит за ${name}` });
        break;
      }
    }
  }
  if (pen.metaLeak && /as an ai\b|language model|как (языковая )?модель|я (всего лишь )?ии\b|i can(no|')t (continue|create|write)|не могу (продолжить|написать это)/i.test(text)) {
    issues.push({ kind: "meta", detail: "выход из роли / отказ" });
  }
  return issues;
}
