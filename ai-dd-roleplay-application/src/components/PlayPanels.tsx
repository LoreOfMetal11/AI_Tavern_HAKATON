"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, del, patch, post } from "@/lib/client/api";
import { useSettings } from "@/lib/client/useSettings";
import type { AdvData, CtxReport, Mem, Msg, SceneData } from "@/lib/client/types";
import { Badge, Bar, Btn, Field, NumInput, Select, TextArea, TextInput, Toggle } from "./ui";
import { MemoryPolicy } from "./MemoryPolicy";

const LEVEL = ["Сцена", "Глава", "Хроника"];

/* ---------------- Блокнот памяти ---------------- */
export function MemoryPanel({ advId, data, reload }: { advId: number; data: AdvData; reload: () => void }) {
  const { s, update } = useSettings();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [draft, setDraft] = useState<{ content: string; fromTurn: number; toTurn: number; messageIds: number[]; sourceTokens: number; usedModel: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [view, setView] = useState<Record<number, string>>({});
  const st = data.stats;

  const act = async (body: object) => {
    setBusy(true);
    setMsg("");
    try {
      return await post<Record<string, unknown>>(`/api/adventures/${advId}/memory`, body);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  };
  const translate = async (m: Mem) => {
    const r = await post<{ items?: string[] }>("/api/tools", { op: "translate", texts: [m.content], to: s.language.narration }).catch(() => null);
    if (r?.items) setView((v) => ({ ...v, [m.id]: r.items![0] }));
  };

  return (
    <div className="font-ui space-y-3 text-sm">
      {st && (
        <div className="rounded-lg border border-stone-800 p-2">
          <div className="mb-1 flex justify-between text-xs text-stone-300">
            <span>Несжатая история: {st.messages} сообщ.</span>
            <span>{st.tokens} / {st.budget} ток.</span>
          </div>
          <Bar value={st.tokens} max={st.budget} tone={st.shouldCompact ? "red" : "green"} />
          <p className="mt-1 text-[11px] text-stone-400">{st.shouldCompact ? "Пора сжимать: история переполняет свой бюджет." : "Места достаточно."} Последние {s.memory.keepRecentTurns} ходов всегда остаются дословно.</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Btn variant="primary" disabled={busy} onClick={async () => { const r = await act({ action: "compact" }); if (r) { setMsg((r.note as string) ?? (r.usedModel ? "Сжато нейросетью" : "Сжато алгоритмом")); reload(); } }}>Сжать сейчас</Btn>
        <Btn disabled={busy} onClick={async () => { const r = await act({ action: "draft", force: true }); if (r) { if (r.draft) setDraft(r.draft as never); else setMsg("Пока нечего сжимать."); } }}>Предложить черновик</Btn>
        <Btn disabled={busy} onClick={async () => { await act({ action: "merge" }); reload(); }}>Слить в главы</Btn>
      </div>
      {busy && <p className="text-xs text-amber-300">Работаю…</p>}
      {msg && <p className="text-xs text-amber-200">{msg}</p>}
      {draft && (
        <div className="space-y-2 rounded-lg border border-amber-700 bg-amber-950/20 p-2">
          <p className="text-xs text-stone-300">Черновик сжатия ходов {draft.fromTurn}–{draft.toTurn} ({draft.sourceTokens} ток. → ~{Math.round(draft.content.length / 3)}). Отредактируйте и примите — только после этого сообщения будут помечены сжатыми.</p>
          <TextArea rows={6} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
          <div className="flex gap-2">
            <Btn variant="primary" onClick={async () => { await act({ action: "commit", draft }); setDraft(null); reload(); }}>Принять</Btn>
            <Btn onClick={() => setDraft(null)}>Отмена</Btn>
          </div>
        </div>
      )}
      <div className="rounded-lg border border-stone-800 p-2">
        <Field label="Вписать в блокнот (закрепляется навсегда)">
          <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: Кайра поклялась отомстить барону Вейну." />
        </Field>
        <Btn className="mt-1" disabled={!note.trim()} onClick={async () => { await act({ action: "add", content: note, locked: true }); setNote(""); reload(); }}>Записать</Btn>
      </div>
      <div className="space-y-2">
        {data.memories.length === 0 && <p className="py-4 text-center text-stone-500">Блокнот пуст — история ещё не сжималась.</p>}
        {data.memories.map((m) => (
          <div key={m.id} className={`rounded-lg border p-2 ${m.locked ? "border-amber-700" : "border-stone-800"}`}>
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <Badge tone="amber">{LEVEL[m.level] ?? "Запись"}</Badge>
              <Badge>ходы {m.fromTurn}–{m.toTurn}</Badge>
              <Badge>{m.tokens} ток.</Badge>
              <Badge tone={m.author === "user" ? "blue" : "stone"}>{m.author === "user" ? "вы" : m.kind === "fact" ? "факт ИИ" : "ИИ"}</Badge>
              <span className="ml-auto flex gap-1">
                <Btn variant="ghost" onClick={async () => { await patch(`/api/db/memories?id=${m.id}`, { locked: !m.locked }); reload(); }}>{m.locked ? "🔒" : "🔓"}</Btn>
                <Btn variant="ghost" onClick={() => translate(m)}>🌐</Btn>
                <Btn variant="ghost" onClick={() => { setEditId(m.id); setEditText(m.content); }}>✎</Btn>
                <Btn variant="ghost" onClick={async () => { if (confirm("Удалить запись из блокнота?")) { await del(`/api/db/memories?id=${m.id}`); reload(); } }}>🗑</Btn>
              </span>
            </div>
            {editId === m.id ? (
              <>
                <TextArea rows={5} value={editText} onChange={(e) => setEditText(e.target.value)} />
                <div className="mt-1 flex gap-2">
                  <Btn variant="primary" onClick={async () => { await patch(`/api/db/memories?id=${m.id}`, { content: editText }); setEditId(null); reload(); }}>Сохранить</Btn>
                  <Btn onClick={() => setEditId(null)}>Отмена</Btn>
                </div>
              </>
            ) : (
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-stone-200">{m.content}</p>
            )}
            {view[m.id] && <p className="mt-1 whitespace-pre-wrap rounded bg-stone-900 p-1.5 text-xs text-emerald-200">{view[m.id]}</p>}
          </div>
        ))}
      </div>
      <details className="rounded-lg border border-stone-800 p-2">
        <summary className="cursor-pointer text-amber-200">Политика сжатия и «нельзя забывать»</summary>
        <div className="mt-3"><MemoryPolicy s={s} update={update} /></div>
      </details>
    </div>
  );
}

/* ---------------- Что в контексте ---------------- */
export function ContextPanel({ advId, draft, actingIds, reloadKey }: { advId: number; draft: string; actingIds: number[]; reloadKey: number }) {
  const [rep, setRep] = useState<CtxReport | null>(null);
  const [mode, setMode] = useState<"last" | "preview">("last");
  const [open, setOpen] = useState<string | null>(null);
  const [raw, setRaw] = useState(false);
  const load = useCallback(async () => {
    if (mode === "last") setRep(await api<CtxReport | null>(`/api/adventures/${advId}/context`));
    else setRep(await post<CtxReport>(`/api/adventures/${advId}/context`, { draft, playerIds: actingIds }));
  }, [advId, mode, draft, actingIds]);
  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const groups: Record<string, string> = { system: "Системный промт и заметки", rules: "Правила", party: "Игроки и сцена", world: "Мир", lore: "Лорбук", memory: "Блокнот", history: "История" };
  return (
    <div className="font-ui space-y-3 text-sm">
      <div className="flex gap-2">
        <Btn variant={mode === "last" ? "primary" : "default"} onClick={() => setMode("last")}>Отправлено в последний раз</Btn>
        <Btn variant={mode === "preview" ? "primary" : "default"} onClick={() => setMode("preview")}>Предпросмотр сейчас</Btn>
      </div>
      {!rep && <p className="py-6 text-center text-stone-500">Контекст ещё не собирался: сделайте первый ход.</p>}
      {rep && (
        <>
          <div>
            <div className="flex justify-between text-xs text-stone-300"><span>Всего в запросе</span><span>{rep.totalTokens} / {rep.budget} ток.</span></div>
            <Bar value={rep.totalTokens} max={rep.budget} tone={rep.totalTokens > rep.budget ? "red" : "amber"} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(rep.limits).map(([k, v]) => (
              <div key={k} className="rounded border border-stone-800 p-1.5">
                <div className="flex justify-between text-[11px] text-stone-300"><span>{groups[k] ?? k}</span><span>{v.used}/{v.limit}</span></div>
                <Bar value={v.used} max={v.limit} tone={v.used > v.limit ? "red" : "green"} />
              </div>
            ))}
          </div>
          {rep.overflow ? <p className="text-xs text-amber-300">Не влезло в историю: {rep.overflow} старых сообщений (ждут сжатия в блокнот).</p> : null}
          {rep.candidates && (rep.candidates.triggered.length > 0 || rep.candidates.logic.length > 0) && (
            <p className="text-xs text-stone-300">Кандидаты: {[...rep.candidates.triggered.map((c) => `${c.name} (триггер)`), ...rep.candidates.logic.map((c) => `${c.name} (логика ${c.score.toFixed(1)})`)].join(", ")}</p>
          )}
          <div className="space-y-1">
            {rep.blocks.map((b) => (
              <div key={b.id} className={`rounded border text-xs ${b.included ? "border-stone-800" : "border-stone-900 opacity-60"}`}>
                <button onClick={() => setOpen(open === b.id ? null : b.id)} className="flex w-full items-center gap-1.5 p-1.5 text-left">
                  <span>{b.included ? "✅" : "⛔"}</span>
                  <span className="min-w-0 flex-1 truncate text-stone-100">{b.title}</span>
                  <Badge>{groups[b.group] ?? b.group}</Badge>
                  <span className="w-12 text-right text-stone-400">{b.tokens}</span>
                </button>
                <div className="px-1.5 pb-1 text-[11px] text-stone-400">{b.reason}</div>
                {open === b.id && b.text && <pre className="max-h-60 overflow-auto whitespace-pre-wrap border-t border-stone-800 p-1.5 text-[11px] text-stone-300">{b.text}</pre>}
              </div>
            ))}
          </div>
          <Toggle value={raw} onChange={setRaw} label="Показать итоговый промт целиком" hint="Ровно то, что получила модель." />
          {raw && rep.messages.map((m, i) => (
            <div key={i} className="rounded border border-stone-800">
              <div className="bg-stone-900 px-1.5 py-0.5 text-[10px] uppercase text-amber-300">{m.role}</div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap p-1.5 text-[11px] text-stone-300">{m.content}</pre>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ---------------- История ---------------- */
export function HistoryPanel({ advId, data, reload, onEdit, onDelete, onPin }: { advId: number; data: AdvData; reload: () => void; onEdit: (m: Msg) => void; onDelete: (m: Msg) => void; onPin: (m: Msg) => void }) {
  const [text, setText] = useState("");
  const names = new Map(data.players.map((p) => [p.id, p.name]));
  return (
    <div className="font-ui space-y-3 text-sm">
      <div className="rounded-lg border border-stone-800 p-2">
        <Field label="Вписать в историю (запись мастера)" hint="Появится в чате как сообщение мастера и станет частью канона.">
          <TextArea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <Btn className="mt-1" disabled={!text.trim()} onClick={async () => { await post(`/api/adventures/${advId}/messages`, { text, role: "assistant" }); setText(""); reload(); }}>Вписать</Btn>
      </div>
      <div className="space-y-1">
        {data.messages.map((m) => (
          <div key={m.id} className={`rounded border p-1.5 text-xs ${m.status !== "active" ? "border-stone-900 opacity-50" : m.pinned ? "border-amber-700" : "border-stone-800"}`}>
            <div className="mb-0.5 flex flex-wrap items-center gap-1">
              <Badge>ход {m.turn}</Badge>
              <Badge tone={m.role === "assistant" ? "amber" : "blue"}>{m.role === "assistant" ? "мастер" : names.get(m.playerId ?? -1) ?? "игрок"}</Badge>
              {m.status !== "active" && <Badge tone="red">{m.status === "deleted" ? "удалено" : "заменено"}</Badge>}
              {m.summarized && m.status === "active" && <Badge tone="green">в блокноте</Badge>}
              {m.pinned && <Badge tone="amber">закреплено</Badge>}
              {m.status === "active" && (
                <span className="ml-auto flex">
                  <Btn variant="ghost" onClick={() => onPin(m)}>📌</Btn>
                  <Btn variant="ghost" onClick={() => onEdit(m)}>✎</Btn>
                  <Btn variant="ghost" onClick={() => onDelete(m)}>🗑</Btn>
                </span>
              )}
            </div>
            <p className={`whitespace-pre-wrap text-stone-200 ${m.status !== "active" ? "line-through" : ""}`}>{m.content.length > 400 ? m.content.slice(0, 400) + "…" : m.content}</p>
          </div>
        ))}
      </div>
      <h4 className="pt-2 font-semibold text-amber-100">Журнал изменений карточек</h4>
      <p className="text-[11px] text-stone-400">При регенерации или удалении ответа его изменения откатываются автоматически.</p>
      <div className="space-y-1">
        {data.changes.length === 0 && <p className="text-stone-500">Пока без изменений.</p>}
        {data.changes.map((c) => (
          <div key={c.id} className={`flex items-center gap-1.5 rounded border border-stone-800 p-1 text-xs ${c.reverted ? "line-through opacity-50" : ""}`}>
            <Badge>ход {c.turn}</Badge>
            <Badge tone="blue">{({ player: "игрок", entity: "карточка", scene: "сцена", relation: "связь", memory: "память" } as Record<string, string>)[c.target] ?? c.target}</Badge>
            <span className="text-stone-200">{c.summary}</span>
            {c.reverted && <Badge tone="red">откат</Badge>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Приключение и сцена ---------------- */
interface LibRow { id: number; title: string; kind: string; edition: string }
export function AdventurePanel({ advId, data, reload, onDeleted }: { advId: number; data: AdvData; reload: () => void; onDeleted: () => void }) {
  const a = data.adventure;
  const [books, setBooks] = useState<LibRow[]>([]);
  const [name, setName] = useState(a.name);
  const [premise, setPremise] = useState(a.premise);
  const [scene, setScene] = useState<SceneData>(a.scene ?? {});
  const ov = a.overrides as { context?: { size?: number }; thinking?: { enabled?: boolean } };
  useEffect(() => {
    api<LibRow[]>("/api/db/library?kind=rulebook").then(setBooks);
  }, []);
  const save = async (p: object) => {
    await patch(`/api/adventures/${advId}`, p);
    reload();
  };
  const ids = (a.rulebookIds ?? []) as number[];
  return (
    <div className="font-ui space-y-4 text-sm">
      <Field label="Название"><TextInput value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== a.name && save({ name })} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Редакция D&D"><Select value={a.edition} onChange={(v) => save({ edition: v })} options={[{ value: "2014", label: "5e (2014)" }, { value: "2024", label: "5e (2024)" }]} /></Field>
        <Field label="Стиль общения"><Select value={a.chatStyle} onChange={(v) => save({ chatStyle: v })} options={[{ value: "narrative", label: "Повествование" }, { value: "mixed", label: "Повествование + диалоги" }, { value: "group", label: "Групповой чат NPC" }]} /></Field>
      </div>
      <Field label="Сюжет / завязка"><TextArea rows={4} value={premise} onChange={(e) => setPremise(e.target.value)} onBlur={() => premise !== a.premise && save({ premise, premiseCompact: "" })} /></Field>
      <div>
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-amber-200/80">Книги правил мастера</span>
        {books.map((b) => (
          <Toggle key={b.id} value={ids.includes(b.id)} onChange={(v) => save({ rulebookIds: v ? [...ids, b.id] : ids.filter((x) => x !== b.id) })} label={b.title} />
        ))}
        <Link href="/library" className="text-xs text-amber-300 hover:underline">Загрузить свою книгу →</Link>
      </div>
      <div className="rounded-lg border border-stone-800 p-2">
        <h4 className="mb-2 font-semibold text-amber-100">Сцена</h4>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Локация"><TextInput value={scene.location ?? ""} onChange={(e) => setScene({ ...scene, location: e.target.value })} /></Field>
          <Field label="Время"><TextInput value={scene.time ?? ""} onChange={(e) => setScene({ ...scene, time: e.target.value })} /></Field>
        </div>
        <Toggle value={!!scene.combat} onChange={(v) => setScene({ ...scene, combat: v, round: v ? scene.round ?? 1 : 0 })} label="Идёт бой" />
        {(scene.enemies ?? []).map((e, i) => (
          <div key={e.id} className="mt-1 grid grid-cols-[1fr_60px_60px_60px_auto] gap-1">
            <TextInput value={e.name} onChange={(ev) => setScene({ ...scene, enemies: scene.enemies!.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)) })} />
            <NumInput value={e.hp} onChange={(v) => setScene({ ...scene, enemies: scene.enemies!.map((x, j) => (j === i ? { ...x, hp: v } : x)) })} />
            <NumInput value={e.maxHp} onChange={(v) => setScene({ ...scene, enemies: scene.enemies!.map((x, j) => (j === i ? { ...x, maxHp: v } : x)) })} />
            <NumInput value={e.ac ?? 10} onChange={(v) => setScene({ ...scene, enemies: scene.enemies!.map((x, j) => (j === i ? { ...x, ac: v } : x)) })} />
            <Btn variant="ghost" onClick={() => setScene({ ...scene, enemies: scene.enemies!.filter((_, j) => j !== i) })}>×</Btn>
          </div>
        ))}
        <div className="mt-1 text-[10px] text-stone-500">враги: имя · ЗД · макс · КД</div>
        <div className="mt-2 flex gap-2">
          <Btn onClick={() => setScene({ ...scene, enemies: [...(scene.enemies ?? []), { id: "e" + Date.now(), name: "Враг", hp: 10, maxHp: 10, ac: 12 }] })}>+ Враг</Btn>
          <Btn variant="primary" onClick={() => save({ scene })}>Сохранить сцену</Btn>
        </div>
      </div>
      <div className="rounded-lg border border-stone-800 p-2">
        <h4 className="mb-2 font-semibold text-amber-100">Настройки только для этого приключения</h4>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Контекст модели (ток.)" hint="Пусто/0 = как в общих настройках"><NumInput value={ov.context?.size ?? 0} step={1024} onChange={(v) => save({ overrides: { ...a.overrides, context: v ? { size: v } : undefined } })} /></Field>
        </div>
        <Toggle value={!!ov.thinking?.enabled} onChange={(v) => save({ overrides: { ...a.overrides, thinking: { enabled: v } } })} label="Режим размышления" hint="Включить режиссёра только здесь." />
      </div>
      <Btn variant="danger" onClick={async () => { if (confirm("Удалить приключение со всей историей?")) { await del(`/api/adventures/${advId}`); onDeleted(); } }}>Удалить приключение</Btn>
    </div>
  );
}
