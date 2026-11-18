import { db } from "@/db";
import { adventures } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveCheck } from "@/lib/server/roll";
import type { Pending } from "@/lib/server/turn";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Игрок нажал «Бросить»: сервер делает бросок ГСЧ, добавляет модификаторы и сохраняет результат. */
export async function POST(_req: Request, { params }: Ctx) {
  const id = Number((await params).id);
  const [adv] = await db.select().from(adventures).where(eq(adventures.id, id));
  const pending = adv?.pending as Pending | null;
  if (!pending) return Response.json({ error: "Нет ожидающего броска" }, { status: 400 });
  if (pending.roll) return Response.json(pending.roll);
  const outcome = resolveCheck(pending.check);
  await db.update(adventures).set({ pending: { ...pending, roll: outcome } }).where(eq(adventures.id, id));
  return Response.json(outcome);
}
