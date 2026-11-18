import { loadBundle } from "@/lib/server/store";
import { getSettings, withOverrides } from "@/lib/server/settings";
import { buildContext, reportOf } from "@/lib/server/context";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** GET — то, что реально ушло в модель в последний раз. */
export async function GET(_req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const b = await loadBundle(id);
  return Response.json(b?.adv.lastContext ?? null);
}

/** POST — предпросмотр: что попадёт в контекст, если игрок отправит этот черновик сейчас. */
export async function POST(req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const { draft, playerIds } = (await req.json()) as { draft?: string; playerIds?: number[] };
  const b = await loadBundle(id);
  if (!b) return Response.json({ error: "not found" }, { status: 404 });
  const s = withOverrides(await getSettings(), b.adv.overrides);
  const res = buildContext({
    settings: s,
    b,
    userText: draft ?? "",
    actingPlayerIds: playerIds ?? [],
    rollTag: s.optimize.checkMode === "gm-tag",
    inlineState: s.optimize.stateMode === "inline",
    turn: b.adv.turn + 1,
  });
  return Response.json({
    ...reportOf(res),
    candidates: {
      triggered: res.retrieval.triggered.map((c) => ({ id: c.id, name: c.name, score: c.score })),
      logic: res.retrieval.logic.map((c) => ({ id: c.id, name: c.name, score: c.score })),
    },
    historyTokens: res.historyTokens,
    historyBudget: res.historyBudget,
    overflow: res.overflowUnsummarized,
  });
}
