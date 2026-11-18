"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/config";
import { api, put } from "./api";

/** Настройки с автосохранением: правки отправляются на сервер через ~700 мс после последнего изменения. */
export function useSettings() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<"idle" | "dirty" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    api<Settings>("/api/settings").then((x) => {
      setS(x);
      latest.current = x;
      setLoaded(true);
    });
  }, []);

  const update = useCallback((path: string, value: unknown) => {
    setS((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as Settings;
      const keys = path.split(".");
      let cur: Record<string, unknown> = next as unknown as Record<string, unknown>;
      for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]] as Record<string, unknown>;
      cur[keys[keys.length - 1]] = value;
      latest.current = next;
      return next;
    });
    setSaving("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await put("/api/settings", latest.current).catch(() => undefined);
      setSaving("saved");
    }, 700);
  }, []);

  const replace = useCallback((next: Settings) => {
    setS(next);
    latest.current = next;
    setSaving("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await put("/api/settings", next).catch(() => undefined);
      setSaving("saved");
    }, 300);
  }, []);

  return { s, update, replace, loaded, saving };
}
