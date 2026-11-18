import { getSettings } from "@/lib/server/settings";
import { craftImagePrompt, generateImage, synthesizeSpeech } from "@/lib/server/media";
import { translateBatch } from "@/lib/server/translate";
import { analyzeAction } from "@/lib/dnd/validate";
import { loadBundle } from "@/lib/server/store";
import { rollExpr } from "@/lib/dice";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body =
  | { op: "image"; prompt: string; kind?: string; craft?: boolean }
  | { op: "tts"; text: string }
  | { op: "translate"; texts: string[]; to: string; compress?: boolean }
  | { op: "analyze"; adventureId: number; playerId: number; text: string }
  | { op: "dice"; expr: string };

/** Универсальные утилиты: картинки, озвучка, перевод, проверка ввода, свободные кубики. */
export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  try {
    const s = await getSettings();
    if (body.op === "dice") {
      const r = rollExpr(body.expr);
      return Response.json(r);
    }
    if (body.op === "analyze") {
      const b = await loadBundle(body.adventureId);
      const p = b?.players.find((x) => x.id === body.playerId);
      if (!p) return Response.json({ notes: [], suggested: null });
      return Response.json(analyzeAction(body.text, p));
    }
    if (body.op === "image") {
      if (!s.media.image.enabled) return Response.json({ error: "Генерация изображений выключена в настройках" }, { status: 400 });
      const prompt = body.craft === false ? `${body.prompt}, ${s.media.image.style}` : await craftImagePrompt(s, body.prompt, body.kind ?? "illustration");
      const url = await generateImage(s, prompt);
      return Response.json({ url, prompt });
    }
    if (body.op === "tts") {
      const { buf, mime } = await synthesizeSpeech(s, body.text);
      return new Response(new Uint8Array(buf), { headers: { "Content-Type": mime } });
    }
    if (body.op === "translate") {
      const items = await translateBatch(s, body.texts, body.to, { compress: body.compress });
      if (!items) return Response.json({ error: "Перевод не удался" }, { status: 502 });
      return Response.json({ items });
    }
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
  return Response.json({ error: "bad request" }, { status: 400 });
}
