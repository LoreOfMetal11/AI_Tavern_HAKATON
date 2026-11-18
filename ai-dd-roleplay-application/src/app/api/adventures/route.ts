import { db } from "@/db";
import { adventures, library, messages, players, worlds } from "@/db/schema";
import { desc, eq, inArray, and, isNull } from "drizzle-orm";
import { cloneWorldIntoAdventure, ensureSeed } from "@/lib/server/seed";
import { estimateTokens } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  const rows = await db.select().from(adventures).orderBy(desc(adventures.updatedAt));
  const ws = await db.select().from(worlds);
  const pls = await db.select({ id: players.id, advId: players.adventureId, name: players.name }).from(players);
  return Response.json(
    rows.map((a) => ({
      id: a.id,
      name: a.name,
      edition: a.edition,
      turn: a.turn,
      updatedAt: a.updatedAt,
      world: ws.find((w) => w.id === a.worldId)?.name ?? "—",
      players: pls.filter((p) => p.advId === a.id).map((p) => p.name),
    })),
  );
}

export async function POST(req: Request) {
  await ensureSeed();
  const b = (await req.json()) as {
    name: string;
    worldId?: number | null;
    edition?: string;
    premise?: string;
    opening?: string;
    rulebookIds?: number[];
    chatStyle?: string;
    playerTemplateIds?: number[];
  };
  let rulebookIds = b.rulebookIds;
  if (!rulebookIds?.length) {
    const books = await db.select().from(library).where(and(eq(library.kind, "rulebook"), eq(library.builtin, true)));
    const ed = b.edition === "2024" ? "2024" : "2014";
    rulebookIds = books.filter((x) => x.edition === ed).map((x) => x.id);
  }
  // завязка берётся из встроенного сюжета мира, если пользователь не задал свою
  let premise = b.premise ?? "";
  let opening = b.opening ?? "";
  if (b.worldId && (!premise || !opening)) {
    const [w] = await db.select().from(worlds).where(eq(worlds.id, b.worldId));
    if (w) {
      const [plot] = await db.select().from(library).where(and(eq(library.kind, "plot"), eq(library.source, w.name)));
      if (plot) {
        const [p, o] = plot.content.split("\n\n");
        premise = premise || p || "";
        opening = opening || o || "";
      }
    }
  }
  const [adv] = await db
    .insert(adventures)
    .values({ name: b.name || "Новое приключение", worldId: b.worldId ?? null, edition: b.edition ?? "2014", premise, premiseCompact: "", opening, rulebookIds, chatStyle: b.chatStyle ?? "narrative", scene: {} })
    .returning();
  if (b.worldId) await cloneWorldIntoAdventure(b.worldId, adv.id);
  if (b.playerTemplateIds?.length) {
    const tpl = await db.select().from(players).where(inArray(players.id, b.playerTemplateIds));
    let i = 0;
    for (const t of tpl) {
      const { id, createdAt, updatedAt, adventureId, ...rest } = t;
      void id; void createdAt; void updatedAt; void adventureId;
      await db.insert(players).values({ ...rest, adventureId: adv.id, sortOrder: i++ });
    }
  }
  if (opening) {
    await db.insert(messages).values({ adventureId: adv.id, turn: 0, role: "assistant", content: opening, tokens: estimateTokens(opening), meta: { opening: true } });
  }
  void isNull;
  return Response.json({ id: adv.id });
}
