import { db } from "@/db";
import { library } from "@/db/schema";
import { getSettings } from "@/lib/server/settings";
import { adaptRulebook, analyzeIntoEntities, fetchUrlText, parseCharacter } from "@/lib/server/importer";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

interface Body {
  mode: "rulebook" | "lore" | "library" | "character";
  title?: string;
  text?: string;
  url?: string;
  kind?: string; // для library: world | character | plot | note
  edition?: string;
  adapt?: "algo" | "ai";
  adventureId?: number | null;
  worldId?: number | null;
  deep?: boolean;
}

export async function POST(req: Request) {
  const b = (await req.json()) as Body;
  try {
    const s = await getSettings();
    let text = b.text ?? "";
    if (b.url) text = (await fetchUrlText(b.url)) + (text ? "\n\n" + text : "");
    if (!text.trim()) return Response.json({ error: "Нет текста для загрузки" }, { status: 400 });

    if (b.mode === "rulebook") {
      const compact = await adaptRulebook(s, text, b.adapt === "ai");
      const [row] = await db
        .insert(library)
        .values({ kind: "rulebook", title: b.title || "Книга правил", source: b.url ?? "файл", edition: b.edition ?? "", content: text.slice(0, 400000), compact })
        .returning();
      return Response.json({ id: row.id, sections: compact.split("\n## ").length, chars: text.length, compactChars: compact.length });
    }
    if (b.mode === "lore") {
      const r = await analyzeIntoEntities(s, text, { worldId: b.worldId ?? null, adventureId: b.adventureId ?? null }, b.deep ?? false);
      return Response.json(r);
    }
    if (b.mode === "character") {
      const card = await parseCharacter(s, text);
      if (!card) return Response.json({ error: "Не удалось разобрать персонажа: проверьте модель" }, { status: 422 });
      return Response.json({ card });
    }
    const [row] = await db
      .insert(library)
      .values({ kind: b.kind ?? "note", title: b.title || "Без названия", source: b.url ?? "файл", content: text.slice(0, 400000), compact: "" })
      .returning();
    return Response.json({ id: row.id });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
