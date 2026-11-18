"use client";
import type { Settings } from "@/lib/config";
import { Field, NumInput, Select, Slider, TextArea, Toggle } from "./ui";

/** Политика сжатия истории: используется и в настройках, и в панели памяти. */
export function MemoryPolicy({ s, update }: { s: Settings; update: (path: string, v: unknown) => void }) {
  const m = s.memory;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Режим сжатия" hint="Авто — ИИ сам сжимает старые ходы в блокнот. С подтверждением — предлагает черновик, вы правите и принимаете. Вручную — только по кнопке.">
          <Select value={m.mode} onChange={(v) => update("memory.mode", v)} options={[{ value: "auto", label: "Автоматически" }, { value: "assisted", label: "С подтверждением" }, { value: "manual", label: "Только вручную" }]} />
        </Field>
        <Field label="Степень сжатия" hint="Лёгкая ≈ 45% исходного объёма, средняя ≈ 25%, сильная ≈ 12% (для контекста 4K).">
          <Select value={m.compression} onChange={(v) => update("memory.compression", v)} options={[{ value: "light", label: "Лёгкая (больше деталей)" }, { value: "medium", label: "Средняя" }, { value: "strong", label: "Сильная (минимум токенов)" }]} />
        </Field>
        <Slider label="Порог запуска" min={0.4} max={1} step={0.05} value={m.triggerRatio} onChange={(v) => update("memory.triggerRatio", v)} fmt={(n) => `${Math.round(n * 100)}% бюджета истории`} hint="Когда несжатая история занимает столько своего бюджета — запускается сжатие." />
        <Field label="Свежих ходов не трогать" hint="Последние N ходов всегда остаются дословно.">
          <NumInput value={m.keepRecentTurns} min={1} max={20} onChange={(v) => update("memory.keepRecentTurns", v)} />
        </Field>
        <Field label="Записей блокнота за ход" hint="Сколько самых релевантных записей читает мастер (кроме закреплённых и последней сцены).">
          <NumInput value={m.notebookTopK} min={1} max={30} onChange={(v) => update("memory.notebookTopK", v)} />
        </Field>
        <div className="space-y-1">
          <Toggle value={m.useModel} onChange={(v) => update("memory.useModel", v)} label="Сжимать нейросетью" hint="Выкл. — алгоритмическое извлечение ключевых предложений (мгновенно и бесплатно)." />
          <Toggle value={m.mergeChapters} onChange={(v) => update("memory.mergeChapters", v)} label="Многоуровневый блокнот" hint="Сцены → главы → хроника: старое сжимается ещё сильнее, а не теряется." />
        </div>
      </div>
      <Field label="Что можно удалять" hint="Через запятую или по строкам. Это попадает в инструкцию сжатия.">
        <TextArea value={m.mayDrop} onChange={(e) => update("memory.mayDrop", e.target.value)} />
      </Field>
      <Field label="Что нельзя терять при сжатии">
        <TextArea value={m.mustKeep} onChange={(e) => update("memory.mustKeep", e.target.value)} />
      </Field>
      <Field label="Какие детали оставлять">
        <TextArea value={m.keepDetails} onChange={(e) => update("memory.keepDetails", e.target.value)} />
      </Field>
      <Field label="НИКОГДА не забывать (по одному факту в строке)" hint="Эти факты всегда попадают в контекст и передаются сжимающей модели как неприкосновенные.">
        <TextArea rows={4} value={m.neverForget.join("\n")} onChange={(e) => update("memory.neverForget", e.target.value.split("\n"))} />
      </Field>
    </div>
  );
}
