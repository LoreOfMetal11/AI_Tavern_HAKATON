// Чистые типы и значения по умолчанию — безопасно импортировать и на клиенте.

export type ProviderKind = "openai" | "anthropic" | "gemini";

export interface Provider {
  id: string;
  name: string;
  kind: ProviderKind; // openai = любой OpenAI-совместимый (LM Studio, Ollama, OpenRouter, DeepSeek, Groq...)
  baseUrl: string;
  apiKey: string;
  local?: boolean; // локальная модель: слабые GPU → экономнее запросы
}

export interface ModelRoute {
  providerId: string;
  model: string; // пусто = взять первую доступную у провайдера
  temperature?: number;
  maxTokens?: number;
}

export type TaskKey = "gm" | "director" | "scribe" | "memory" | "prompts" | "translator";

export const TASKS: { key: TaskKey; title: string; hint: string }[] = [
  { key: "gm", title: "Гейм-мастер", hint: "Основное повествование. Самая сильная модель." },
  { key: "director", title: "Режиссёр (размышление)", hint: "План ответа, проверка логики, выбор карточек. Нужен JSON." },
  { key: "scribe", title: "Писарь (изменения карточек)", hint: "Фиксирует урон, предметы, перемены в карточках. Нужен JSON." },
  { key: "memory", title: "Память (сжатие истории)", hint: "Сжимает историю в блокнот. Может быть маленькой моделью." },
  { key: "prompts", title: "Промты для изображений", hint: "Пишет промты для генерации картинок." },
  { key: "translator", title: "Переводчик / адаптер", hint: "Перевод карточек на внутренний язык ИИ и обратно, адаптация книг." },
];

export interface Settings {
  providers: Provider[];
  routes: Record<TaskKey, ModelRoute | null>; // null = как у гейм-мастера
  gen: {
    temperature: number;
    topP: number;
    maxTokens: number;
    frequencyPenalty: number;
    presencePenalty: number;
    seed: number | null;
    extraBody: string; // JSON, добавляется в тело запроса (например top_k, min_p)
  };
  context: {
    size: number; // размер окна модели в токенах
    reserveReply: number;
    split: { rules: number; party: number; world: number; lore: number; memory: number; history: number };
    profile: "tiny" | "small" | "medium" | "large" | "custom";
    showBudgetInChat: boolean;
  };
  language: {
    narration: string; // язык ответов мастера
    internal: string; // язык хранения карточек и лорбука для ИИ
    translateView: boolean; // показывать пользователю на родном языке
    ui: string;
  };
  penalties: {
    repetition: boolean;
    repetitionThreshold: number; // 0..1 доля повторяющихся 4-грамм
    wrongLanguage: boolean;
    speakForPlayer: boolean;
    autoRetry: number; // сколько раз пробовать заново
    retryPenaltyBoost: number; // добавка к штрафам при повторе
    metaLeak: boolean; // «как ИИ-модель...», отказы
  };
  memory: {
    mode: "auto" | "assisted" | "manual";
    triggerRatio: number; // когда история занимает столько доли своего бюджета
    keepRecentTurns: number;
    compression: "light" | "medium" | "strong";
    useModel: boolean;
    mayDrop: string;
    mustKeep: string;
    keepDetails: string;
    neverForget: string[];
    mergeChapters: boolean;
    notebookTopK: number; // сколько записей блокнота читать за ход
  };
  thinking: {
    enabled: boolean;
    depth: "light" | "normal" | "deep";
    plan: boolean;
    checkLogic: boolean;
    checkTriggers: boolean;
    trackChanges: boolean;
    validateInput: boolean;
    creativity: number; // 0..1 насколько смело режиссёр предлагает повороты
    candidateLimit: number;
    maxTokens: number;
    extraInstructions: string;
  };
  optimize: {
    systemSize: "min" | "std" | "full";
    stablePrefix: boolean; // стабильное начало промта → кеш префикса
    anthropicCache: boolean;
    stickyTurns: number; // сколько ходов подтянутая карточка «липнет» в контексте
    logicSelector: "algo" | "ai" | "hybrid";
    checkMode: "gm-tag" | "director";
    stateMode: "separate" | "inline" | "off";
    compactCards: boolean; // слать ИИ compact-версии
    dedupe: boolean;
    historyTrimLongReplies: boolean;
    maxEntitiesPerTurn: number;
  };
  delay: {
    minResponseMs: number; // искусственная минимальная пауза перед ответом
    streamCps: number; // скорость «печати» (символов/с), 0 = как приходит
    timeoutSec: number;
    retries: number;
  };
  media: {
    image: {
      enabled: boolean;
      kind: "openai" | "a1111" | "pollinations";
      baseUrl: string;
      apiKey: string;
      model: string;
      size: string;
      style: string;
      auto: boolean; // ИИ сам рисует по ходу повествования
    };
    tts: {
      enabled: boolean;
      kind: "browser" | "openai";
      baseUrl: string;
      apiKey: string;
      model: string;
      voice: string;
      auto: boolean;
    };
  };
  prompts: {
    gmExtra: string;
    style: string;
    contentPolicy: string;
    systemOverride: string; // если непусто — заменяет базовый системный промт
  };
  dice: { autoRoll: boolean; animation: boolean };
}

export const CONTEXT_PROFILES: Record<string, { size: number; reserveReply: number; split: Settings["context"]["split"] }> = {
  tiny: { size: 4096, reserveReply: 600, split: { rules: 10, party: 14, world: 10, lore: 14, memory: 14, history: 38 } },
  small: { size: 8192, reserveReply: 900, split: { rules: 10, party: 12, world: 10, lore: 16, memory: 16, history: 36 } },
  medium: { size: 16384, reserveReply: 1200, split: { rules: 10, party: 10, world: 10, lore: 20, memory: 16, history: 34 } },
  large: { size: 32768, reserveReply: 1600, split: { rules: 8, party: 8, world: 10, lore: 22, memory: 18, history: 34 } },
};

export const DEFAULT_SETTINGS: Settings = {
  providers: [
    { id: "lmstudio", name: "LM Studio (локально)", kind: "openai", baseUrl: "http://127.0.0.1:1234/v1", apiKey: "", local: true },
  ],
  routes: { gm: { providerId: "lmstudio", model: "" }, director: null, scribe: null, memory: null, prompts: null, translator: null },
  gen: { temperature: 0.85, topP: 0.95, maxTokens: 900, frequencyPenalty: 0.3, presencePenalty: 0.2, seed: null, extraBody: "" },
  context: { size: 8192, reserveReply: 900, split: CONTEXT_PROFILES.small.split, profile: "small", showBudgetInChat: true },
  language: { narration: "ru", internal: "en", translateView: true, ui: "ru" },
  penalties: { repetition: true, repetitionThreshold: 0.35, wrongLanguage: true, speakForPlayer: true, autoRetry: 1, retryPenaltyBoost: 0.3, metaLeak: true },
  memory: {
    mode: "auto",
    triggerRatio: 0.85,
    keepRecentTurns: 4,
    compression: "medium",
    useModel: true,
    mayDrop: "пустая болтовня, приветствия, повторные описания обстановки, неудачные попытки без последствий",
    mustKeep: "клятвы и договорённости, имена, смерти, найденные ценные предметы, изменения отношений, открытые квесты, раны и проклятия",
    keepDetails: "имена, числа (золото, урон), обещания, места, кто что знает",
    neverForget: [],
    mergeChapters: true,
    notebookTopK: 6,
  },
  thinking: {
    enabled: false,
    depth: "normal",
    plan: true,
    checkLogic: true,
    checkTriggers: true,
    trackChanges: true,
    validateInput: true,
    creativity: 0.6,
    candidateLimit: 24,
    maxTokens: 700,
    extraInstructions: "",
  },
  optimize: {
    systemSize: "std",
    stablePrefix: true,
    anthropicCache: true,
    stickyTurns: 3,
    logicSelector: "hybrid",
    checkMode: "gm-tag",
    stateMode: "separate",
    compactCards: true,
    dedupe: true,
    historyTrimLongReplies: true,
    maxEntitiesPerTurn: 8,
  },
  delay: { minResponseMs: 0, streamCps: 0, timeoutSec: 180, retries: 1 },
  media: {
    image: { enabled: false, kind: "pollinations", baseUrl: "", apiKey: "", model: "", size: "768x512", style: "dark fantasy illustration, painterly, dramatic lighting", auto: false },
    tts: { enabled: false, kind: "browser", baseUrl: "", apiKey: "", model: "tts-1", voice: "alloy", auto: false },
  },
  prompts: { gmExtra: "", style: "", contentPolicy: "", systemOverride: "" },
  dice: { autoRoll: false, animation: true },
};

export function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === null || patch === undefined) return base;
  if (Array.isArray(base) || typeof base !== "object" || base === null) {
    return (patch as T) ?? base;
  }
  if (typeof patch !== "object" || Array.isArray(patch)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)[k];
    if (b !== null && typeof b === "object" && !Array.isArray(b) && v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = deepMerge(b, v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

export const LANGS: Record<string, string> = {
  ru: "Русский",
  en: "English",
  uk: "Українська",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
  pl: "Polski",
  pt: "Português",
  it: "Italiano",
  tr: "Türkçe",
  zh: "中文",
  ja: "日本語",
};

export const LANG_NAMES_EN: Record<string, string> = {
  ru: "Russian", en: "English", uk: "Ukrainian", de: "German", es: "Spanish", fr: "French",
  pl: "Polish", pt: "Portuguese", it: "Italian", tr: "Turkish", zh: "Chinese", ja: "Japanese",
};
