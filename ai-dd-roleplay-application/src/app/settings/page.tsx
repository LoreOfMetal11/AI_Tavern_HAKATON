"use client";
import Link from "next/link";
import { useState } from "react";
import { CONTEXT_PROFILES, LANGS, TASKS, type Provider, type ProviderKind, type Settings, type TaskKey } from "@/lib/config";
import { post } from "@/lib/client/api";
import { useSettings } from "@/lib/client/useSettings";
import { MemoryPolicy } from "@/components/MemoryPolicy";
import { Badge, Btn, Card, Field, NumInput, Select, Slider, Tabs, TextArea, TextInput, Toggle } from "@/components/ui";

const PRESETS: { name: string; kind: ProviderKind; baseUrl: string; local?: boolean; note: string }[] = [
  { name: "LM Studio (локально)", kind: "openai", baseUrl: "http://127.0.0.1:1234/v1", local: true, note: "Запустите Local Server в LM Studio — ключ не нужен." },
  { name: "Ollama (локально)", kind: "openai", baseUrl: "http://127.0.0.1:11434/v1", local: true, note: "ollama serve; модель вводится вручную, напр. qwen2.5:7b." },
  { name: "KoboldCpp / llama.cpp", kind: "openai", baseUrl: "http://127.0.0.1:5001/v1", local: true, note: "Любой OpenAI-совместимый локальный сервер." },
  { name: "OpenRouter", kind: "openai", baseUrl: "https://openrouter.ai/api/v1", note: "Сотни моделей по одному ключу." },
  { name: "OpenAI", kind: "openai", baseUrl: "https://api.openai.com/v1", note: "Ключ sk-…" },
  { name: "DeepSeek", kind: "openai", baseUrl: "https://api.deepseek.com/v1", note: "Дёшево и сильно в сюжетах." },
  { name: "Groq", kind: "openai", baseUrl: "https://api.groq.com/openai/v1", note: "Очень быстрые ответы." },
  { name: "Together AI", kind: "openai", baseUrl: "https://api.together.xyz/v1", note: "Открытые модели в облаке." },
  { name: "Mistral", kind: "openai", baseUrl: "https://api.mistral.ai/v1", note: "" },
  { name: "Anthropic (Claude)", kind: "anthropic", baseUrl: "https://api.anthropic.com", note: "Поддерживается кеш префикса." },
  { name: "Google Gemini", kind: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", note: "Ключ из AI Studio." },
  { name: "Свой адрес (OpenAI-совместимый)", kind: "openai", baseUrl: "", note: "Укажите любой URL вида https://…/v1" },
];

type TabKey = "connect" | "models" | "gen" | "context" | "lang" | "pen" | "memory" | "think" | "opt" | "delay" | "media" | "prompts";

export default function SettingsPage() {
  const { s, update, replace, loaded, saving } = useSettings();
  const [tab, setTab] = useState<TabKey>("connect");
  const [tests, setTests] = useState<Record<string, { ok: boolean; models: string[]; error?: string; ms: number } | "loading">>({});
  const [preset, setPreset] = useState(0);
  const [quickKey, setQuickKey] = useState("");

  if (!loaded) return <div className="font-ui p-8 text-stone-400">Загрузка…</div>;

  const test = async (p: Provider) => {
    setTests((t) => ({ ...t, [p.id]: "loading" }));
    const r = await post<{ ok: boolean; models: string[]; error?: string; ms: number }>("/api/settings", { provider: p });
    setTests((t) => ({ ...t, [p.id]: r }));
    return r;
  };
  const setProv = (id: string, patch: Partial<Provider>) => update("providers", s.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const modelsOf = (id: string) => {
    const t = tests[id];
    return t && t !== "loading" ? t.models : [];
  };

  const quickConnect = async () => {
    const pr = PRESETS[preset];
    const p: Provider = { id: "p" + Date.now().toString(36), name: pr.name, kind: pr.kind, baseUrl: pr.baseUrl, apiKey: quickKey, local: pr.local };
    const r = await test(p);
    const next: Settings = JSON.parse(JSON.stringify(s));
    next.providers = [...s.providers.filter((x) => x.baseUrl !== p.baseUrl), p];
    if (r.ok && r.models.length) {
      const pick = r.models.find((m) => !/embed|whisper|tts/i.test(m)) ?? r.models[0];
      next.routes.gm = { providerId: p.id, model: pick };
    } else next.routes.gm = { providerId: p.id, model: s.routes.gm?.model ?? "" };
    if (pr.local) {
      next.context = { ...next.context, ...CONTEXT_PROFILES.small, profile: "small", showBudgetInChat: true };
    }
    replace(next);
    setQuickKey("");
  };

  const profile = (k: string) => {
    const pr = CONTEXT_PROFILES[k];
    update("context", { ...s.context, ...pr, profile: k });
  };
  const splitSum = Object.values(s.context.split).reduce((a, b) => a + b, 0);

  const TABS: { key: TabKey; label: string }[] = [
    { key: "connect", label: "Подключение ИИ" },
    { key: "models", label: "Модели по задачам" },
    { key: "gen", label: "Генерация" },
    { key: "context", label: "Контекст" },
    { key: "lang", label: "Язык" },
    { key: "pen", label: "Штрафы" },
    { key: "memory", label: "Память и сжатие" },
    { key: "think", label: "Размышление" },
    { key: "opt", label: "Оптимизация" },
    { key: "delay", label: "Задержки" },
    { key: "media", label: "Картинки и голос" },
    { key: "prompts", label: "Промты" },
  ];

  return (
    <div className="font-ui mx-auto max-w-5xl p-4 md:p-8">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-amber-300 hover:underline">← К приключениям</Link>
          <h1 className="font-serif text-3xl text-amber-100">Настройки</h1>
        </div>
        <Badge tone={saving === "dirty" ? "amber" : "green"}>{saving === "dirty" ? "сохраняется…" : "всё сохранено автоматически"}</Badge>
      </div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <div className="mt-5 space-y-4">
        {tab === "connect" && (
          <>
            <Card>
              <h3 className="mb-2 text-lg font-semibold text-amber-100">Быстрое подключение</h3>
              <p className="mb-3 text-sm text-stone-400">Выберите сервис, вставьте ключ (для локальных моделей ключ не нужен) и нажмите «Подключить». Модель выберется автоматически.</p>
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <Select value={String(preset)} onChange={(v) => setPreset(Number(v))} options={PRESETS.map((p, i) => ({ value: String(i), label: p.name }))} />
                <TextInput type="password" placeholder={PRESETS[preset].local ? "ключ не требуется" : "API-ключ"} value={quickKey} onChange={(e) => setQuickKey(e.target.value)} />
                <Btn variant="primary" onClick={quickConnect}>Подключить</Btn>
              </div>
              {PRESETS[preset].note && <p className="mt-2 text-xs text-stone-400">{PRESETS[preset].note}</p>}
            </Card>
            {s.providers.map((p) => {
              const t = tests[p.id];
              return (
                <Card key={p.id}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <TextInput value={p.name} onChange={(e) => setProv(p.id, { name: e.target.value })} className="max-w-xs font-semibold" />
                    <div className="flex items-center gap-2">
                      {p.local && <Badge tone="green">локальная</Badge>}
                      <Btn onClick={() => test(p)}>{t === "loading" ? "Проверка…" : "Проверить"}</Btn>
                      <Btn variant="danger" onClick={() => update("providers", s.providers.filter((x) => x.id !== p.id))}>Удалить</Btn>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="Тип API">
                      <Select value={p.kind} onChange={(v) => setProv(p.id, { kind: v as ProviderKind })} options={[{ value: "openai", label: "OpenAI-совместимый" }, { value: "anthropic", label: "Anthropic" }, { value: "gemini", label: "Google Gemini" }]} />
                    </Field>
                    <Field label="Адрес (Base URL)">
                      <TextInput value={p.baseUrl} onChange={(e) => setProv(p.id, { baseUrl: e.target.value })} />
                    </Field>
                    <Field label="API-ключ">
                      <TextInput type="password" value={p.apiKey} onChange={(e) => setProv(p.id, { apiKey: e.target.value })} placeholder="не требуется для локальных" />
                    </Field>
                  </div>
                  <Toggle value={!!p.local} onChange={(v) => setProv(p.id, { local: v })} label="Это локальная модель" hint="Для слабых GPU: интерфейс советует короткий контекст и экономные режимы." />
                  {t && t !== "loading" && (
                    <p className={`mt-2 text-sm ${t.ok ? "text-emerald-300" : "text-red-300"}`}>
                      {t.ok ? `✓ Связь есть (${t.ms} мс). Моделей: ${t.models.length}. ${t.models.slice(0, 6).join(", ")}${t.models.length > 6 ? "…" : ""}` : `✗ ${t.error}`}
                    </p>
                  )}
                </Card>
              );
            })}
            <Btn onClick={() => update("providers", [...s.providers, { id: "p" + Date.now().toString(36), name: "Новый провайдер", kind: "openai", baseUrl: "", apiKey: "" }])}>+ Добавить провайдера вручную</Btn>
          </>
        )}

        {tab === "models" && (
          <Card className="space-y-5">
            <p className="text-sm text-stone-400">Для каждой задачи можно выбрать свою модель. Пустое значение — используется модель гейм-мастера. Для слабых GPU: мастер — основная модель, а размышление/память/писарь — та же или поменьше.</p>
            {TASKS.map((t) => {
              const r = s.routes[t.key];
              const set = (patch: object | null) => update(`routes.${t.key}`, patch === null ? null : { providerId: s.providers[0]?.id ?? "", model: "", ...(r ?? {}), ...patch });
              const same = !r && t.key !== "gm";
              return (
                <div key={t.key} className="rounded-lg border border-stone-800 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-amber-100">{t.title}</div>
                      <div className="text-xs text-stone-400">{t.hint}</div>
                    </div>
                    {t.key !== "gm" && <Toggle value={!same} onChange={(v) => set(v ? {} : null)} label="Своя модель" />}
                  </div>
                  {!same && (
                    <div className="grid gap-3 md:grid-cols-4">
                      <Field label="Провайдер">
                        <Select value={r?.providerId ?? ""} onChange={(v) => set({ providerId: v })} options={s.providers.map((p) => ({ value: p.id, label: p.name }))} />
                      </Field>
                      <Field label="Модель" hint={modelsOf(r?.providerId ?? "").length ? "из проверенного списка" : "пусто = первая доступная"}>
                        <TextInput list={`models-${t.key}`} value={r?.model ?? ""} onChange={(e) => set({ model: e.target.value })} />
                        <datalist id={`models-${t.key}`}>{modelsOf(r?.providerId ?? "").map((m) => <option key={m} value={m} />)}</datalist>
                      </Field>
                      <Field label="Температура (необяз.)">
                        <NumInput step={0.05} min={0} max={2} value={r?.temperature ?? 0} onChange={(v) => set({ temperature: v || undefined })} />
                      </Field>
                      <Field label="Макс. токенов (необяз.)">
                        <NumInput step={50} min={0} value={r?.maxTokens ?? 0} onChange={(v) => set({ maxTokens: v || undefined })} />
                      </Field>
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-stone-500">Подсказка: на вкладке «Подключение ИИ» нажмите «Проверить» — список моделей появится в подсказках выше.</p>
          </Card>
        )}

        {tab === "gen" && (
          <Card className="grid gap-5 md:grid-cols-2">
            <Slider label="Температура" min={0} max={1.5} value={s.gen.temperature} onChange={(v) => update("gen.temperature", v)} hint="Выше — креативнее и безумнее; ниже — стабильнее." />
            <Slider label="Top-P" min={0.1} max={1} value={s.gen.topP} onChange={(v) => update("gen.topP", v)} />
            <Slider label="Штраф частоты" min={0} max={1.5} value={s.gen.frequencyPenalty} onChange={(v) => update("gen.frequencyPenalty", v)} hint="Против повторяющихся слов." />
            <Slider label="Штраф присутствия" min={0} max={1.5} value={s.gen.presencePenalty} onChange={(v) => update("gen.presencePenalty", v)} hint="Подталкивает к новым темам." />
            <Field label="Макс. длина ответа (токены)" hint="Для 4K-контекста ставьте 400–600."><NumInput value={s.gen.maxTokens} min={100} step={50} onChange={(v) => update("gen.maxTokens", v)} /></Field>
            <Field label="Seed (пусто/0 = случайный)"><NumInput value={s.gen.seed ?? 0} onChange={(v) => update("gen.seed", v || null)} /></Field>
            <Field label="Доп. параметры запроса (JSON)" hint='Например {"top_k":40,"min_p":0.05,"repeat_penalty":1.1} — для локальных серверов.' className="md:col-span-2">
              <TextArea value={s.gen.extraBody} onChange={(e) => update("gen.extraBody", e.target.value)} placeholder='{"top_k":40}' />
            </Field>
          </Card>
        )}

        {tab === "context" && (
          <Card className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(CONTEXT_PROFILES).map(([k, v]) => (
                <Btn key={k} variant={s.context.profile === k ? "primary" : "default"} onClick={() => profile(k)}>
                  {k === "tiny" ? "4K (слабый GPU)" : k === "small" ? "8K" : k === "medium" ? "16K" : "32K+"} · {v.size}
                </Btn>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Размер контекстного окна модели (токены)" hint="Укажите ровно то, что загружено в модель (в LM Studio — «Context Length»)."><NumInput value={s.context.size} min={2048} step={1024} onChange={(v) => update("context", { ...s.context, size: v, profile: "custom" })} /></Field>
              <Field label="Запас под ответ (токены)"><NumInput value={s.context.reserveReply} min={200} step={100} onChange={(v) => update("context", { ...s.context, reserveReply: v, profile: "custom" })} /></Field>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-amber-100">Распределение бюджета (сумма {splitSum}%)</h4>
              <div className="grid gap-3 md:grid-cols-3">
                {([["rules", "Правила"], ["party", "Игроки и сцена"], ["world", "Мир и сюжет"], ["lore", "Лорбук (карточки)"], ["memory", "Блокнот памяти"], ["history", "Недавняя история"]] as const).map(([k, label]) => (
                  <Slider key={k} label={label} min={0} max={60} step={1} value={s.context.split[k]} onChange={(v) => update("context", { ...s.context, split: { ...s.context.split, [k]: v }, profile: "custom" })} fmt={(n) => `${n}%`} />
                ))}
              </div>
              <p className="mt-2 text-xs text-stone-400">Неиспользованный бюджет любой группы автоматически перетекает в историю — токены не пропадают зря.</p>
            </div>
          </Card>
        )}

        {tab === "lang" && (
          <Card className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Язык интерфейса"><Select value={s.language.ui} onChange={(v) => update("language.ui", v)} options={[{ value: "ru", label: "Русский" }]} /></Field>
              <Field label="Язык ответов мастера" hint="Мастер говорит только на нём; иероглифы и вбросы другого языка штрафуются."><Select value={s.language.narration} onChange={(v) => update("language.narration", v)} options={Object.entries(LANGS).map(([k, v]) => ({ value: k, label: v }))} /></Field>
              <Field label="Язык хранения для ИИ" hint="Карточки и блокнот ИИ хранит на «дешёвом» для модели языке (обычно английский: меньше токенов)."><Select value={s.language.internal} onChange={(v) => update("language.internal", v)} options={Object.entries(LANGS).map(([k, v]) => ({ value: k, label: v }))} /></Field>
            </div>
            <Toggle value={s.language.translateView} onChange={(v) => update("language.translateView", v)} label="Показывать мне всё на родном языке" hint="Когда ИИ правит карточку на внутреннем языке, текст для просмотра автоматически переводится обратно." />
          </Card>
        )}

        {tab === "pen" && (
          <Card className="space-y-3">
            <p className="text-sm text-stone-400">После каждого ответа мастера проверяется качество. При нарушении ответ переписывается с повышенными штрафами, а нарушение отмечается в сообщении.</p>
            <Toggle value={s.penalties.repetition} onChange={(v) => update("penalties.repetition", v)} label="Штраф за повторения" hint="Сравнение с последними ответами и внутри ответа (по 4-граммам слов)." />
            <Slider label="Порог повторов" min={0.1} max={0.8} value={s.penalties.repetitionThreshold} onChange={(v) => update("penalties.repetitionThreshold", v)} fmt={(n) => `${Math.round(n * 100)}%`} />
            <Toggle value={s.penalties.wrongLanguage} onChange={(v) => update("penalties.wrongLanguage", v)} label="Штраф за чужой язык" hint="Иероглифы вырезаются на лету, много латиницы в русском тексте — перезапись." />
            <Toggle value={s.penalties.speakForPlayer} onChange={(v) => update("penalties.speakForPlayer", v)} label="Штраф за речь и действия за игрока" />
            <Toggle value={s.penalties.metaLeak} onChange={(v) => update("penalties.metaLeak", v)} label="Штраф за выход из роли и отказы («как языковая модель…»)" />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Автоповторов при нарушении"><NumInput value={s.penalties.autoRetry} min={0} max={4} onChange={(v) => update("penalties.autoRetry", v)} /></Field>
              <Slider label="Добавка к штрафам API при повторе" min={0} max={1} value={s.penalties.retryPenaltyBoost} onChange={(v) => update("penalties.retryPenaltyBoost", v)} />
            </div>
          </Card>
        )}

        {tab === "memory" && (
          <Card>
            <MemoryPolicy s={s} update={update} />
          </Card>
        )}

        {tab === "think" && (
          <Card className="space-y-3">
            <Toggle value={s.thinking.enabled} onChange={(v) => update("thinking.enabled", v)} label="Режим размышления" hint="Перед ответом «режиссёр» продумывает ход: какие карточки подтянуть, нужна ли проверка, что интересного может произойти. Чуть дольше, но ответы богаче и логичнее." />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Глубина"><Select value={s.thinking.depth} onChange={(v) => update("thinking.depth", v)} options={[{ value: "light", label: "Лёгкая — только выбор карточек" }, { value: "normal", label: "Обычная — + план ответа" }, { value: "deep", label: "Глубокая — + мотивы NPC, предзнаменования" }]} /></Field>
              <Field label="Токенов на размышление"><NumInput value={s.thinking.maxTokens} min={200} step={100} onChange={(v) => update("thinking.maxTokens", v)} /></Field>
              <Slider label="Креативность режиссёра" min={0} max={1} value={s.thinking.creativity} onChange={(v) => update("thinking.creativity", v)} />
              <Field label="Кандидатов карточек для оценки"><NumInput value={s.thinking.candidateLimit} min={4} max={80} onChange={(v) => update("thinking.candidateLimit", v)} /></Field>
            </div>
            <Toggle value={s.thinking.plan} onChange={(v) => update("thinking.plan", v)} label="План ответа и свежий поворот" />
            <Toggle value={s.thinking.checkTriggers} onChange={(v) => update("thinking.checkTriggers", v)} label="Проверять сработавшие триггеры" hint="Режиссёр читает описания и решает, подтягивать ли карточку." />
            <Toggle value={s.thinking.checkLogic} onChange={(v) => update("thinking.checkLogic", v)} label="Проверять логику и противоречия" />
            <Toggle value={s.thinking.validateInput} onChange={(v) => update("thinking.validateInput", v)} label="Оценивать ввод игрока" hint="Может ли персонаж так сделать, есть ли предмет, не нарушает ли это мир." />
            <Toggle value={s.thinking.trackChanges} onChange={(v) => update("thinking.trackChanges", v)} label="Отмечать изменения для писаря" />
            <Field label="Свои инструкции режиссёру"><TextArea value={s.thinking.extraInstructions} onChange={(e) => update("thinking.extraInstructions", e.target.value)} /></Field>
          </Card>
        )}

        {tab === "opt" && (
          <Card className="space-y-3">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Размер системного промта" hint="Мин. — для 4K; стандарт; полный — для сильных моделей."><Select value={s.optimize.systemSize} onChange={(v) => update("optimize.systemSize", v)} options={[{ value: "min", label: "Минимальный (~250 токенов)" }, { value: "std", label: "Стандартный" }, { value: "full", label: "Полный (сильные модели)" }]} /></Field>
              <Field label="Как определяется необходимость броска" hint="Метка мастера: без лишних запросов. Режиссёр: отдельная оценка (точнее, но медленнее)."><Select value={s.optimize.checkMode} onChange={(v) => update("optimize.checkMode", v)} options={[{ value: "gm-tag", label: "Метка мастера (быстро, 0 лишних запросов)" }, { value: "director", label: "Через режиссёра (нужно размышление)" }]} /></Field>
              <Field label="Как фиксируются изменения карточек" hint="Отдельно: писарь после ответа (не тормозит чтение). Внутри: мастер дописывает блок (экономит запрос, но грузит слабые модели)."><Select value={s.optimize.stateMode} onChange={(v) => update("optimize.stateMode", v)} options={[{ value: "separate", label: "Отдельным запросом (писарь)" }, { value: "inline", label: "Внутри ответа мастера" }, { value: "off", label: "Не менять карточки автоматически" }]} /></Field>
              <Field label="Выбор карточек «по логике»"><Select value={s.optimize.logicSelector} onChange={(v) => update("optimize.logicSelector", v)} options={[{ value: "algo", label: "Алгоритм (мгновенно)" }, { value: "hybrid", label: "Алгоритм + режиссёр" }, { value: "ai", label: "Только режиссёр" }]} /></Field>
              <Field label="«Липкость» карточек (ходов)" hint="Подтянутая карточка остаётся в контексте ещё N ходов — меньше провалов памяти и стабильнее кеш."><NumInput value={s.optimize.stickyTurns} min={0} max={10} onChange={(v) => update("optimize.stickyTurns", v)} /></Field>
              <Field label="Макс. подтянутых карточек за ход"><NumInput value={s.optimize.maxEntitiesPerTurn} min={1} max={30} onChange={(v) => update("optimize.maxEntitiesPerTurn", v)} /></Field>
            </div>
            <Toggle value={s.optimize.stablePrefix} onChange={(v) => update("optimize.stablePrefix", v)} label="Стабильный префикс промта (кеш)" hint="Неизменное (правила, мир, «всегда») идёт в начале, быстро меняющееся — в конце. Серверы с кешем префикса (LM Studio, llama.cpp, OpenAI, Claude) не пересчитывают начало." />
            <Toggle value={s.optimize.anthropicCache} onChange={(v) => update("optimize.anthropicCache", v)} label="cache_control для Claude" />
            <Toggle value={s.optimize.compactCards} onChange={(v) => update("optimize.compactCards", v)} label="Отправлять ИИ сжатые версии карточек" />
            <Toggle value={s.optimize.dedupe} onChange={(v) => update("optimize.dedupe", v)} label="Убирать дубли в контексте" />
            <Toggle value={s.optimize.historyTrimLongReplies} onChange={(v) => update("optimize.historyTrimLongReplies", v)} label="Укорачивать старые длинные ответы в истории" hint="Последние ответы остаются полностью, старые обрезаются." />
          </Card>
        )}

        {tab === "delay" && (
          <Card className="space-y-4">
            <Slider label="Минимальная пауза перед ответом" min={0} max={8000} step={250} value={s.delay.minResponseMs} onChange={(v) => update("delay.minResponseMs", v)} fmt={(n) => `${(n / 1000).toFixed(1)} с`} hint="Для атмосферы: мастер «обдумывает» не быстрее заданного." />
            <Slider label="Скорость «печати» текста" min={0} max={400} step={10} value={s.delay.streamCps} onChange={(v) => update("delay.streamCps", v)} fmt={(n) => (n === 0 ? "как приходит" : `${n} симв./с`)} hint="0 — показывать сразу по мере генерации." />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Таймаут молчания модели (сек)"><NumInput value={s.delay.timeoutSec} min={20} step={10} onChange={(v) => update("delay.timeoutSec", v)} /></Field>
              <Field label="Повторов при сбое сети / 429 / 5xx"><NumInput value={s.delay.retries} min={0} max={5} onChange={(v) => update("delay.retries", v)} /></Field>
            </div>
            <Toggle value={s.dice.autoRoll} onChange={(v) => update("dice.autoRoll", v)} label="Бросать кубики автоматически" hint="Выкл. — игрок сам нажимает «Бросить»." />
            <Toggle value={s.dice.animation} onChange={(v) => update("dice.animation", v)} label="Анимация кубика" />
          </Card>
        )}

        {tab === "media" && (
          <>
            <Card className="space-y-3">
              <h3 className="text-lg font-semibold text-amber-100">Генерация изображений</h3>
              <Toggle value={s.media.image.enabled} onChange={(v) => update("media.image.enabled", v)} label="Включить" hint="Фоны локаций, бои, портреты, артефакты. Промт пишет отдельная модель «Промты для изображений»." />
              <Toggle value={s.media.image.auto} onChange={(v) => update("media.image.auto", v)} label="ИИ рисует по ходу повествования" hint="Писарь отмечает яркие моменты — иллюстрация появляется под ответом." />
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Тип"><Select value={s.media.image.kind} onChange={(v) => update("media.image.kind", v)} options={[{ value: "pollinations", label: "Pollinations (бесплатно, без ключа)" }, { value: "a1111", label: "Stable Diffusion WebUI (локально, AUTOMATIC1111)" }, { value: "openai", label: "OpenAI-совместимый /images/generations" }]} /></Field>
                <Field label="Адрес"><TextInput value={s.media.image.baseUrl} onChange={(e) => update("media.image.baseUrl", e.target.value)} placeholder="http://127.0.0.1:7860" /></Field>
                <Field label="Ключ"><TextInput type="password" value={s.media.image.apiKey} onChange={(e) => update("media.image.apiKey", e.target.value)} /></Field>
                <Field label="Модель"><TextInput value={s.media.image.model} onChange={(e) => update("media.image.model", e.target.value)} /></Field>
                <Field label="Размер"><TextInput value={s.media.image.size} onChange={(e) => update("media.image.size", e.target.value)} /></Field>
                <Field label="Стиль"><TextInput value={s.media.image.style} onChange={(e) => update("media.image.style", e.target.value)} /></Field>
              </div>
            </Card>
            <Card className="space-y-3">
              <h3 className="text-lg font-semibold text-amber-100">Озвучка</h3>
              <Toggle value={s.media.tts.enabled} onChange={(v) => update("media.tts.enabled", v)} label="Включить кнопку озвучки" />
              <Toggle value={s.media.tts.auto} onChange={(v) => update("media.tts.auto", v)} label="Озвучивать каждый ответ автоматически" />
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Движок"><Select value={s.media.tts.kind} onChange={(v) => update("media.tts.kind", v)} options={[{ value: "browser", label: "Голос браузера (бесплатно, офлайн)" }, { value: "openai", label: "OpenAI-совместимый /audio/speech" }]} /></Field>
                <Field label="Голос"><TextInput value={s.media.tts.voice} onChange={(e) => update("media.tts.voice", e.target.value)} /></Field>
                <Field label="Адрес"><TextInput value={s.media.tts.baseUrl} onChange={(e) => update("media.tts.baseUrl", e.target.value)} /></Field>
                <Field label="Ключ"><TextInput type="password" value={s.media.tts.apiKey} onChange={(e) => update("media.tts.apiKey", e.target.value)} /></Field>
              </div>
            </Card>
          </>
        )}

        {tab === "prompts" && (
          <Card className="space-y-4">
            <Field label="Дополнительные указания мастеру"><TextArea rows={4} value={s.prompts.gmExtra} onChange={(e) => update("prompts.gmExtra", e.target.value)} placeholder="Например: делай бой жестоким, давай больше диалогов NPC…" /></Field>
            <Field label="Стиль повествования"><TextArea value={s.prompts.style} onChange={(e) => update("prompts.style", e.target.value)} placeholder="Мрачный, с чёрным юмором…" /></Field>
            <Field label="Содержание и допустимые темы" hint="По умолчанию мастер описывает любые исходы откровенно и без морализаторства."><TextArea value={s.prompts.contentPolicy} onChange={(e) => update("prompts.contentPolicy", e.target.value)} /></Field>
            <Field label="Полная замена системного промта (для экспертов)" hint="Переменные: {{lang}}, {{edition}}. Блоки правил, карточек и памяти добавляются автоматически."><TextArea rows={6} value={s.prompts.systemOverride} onChange={(e) => update("prompts.systemOverride", e.target.value)} /></Field>
          </Card>
        )}
      </div>
    </div>
  );
}
