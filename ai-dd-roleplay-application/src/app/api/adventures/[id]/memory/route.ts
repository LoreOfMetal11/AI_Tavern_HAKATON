import { db } from "@/db";
import { memories } from "@/db/schema";
import { estimateTokens } from "@/lib/tokens";
import { getSettings, withOverrides } from "@/lib/server/settings";
import { commitCompaction, draftCompaction, mergeNotebook, pendingStats } from "@/lib/server/memory";
import { loadBundle } from "@/lib/server/store";
import { waitLock } from "@/lib/server/turn";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  await waitLock(id);
  const body = (await req.json()) as {
    action: "stats" | "draft" | "commit" | "compact" | "merge" | "add";
    force?: boolean;
    draft?: { content: string; fromTurn: number; toTurn: number; messageIds: number[] };
    content?: string;
    locked?: boolean;
  };
  const b = await loadBundle(id);
  if (!b) return Response.json({ error: "not found" }, { status: 404 });
  const s = withOverrides(await getSettings(), b.adv.overrides);
  try {
    if (body.action === "stats") return Response.json(await pendingStats(id, s));
    if (body.action === "draft") {
      const d = await draftCompaction(id, s, body.force ?? true);
      return Response.json({ draft: d });
    }
    if (body.action === "commit" && body.draft) {
      const row = await commitCompaction(id, body.draft, s);
      await mergeNotebook(id, s);
      return Response.json({ row });
    }
    if (body.action === "compact") {
      const d = await draftCompaction(id, s, true);
      if (!d) return Response.json({ row: null, note: "Пока нечего сжимать: последние ходы остаются нетронутыми." });
      const row = await commitCompaction(id, d, s);
      const merged = await mergeNotebook(id, s);
      return Response.json({ row, merged, usedModel: d.usedModel });
    }
    if (body.action === "merge") return Response.json({ merged: await mergeNotebook(id, s) });
    if (body.action === "add" && body.content?.trim()) {
      const [row] = await db
        .insert(memories)
        .values({ adventureId: id, level: 0, kind: "note", content: body.content.trim(), fromTurn: b.adv.turn, toTurn: b.adv.turn, importance: 0.9, locked: body.locked ?? true, author: "user", tokens: estimateTokens(body.content) })
        .returning();
      return Response.json({ row });
    }
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
  return Response.json({ error: "bad request" }, { status: 400 });
}
