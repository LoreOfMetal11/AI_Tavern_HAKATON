import type { Settings } from "@/lib/config";
import { jsonTask } from "./ai";
import { langName } from "./prompts";

/** Пакетный перевод: один запрос на много текстов — меньше задержек и токенов. */
export async function translateBatch(s: Settings, texts: string[], to: string, opts: { compress?: boolean } = {}): Promise<string[] | null> {
  const clean = texts.map((t) => t ?? "");
  if (!clean.some((t) => t.trim())) return clean;
  const instr = opts.compress
    ? `Translate each text into ${langName(to)} AND rewrite it compactly (telegraphic, no filler, keep every name, number, secret and relation).`
    : `Translate each text into ${langName(to)} faithfully, keep names and numbers.`;
  const res = await jsonTask<{ items?: string[] }>(
    s,
    "translator",
    [
      { role: "system", content: `${instr} Return ONLY JSON: {"items":["..."]} with exactly ${clean.length} strings in the same order. Empty input stays empty.` },
      { role: "user", content: JSON.stringify(clean) },
    ],
    Math.min(3000, 200 + clean.reduce((a, t) => a + t.length, 0)),
  );
  if (!res?.items || res.items.length !== clean.length) return null;
  return res.items.map((x) => String(x ?? ""));
}
