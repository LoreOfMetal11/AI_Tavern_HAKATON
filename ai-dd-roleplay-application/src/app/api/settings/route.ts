import { getSettings, saveSettings } from "@/lib/server/settings";
import { testProvider } from "@/lib/server/ai";
import type { Provider } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getSettings());
}

export async function PUT(req: Request) {
  const body = await req.json();
  return Response.json(await saveSettings(body));
}

/** Проверка подключения: POST { provider } → список моделей и задержка. */
export async function POST(req: Request) {
  const { provider } = (await req.json()) as { provider: Provider };
  return Response.json(await testProvider(provider));
}
