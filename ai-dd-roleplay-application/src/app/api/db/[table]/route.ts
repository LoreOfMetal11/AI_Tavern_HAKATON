/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/db";
import { entities, library, memories, players, relations, worlds } from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { ensureSeed } from "@/lib/server/seed";
import { estimateTokens } from "@/lib/tokens";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ table: string }> };

const TABLES: Record<string, any> = { entities, players, relations, worlds, library, memories };

function clean(body: Record<string, any>) {
  const { id, createdAt, updatedAt, ...rest } = body;
  void id; void createdAt; void updatedAt;
  return rest;
}

export async function GET(req: Request, { params }: Ctx) {
  const name = (await params).table;
  const t = TABLES[name];
  if (!t) return Response.json({ error: "unknown table" }, { status: 404 });
  if (name === "library" || name === "worlds") await ensureSeed();
  const u = new URL(req.url);
  const conds: any[] = [];
  const adv = u.searchParams.get("adventureId");
  const world = u.searchParams.get("worldId");
  const kind = u.searchParams.get("kind");
  if (adv && t.adventureId) conds.push(eq(t.adventureId, Number(adv)));
  if (world && t.worldId) {
    conds.push(eq(t.worldId, Number(world)));
    if (!adv && t.adventureId) conds.push(isNull(t.adventureId)); // канон мира
  }
  if (u.searchParams.get("templates") && t.adventureId) conds.push(isNull(t.adventureId));
  if (kind && t.kind) conds.push(eq(t.kind, kind));
  const q: any = db.select().from(t);
  const rows: any[] = await (conds.length ? q.where(and(...conds)) : q).orderBy(desc(t.id));
  // в списке библиотеки не отправляем гигантские тексты целиком
  if (name === "library" && !u.searchParams.get("full")) {
    return Response.json(rows.map((r: any) => ({ ...r, content: r.content.slice(0, 600), contentLength: r.content.length, compactLength: r.compact.length })));
  }
  return Response.json(rows);
}

export async function POST(req: Request, { params }: Ctx) {
  const name = (await params).table;
  const t = TABLES[name];
  if (!t) return Response.json({ error: "unknown table" }, { status: 404 });
  const body = clean(await req.json());
  if (name === "memories") body.tokens = estimateTokens(body.content ?? "");
  const rows: any[] = await (db.insert(t) as any).values(body).returning();
  const row = rows[0];
  return Response.json(row);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const name = (await params).table;
  const t = TABLES[name];
  if (!t) return Response.json({ error: "unknown table" }, { status: 404 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  const body = clean(await req.json());
  if (name === "memories" && typeof body.content === "string") body.tokens = estimateTokens(body.content);
  if (t.updatedAt) body.updatedAt = new Date();
  const rows: any[] = await (db.update(t) as any).set(body).where(eq(t.id, id)).returning();
  const row = rows[0];
  return Response.json(row);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const name = (await params).table;
  const t = TABLES[name];
  if (!t) return Response.json({ error: "unknown table" }, { status: 404 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (name === "entities") {
    await db.delete(relations).where(eq(relations.fromId, id));
    await db.delete(relations).where(eq(relations.toId, id));
  }
  if (name === "worlds") await db.delete(entities).where(eq(entities.worldId, id));
  await db.delete(t).where(eq(t.id, id));
  return Response.json({ ok: true });
}
