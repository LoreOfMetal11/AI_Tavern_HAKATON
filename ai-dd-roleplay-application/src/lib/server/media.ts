import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { Settings } from "@/lib/config";
import { completeChat } from "./ai";

export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), "data");
export const IMAGES_DIR = path.join(DATA_DIR, "images"); // сюда пользователь кладёт свои картинки
export const GENERATED_DIR = path.join(DATA_DIR, "generated");

const EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".mp3": "audio/mpeg", ".wav": "audio/wav" };

export function mimeOf(file: string) {
  return MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

export async function ensureDirs() {
  await fs.mkdir(IMAGES_DIR, { recursive: true });
  await fs.mkdir(GENERATED_DIR, { recursive: true });
}

export async function listImages(): Promise<{ url: string; name: string; folder: string }[]> {
  await ensureDirs();
  const out: { url: string; name: string; folder: string }[] = [];
  for (const [dir, folder] of [[IMAGES_DIR, "images"], [GENERATED_DIR, "generated"]] as const) {
    const walk = async (d: string, rel: string) => {
      const items = await fs.readdir(d, { withFileTypes: true }).catch(() => []);
      for (const it of items) {
        if (it.isDirectory()) await walk(path.join(d, it.name), rel + it.name + "/");
        else if (EXT.has(path.extname(it.name).toLowerCase())) out.push({ url: `/api/media/${folder}/${rel}${it.name}`, name: rel + it.name, folder });
      }
    };
    await walk(dir, "");
  }
  return out;
}

export function safeResolve(parts: string[]): string | null {
  const root = parts[0] === "images" ? IMAGES_DIR : parts[0] === "generated" ? GENERATED_DIR : null;
  if (!root) return null;
  const full = path.resolve(root, ...parts.slice(1));
  return full.startsWith(root + path.sep) ? full : null;
}

export async function saveBuffer(buf: Buffer, ext: string, folder: "images" | "generated" = "generated") {
  await ensureDirs();
  const name = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}${ext}`;
  await fs.writeFile(path.join(folder === "images" ? IMAGES_DIR : GENERATED_DIR, name), buf);
  return `/api/media/${folder}/${name}`;
}

/** Модель «промтов» превращает описание сцены в короткий промт для генератора картинок. */
export async function craftImagePrompt(s: Settings, description: string, kind: string): Promise<string> {
  const style = s.media.image.style;
  try {
    const text = await completeChat(s, {
      task: "prompts",
      messages: [
        { role: "system", content: `You write prompts for an image generator. Output ONE line in English, max 60 words: subject, setting, mood, lighting, composition. Kind: ${kind}. No text in image, no names. Style: ${style}.` },
        { role: "user", content: description.slice(0, 1500) },
      ],
      maxTokens: 140,
      temperature: 0.7,
      timeoutSec: 40,
    });
    const line = text.split("\n")[0].trim();
    if (line.length > 10) return `${line}, ${style}`;
  } catch {
    /* ниже запасной вариант */
  }
  return `${description.slice(0, 300)}, ${style}`;
}

export async function generateImage(s: Settings, prompt: string): Promise<string> {
  const cfg = s.media.image;
  const [w, h] = (cfg.size || "768x512").split("x").map((x) => parseInt(x, 10) || 512);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 150000);
  try {
    if (cfg.kind === "pollinations") {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true&seed=${Math.floor(Math.random() * 1e6)}`;
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error(`Pollinations: ${r.status}`);
      return saveBuffer(Buffer.from(await r.arrayBuffer()), ".jpg");
    }
    if (cfg.kind === "a1111") {
      const r = await fetch(`${cfg.baseUrl.replace(/\/+$/, "")}/sdapi/v1/txt2img`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, negative_prompt: "text, watermark, blurry, deformed", width: w, height: h, steps: 20 }),
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error(`Stable Diffusion: ${r.status}`);
      const j = (await r.json()) as { images?: string[] };
      if (!j.images?.[0]) throw new Error("Пустой ответ генератора");
      return saveBuffer(Buffer.from(j.images[0], "base64"), ".png");
    }
    const r = await fetch(`${(cfg.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "")}/images/generations`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
      body: JSON.stringify({ model: cfg.model || undefined, prompt, n: 1, size: cfg.size || "1024x1024" }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`Генератор изображений: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = (await r.json()) as { data?: { b64_json?: string; url?: string }[] };
    const d0 = j.data?.[0];
    if (d0?.b64_json) return saveBuffer(Buffer.from(d0.b64_json, "base64"), ".png");
    if (d0?.url) {
      const img = await fetch(d0.url, { signal: ctrl.signal });
      return saveBuffer(Buffer.from(await img.arrayBuffer()), ".png");
    }
    throw new Error("Пустой ответ генератора");
  } finally {
    clearTimeout(timer);
  }
}

export async function synthesizeSpeech(s: Settings, text: string): Promise<{ buf: Buffer; mime: string }> {
  const cfg = s.media.tts;
  const r = await fetch(`${(cfg.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "")}/audio/speech`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}) },
    body: JSON.stringify({ model: cfg.model || "tts-1", voice: cfg.voice || "alloy", input: text.slice(0, 3800) }),
  });
  if (!r.ok) throw new Error(`TTS: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return { buf: Buffer.from(await r.arrayBuffer()), mime: r.headers.get("content-type") ?? "audio/mpeg" };
}
