import { db } from "@/db";
import { settingsTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_SETTINGS, deepMerge, type Settings } from "@/lib/config";

let cache: { at: number; value: Settings } | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < 2000) return cache.value;
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.id, 1));
  const value = deepMerge(DEFAULT_SETTINGS, rows[0]?.data ?? {});
  cache = { at: Date.now(), value };
  return value;
}

export async function saveSettings(patch: unknown): Promise<Settings> {
  const current = await getSettings();
  const merged = deepMerge(current, patch);
  // массивы (providers, neverForget) заменяются целиком
  const p = patch as Partial<Settings>;
  if (p?.providers) merged.providers = p.providers;
  if (p?.memory?.neverForget) merged.memory.neverForget = p.memory.neverForget;
  if (p?.routes) merged.routes = { ...current.routes, ...p.routes };
  await db
    .insert(settingsTable)
    .values({ id: 1, data: merged })
    .onConflictDoUpdate({ target: settingsTable.id, set: { data: merged, updatedAt: new Date() } });
  cache = { at: Date.now(), value: merged };
  return merged;
}

/** Применяет переопределения приключения к глобальным настройкам. */
export function withOverrides(s: Settings, overrides: unknown): Settings {
  if (!overrides || typeof overrides !== "object") return s;
  return deepMerge(s, overrides);
}
