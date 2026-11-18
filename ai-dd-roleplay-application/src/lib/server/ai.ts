import type { ModelRoute, Provider, Settings, TaskKey } from "@/lib/config";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  cache?: boolean; // граница кешируемого префикса (Anthropic cache_control)
}

export interface ChatOptions {
  task: TaskKey;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
  signal?: AbortSignal;
  timeoutSec?: number;
}

export interface Resolved {
  provider: Provider;
  model: string;
  route: ModelRoute;
}

const modelCache = new Map<string, { at: number; models: string[] }>();

export class AiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

function trimSlash(s: string) {
  return s.replace(/\/+$/, "");
}

export function resolveRoute(settings: Settings, task: TaskKey): { provider: Provider; route: ModelRoute } {
  const gm = settings.routes.gm;
  const route = settings.routes[task] ?? gm;
  if (!route) throw new AiError("Модель не выбрана. Откройте Настройки → Подключение ИИ.");
  const provider = settings.providers.find((p) => p.id === route.providerId) ?? settings.providers[0];
  if (!provider) throw new AiError("Не добавлен ни один провайдер ИИ. Откройте Настройки → Подключение ИИ.");
  return { provider, route };
}

export async function listModels(provider: Provider): Promise<string[]> {
  const key = provider.id + provider.baseUrl;
  const hit = modelCache.get(key);
  if (hit && Date.now() - hit.at < 30000) return hit.models;
  let models: string[] = [];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    if (provider.kind === "openai") {
      const res = await fetch(`${trimSlash(provider.baseUrl)}/models`, {
        headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {},
        signal: ctrl.signal,
      });
      if (!res.ok) throw new AiError(`Провайдер вернул ${res.status}`, res.status);
      const j = (await res.json()) as { data?: { id: string }[]; models?: { name?: string; id?: string }[] };
      models = (j.data ?? []).map((m) => m.id);
      if (!models.length && j.models) models = j.models.map((m) => m.id ?? m.name ?? "").filter(Boolean);
    } else if (provider.kind === "anthropic") {
      const res = await fetch(`${trimSlash(provider.baseUrl || "https://api.anthropic.com")}/v1/models`, {
        headers: { "x-api-key": provider.apiKey, "anthropic-version": "2023-06-01" },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new AiError(`Провайдер вернул ${res.status}`, res.status);
      const j = (await res.json()) as { data?: { id: string }[] };
      models = (j.data ?? []).map((m) => m.id);
    } else {
      const base = trimSlash(provider.baseUrl || "https://generativelanguage.googleapis.com/v1beta");
      const res = await fetch(`${base}/models?key=${encodeURIComponent(provider.apiKey)}`, { signal: ctrl.signal });
      if (!res.ok) throw new AiError(`Провайдер вернул ${res.status}`, res.status);
      const j = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
      models = (j.models ?? [])
        .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes("generateContent"))
        .map((m) => m.name.replace(/^models\//, ""));
    }
  } finally {
    clearTimeout(t);
  }
  modelCache.set(key, { at: Date.now(), models });
  return models;
}

async function pickModel(provider: Provider, route: ModelRoute): Promise<string> {
  if (route.model) return route.model;
  const models = await listModels(provider).catch(() => []);
  const chatModels = models.filter((m) => !/embed|whisper|tts|rerank/i.test(m));
  if (!chatModels.length) throw new AiError("Не удалось определить модель: укажите её вручную в настройках.");
  return chatModels[0];
}

function withTimeout(signal: AbortSignal | undefined, sec: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new AiError("Таймаут ожидания ответа модели")), sec * 1000);
  const onAbort = () => ctrl.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort);
  return {
    signal: ctrl.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
    touch: (() => {
      let t = timer;
      return () => {
        clearTimeout(t);
        t = setTimeout(() => ctrl.abort(new AiError("Модель замолчала (таймаут)")), sec * 1000);
      };
    })(),
  };
}

function mergeSystem(messages: ChatMessage[]) {
  const sys = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  // склеиваем подряд идущие реплики одной роли: многие локальные шаблоны этого требуют
  const merged: ChatMessage[] = [];
  for (const m of rest) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + m.content;
    else merged.push({ ...m });
  }
  if (merged.length && merged[0].role === "assistant") merged.unshift({ role: "user", content: "(начало)" });
  if (!merged.length) merged.push({ role: "user", content: "Продолжай." });
  return { sys, rest: merged };
}

async function* sseLines(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line.startsWith("data:")) yield line.slice(5).trim();
    }
  }
  if (buf.trim().startsWith("data:")) yield buf.trim().slice(5).trim();
}

/** Убирает блоки размышлений <think>…</think> (DeepSeek-R1, Qwen3 и т.п.) из потока. */
export class ThinkStripper {
  private inThink = false;
  private carry = "";
  push(chunk: string): string {
    let s = this.carry + chunk;
    this.carry = "";
    let out = "";
    while (s.length) {
      if (this.inThink) {
        const e = s.indexOf("</think>");
        if (e < 0) {
          this.carry = s.slice(-8);
          return out;
        }
        s = s.slice(e + 8);
        this.inThink = false;
      } else {
        const b = s.indexOf("<think>");
        if (b < 0) {
          // возможное начало тега на границе чанка
          const tail = s.lastIndexOf("<");
          if (tail >= 0 && s.length - tail < 7 && "<think>".startsWith(s.slice(tail))) {
            out += s.slice(0, tail);
            this.carry = s.slice(tail);
          } else out += s;
          return out;
        }
        out += s.slice(0, b);
        s = s.slice(b + 7);
        this.inThink = true;
      }
    }
    return out;
  }
  flush(): string {
    const r = this.inThink ? "" : this.carry;
    this.carry = "";
    return r;
  }
}

function buildRequest(
  r: Resolved,
  settings: Settings,
  o: ChatOptions,
  stream: boolean,
): { url: string; init: RequestInit } {
  const { provider, model, route } = r;
  const temperature = o.temperature ?? route.temperature ?? settings.gen.temperature;
  const maxTokens = o.maxTokens ?? route.maxTokens ?? settings.gen.maxTokens;
  const { sys, rest } = mergeSystem(o.messages);

  if (provider.kind === "anthropic") {
    const system = sys.map((s) => ({
      type: "text",
      text: s.content,
      ...(s.cache && settings.optimize.anthropicCache ? { cache_control: { type: "ephemeral" } } : {}),
    }));
    return {
      url: `${trimSlash(provider.baseUrl || "https://api.anthropic.com")}/v1/messages`,
      init: {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": provider.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: Math.min(1, temperature),
          top_p: undefined,
          system,
          messages: rest.map((m) => ({ role: m.role, content: m.content })),
          stream,
        }),
      },
    };
  }

  if (provider.kind === "gemini") {
    const base = trimSlash(provider.baseUrl || "https://generativelanguage.googleapis.com/v1beta");
    const method = stream ? "streamGenerateContent?alt=sse&" : "generateContent?";
    return {
      url: `${base}/models/${model}:${method}key=${encodeURIComponent(provider.apiKey)}`,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys.map((s) => s.content).join("\n\n") }] },
          contents: rest.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: {
            temperature,
            topP: o.topP ?? settings.gen.topP,
            maxOutputTokens: maxTokens,
          },
          safetySettings: ["HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH", "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT"].map(
            (category) => ({ category, threshold: "BLOCK_NONE" }),
          ),
        }),
      },
    };
  }

  let extra: Record<string, unknown> = {};
  if (settings.gen.extraBody.trim()) {
    try {
      extra = JSON.parse(settings.gen.extraBody);
    } catch {
      /* игнорируем кривой JSON */
    }
  }
  const msgs = [
    ...(sys.length ? [{ role: "system", content: sys.map((s) => s.content).join("\n\n") }] : []),
    ...rest.map((m) => ({ role: m.role, content: m.content })),
  ];
  return {
    url: `${trimSlash(provider.baseUrl)}/chat/completions`,
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: msgs,
        stream,
        temperature,
        top_p: o.topP ?? settings.gen.topP,
        max_tokens: maxTokens,
        frequency_penalty: o.frequencyPenalty ?? settings.gen.frequencyPenalty,
        presence_penalty: o.presencePenalty ?? settings.gen.presencePenalty,
        ...(settings.gen.seed !== null ? { seed: settings.gen.seed } : {}),
        ...extra,
      }),
    },
  };
}

function extractDelta(kind: Provider["kind"], data: string): string {
  if (data === "[DONE]") return "";
  try {
    const j = JSON.parse(data);
    if (kind === "openai") return j.choices?.[0]?.delta?.content ?? "";
    if (kind === "anthropic") return j.type === "content_block_delta" ? (j.delta?.text ?? "") : "";
    return (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  } catch {
    return "";
  }
}

async function open(r: Resolved, settings: Settings, o: ChatOptions, stream: boolean) {
  const retries = settings.delay.retries;
  const timeoutSec = o.timeoutSec ?? settings.delay.timeoutSec;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const tm = withTimeout(o.signal, timeoutSec);
    try {
      const { url, init } = buildRequest(r, settings, o, stream);
      const res = await fetch(url, { ...init, signal: tm.signal });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        const err = new AiError(`Ошибка ${res.status} от «${r.provider.name}»: ${txt.slice(0, 300)}`, res.status);
        if (res.status === 429 || res.status >= 500) {
          lastErr = err;
          tm.done();
          await new Promise((ok) => setTimeout(ok, 600 * (attempt + 1)));
          continue;
        }
        tm.done();
        throw err;
      }
      return { res, tm };
    } catch (e) {
      tm.done();
      if (o.signal?.aborted) throw e;
      if (e instanceof AiError && e.status && e.status < 500 && e.status !== 429) throw e;
      lastErr = e;
      if (attempt < retries) await new Promise((ok) => setTimeout(ok, 500 * (attempt + 1)));
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  if (/fetch failed|ECONNREFUSED/i.test(msg)) {
    throw new AiError(`Нет связи с «${r.provider.name}» (${r.provider.baseUrl}). Запущен ли сервер модели?`);
  }
  throw lastErr instanceof AiError ? lastErr : new AiError(msg);
}

export async function resolve(settings: Settings, task: TaskKey): Promise<Resolved> {
  const { provider, route } = resolveRoute(settings, task);
  const model = await pickModel(provider, route);
  return { provider, model, route };
}

/** Потоковый чат: отдаёт очищенные от <think> фрагменты. */
export async function* streamChat(settings: Settings, o: ChatOptions): AsyncGenerator<string> {
  const r = await resolve(settings, o.task);
  const { res, tm } = await open(r, settings, o, true);
  const strip = new ThinkStripper();
  try {
    for await (const data of sseLines(res)) {
      tm.touch();
      const d = extractDelta(r.provider.kind, data);
      if (d) {
        const clean = strip.push(d);
        if (clean) yield clean;
      }
    }
    const rest = strip.flush();
    if (rest) yield rest;
  } finally {
    tm.done();
  }
}

/** Непотоковый чат (для JSON-задач). */
export async function completeChat(settings: Settings, o: ChatOptions): Promise<string> {
  const r = await resolve(settings, o.task);
  const { res, tm } = await open(r, settings, o, false);
  try {
    const j = await res.json();
    let text = "";
    if (r.provider.kind === "openai") text = j.choices?.[0]?.message?.content ?? "";
    else if (r.provider.kind === "anthropic") text = (j.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
    else text = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  } finally {
    tm.done();
  }
}

/** Достаёт первый сбалансированный JSON-объект из ответа модели (терпимо к мусору и ```). */
export function extractJson<T = unknown>(text: string): T | null {
  const s = text.replace(/```(?:json)?/gi, "");
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        const chunk = s.slice(start, i + 1);
        try {
          return JSON.parse(chunk) as T;
        } catch {
          try {
            return JSON.parse(chunk.replace(/,\s*([}\]])/g, "$1")) as T;
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

/** JSON-задача: один запрос, холодная температура, повтор при невалидном JSON. */
export async function jsonTask<T>(settings: Settings, task: TaskKey, messages: ChatMessage[], maxTokens = 700): Promise<T | null> {
  for (let i = 0; i < 2; i++) {
    const text = await completeChat(settings, {
      task,
      messages: i === 0 ? messages : [...messages, { role: "user", content: "Ответь ТОЛЬКО валидным JSON без пояснений." }],
      maxTokens,
      temperature: 0.2,
      frequencyPenalty: 0,
      presencePenalty: 0,
    });
    const j = extractJson<T>(text);
    if (j) return j;
  }
  return null;
}

export async function testProvider(provider: Provider): Promise<{ ok: boolean; models: string[]; error?: string; ms: number }> {
  const t0 = Date.now();
  try {
    const models = await listModels({ ...provider, id: provider.id + "-test" });
    return { ok: true, models, ms: Date.now() - t0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      models: [],
      ms: Date.now() - t0,
      error: /fetch failed|ECONNREFUSED|abort/i.test(msg) ? "Нет связи: проверьте адрес и что сервер запущен" : msg,
    };
  }
}
