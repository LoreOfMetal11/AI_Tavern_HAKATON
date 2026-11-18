import fs from "node:fs/promises";
import { mimeOf, safeResolve } from "@/lib/server/media";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path.map(decodeURIComponent);
  const full = safeResolve(parts);
  if (!full) return new Response("Not found", { status: 404 });
  try {
    const buf = await fs.readFile(full);
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": mimeOf(full), "Cache-Control": "public, max-age=3600" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
