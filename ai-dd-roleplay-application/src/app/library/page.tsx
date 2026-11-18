"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, del, patch, post } from "@/lib/client/api";
import { Badge, Btn, Card, Field, Modal, Select, Tabs, TextArea, TextInput, Toggle } from "@/components/ui";
import { CharacterForm, type PlayerRow } from "@/components/CharacterForm";

interface Lib { id: number; kind: string; title: string; source: string; edition: string; content: string; compact: string; builtin: boolean; contentLength: number; compactLength: number }
interface World { id: number; name: string; description: string }
interface Adv { id: number; name: string }

const KINDS: Record<string, string> = { rulebook: "Книга правил", world: "Мир (текст)", plot: "Сюжет", character: "Персонаж (текст)", note: "Заметка" };

export default function LibraryPage() {
  const [items, setItems] = useState<Lib[]>([]);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [advs, setAdvs] = useState<Adv[]>([]);
  const [tpls, setTpls] = useState<(PlayerRow & { id: number })[]>([]);
  const [mode, setMode] = useState<"rulebook" | "lore" | "text">("rulebook");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [edition, setEdition] = useState("2014");
  const [adapt, setAdapt] = useState<"algo" | "ai">("algo");
  const [kind, setKind] = useState("plot");
  const [target, setTarget] = useState("");
  const [deep, setDeep] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [view, setView] = useState<Lib | null>(null);
  const [viewFull, setViewFull] = useState<Lib | null>(null);
  const [newWorld, setNewWorld] = useState({ name: "", description: "" });
  const [tplForm, setTplForm] = useState<{ open: boolean; p: (PlayerRow & { id: number }) | null }>({ open: false, p: null });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setItems(await api<Lib[]>("/api/db/library"));
    setWorlds(await api<World[]>("/api/db/worlds"));
    setAdvs(await api<Adv[]>("/api/adventures"));
    setTpls(await api<(PlayerRow & { id: number })[]>("/api/db/players?templates=1"));
  };
  useEffect(() => {
    load();
  }, []);

  const run = async () => {
    setBusy(true);
    setMsg("");
    try {
      if (mode === "rulebook") {
        const r = await post<{ sections: number; chars: number; compactChars: number }>("/api/import", { mode: "rulebook", title, url: url || undefined, text, edition, adapt });
        setMsg(`Книга загружена: ${r.sections} разделов, ${r.chars} → ${r.compactChars} символов после адаптации для ИИ.`);
      } else if (mode === "lore") {
        const [kindT, id] = target.split(":");
        const r = await post<{ created: number; relations: number; chunks: number }>("/api/import", { mode: "lore", text, url: url || undefined, deep, worldId: kindT === "w" ? Number(id) : kindT === "a" ? worlds[0]?.id ?? null : null, adventureId: kindT === "a" ? Number(id) : null });
        setMsg(`Создано карточек: ${r.created}, связей: ${r.relations}.`);
      } else {
        await post("/api/import", { mode: "library", kind, title, url: url || undefined, text });
        setMsg("Сохранено в библиотеку.");
      }
      setText("");
      setUrl("");
      setTitle("");
      await load();
    } catch (e) {
      setMsg("Ошибка: " + (e instanceof Error ? e.message : String(e)));
    }
    setBusy(false);
  };

  const openFull = async (it: Lib) => {
    const rows = await api<Lib[]>(`/api/db/library?full=1`);
    setViewFull(rows.find((r) => r.id === it.id) ?? it);
    setView(it);
  };

  return (
    <div className="font-ui mx-auto max-w-6xl p-4 md:p-8">
      <Link href="/" className="text-sm text-amber-300 hover:underline">← К приключениям</Link>
      <h1 className="mb-6 font-serif text-3xl text-amber-100">Библиотека</h1>

      <Card className="mb-8 space-y-3">
        <h2 className="text-lg font-semibold text-amber-100">Загрузить данные</h2>
        <Tabs<"rulebook" | "lore" | "text"> value={mode} onChange={setMode} tabs={[{ key: "rulebook", label: "Книга правил мастера" }, { key: "lore", label: "Мир / лор → в базу знаний (ИИ)" }, { key: "text", label: "Сюжет, заметка, мир (как текст)" }]} />
        <div className="grid gap-3 md:grid-cols-2">
          {mode !== "lore" && <Field label="Название"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} /></Field>}
          {mode === "rulebook" && (
            <>
              <Field label="Редакция"><Select value={edition} onChange={setEdition} options={[{ value: "2014", label: "2014" }, { value: "2024", label: "2024" }, { value: "", label: "Любая / свои правила" }]} /></Field>
              <Field label="Как адаптировать для ИИ" hint="Алгоритм: разбивка на разделы, сжатие, ключевые слова — мгновенно. Нейросеть: переписывает в телеграфный стиль, точнее, но дольше."><Select value={adapt} onChange={(v) => setAdapt(v as "algo" | "ai")} options={[{ value: "algo", label: "Алгоритм (быстро, без модели)" }, { value: "ai", label: "Нейросеть (качественнее)" }]} /></Field>
            </>
          )}
          {mode === "lore" && (
            <>
              <Field label="Куда добавить карточки"><Select value={target} onChange={setTarget} options={[{ value: "", label: "— выбрать —" }, ...worlds.map((w) => ({ value: `w:${w.id}`, label: `Мир: ${w.name}` })), ...advs.map((a) => ({ value: `a:${a.id}`, label: `Приключение: ${a.name}` }))]} /></Field>
              <Toggle value={deep} onChange={setDeep} label="Глубокий анализ" hint="Мелкие NPC, слухи, тайны, связи; больше запросов к модели." />
            </>
          )}
          {mode === "text" && <Field label="Тип"><Select value={kind} onChange={setKind} options={Object.entries(KINDS).filter(([k]) => k !== "rulebook").map(([k, v]) => ({ value: k, label: v }))} /></Field>}
          <Field label="Ссылка на страницу (открытые сайты, вики, SRD)" className="md:col-span-2"><TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></Field>
          <Field label="Текст" className="md:col-span-2" hint="Вставьте или загрузите файл .txt / .md / .html / .json. PDF: скопируйте текст.">
            <TextArea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".txt,.md,.json,.html,.htm,text/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setText(await f.text()); if (!title) setTitle(f.name.replace(/\.[^.]+$/, "")); } }} />
          <Btn onClick={() => fileRef.current?.click()}>Выбрать файл…</Btn>
          <Btn variant="primary" disabled={busy || (!text && !url) || (mode === "lore" && !target)} onClick={run}>{busy ? "Обработка…" : "Загрузить"}</Btn>
          {msg && <span className="text-sm text-amber-200">{msg}</span>}
        </div>
      </Card>

      <h2 className="mb-3 text-xl text-amber-100">Книги и материалы</h2>
      <div className="mb-8 grid gap-2 md:grid-cols-2">
        {items.map((it) => (
          <Card key={it.id} className="!p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-stone-100">{it.title}</div>
                <div className="mt-1 flex flex-wrap gap-1"><Badge tone="amber">{KINDS[it.kind] ?? it.kind}</Badge>{it.edition && <Badge>5e {it.edition}</Badge>}{it.builtin && <Badge tone="green">встроено</Badge>}<Badge>{it.contentLength} симв.</Badge>{it.compactLength > 0 && <Badge tone="blue">для ИИ: {it.compactLength}</Badge>}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Btn onClick={() => openFull(it)}>Открыть</Btn>
                {!it.builtin && <Btn variant="danger" onClick={async () => { if (confirm("Удалить?")) { await del(`/api/db/library?id=${it.id}`); load(); } }}>×</Btn>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 text-xl text-amber-100">Миры</h2>
      <div className="mb-8 grid gap-2 md:grid-cols-2">
        {worlds.map((w) => (
          <Card key={w.id} className="!p-3">
            <div className="flex items-center justify-between">
              <div><div className="font-semibold text-stone-100">{w.name}</div><p className="line-clamp-2 text-xs text-stone-400">{w.description}</p></div>
              <div className="flex gap-1"><Link href={`/worlds/${w.id}`}><Btn>Редактор</Btn></Link><Btn variant="danger" onClick={async () => { if (confirm(`Удалить мир «${w.name}»?`)) { await del(`/api/db/worlds?id=${w.id}`); load(); } }}>×</Btn></div>
            </div>
          </Card>
        ))}
        <Card className="!p-3">
          <div className="grid gap-2">
            <TextInput placeholder="Название нового мира" value={newWorld.name} onChange={(e) => setNewWorld({ ...newWorld, name: e.target.value })} />
            <TextArea rows={2} placeholder="Краткое описание" value={newWorld.description} onChange={(e) => setNewWorld({ ...newWorld, description: e.target.value })} />
            <Btn disabled={!newWorld.name.trim()} onClick={async () => { await post("/api/db/worlds", newWorld); setNewWorld({ name: "", description: "" }); load(); }}>+ Создать мир</Btn>
          </div>
        </Card>
      </div>

      <h2 className="mb-3 text-xl text-amber-100">Готовые персонажи (шаблоны)</h2>
      <div className="grid gap-2 md:grid-cols-3">
        {tpls.map((t) => (
          <Card key={t.id} className="!p-3"><button className="w-full text-left" onClick={() => setTplForm({ open: true, p: t })}><div className="font-semibold text-stone-100">{t.name}</div><div className="text-xs text-stone-400">{t.race} {t.className} · ур. {t.level}</div></button></Card>
        ))}
        <Card className="grid place-items-center !p-3"><Btn onClick={() => setTplForm({ open: true, p: null })}>+ Создать персонажа</Btn></Card>
      </div>
      <CharacterForm open={tplForm.open} onClose={() => setTplForm({ open: false, p: null })} adventureId={null} initial={tplForm.p} onSaved={load} />

      <Modal open={!!view} onClose={() => { setView(null); setViewFull(null); }} wide title={view?.title ?? ""} footer={viewFull && !viewFull.builtin ? <Btn variant="primary" onClick={async () => { await patch(`/api/db/library?id=${viewFull.id}`, { compact: viewFull.compact, title: viewFull.title }); setView(null); load(); }}>Сохранить версию для ИИ</Btn> : undefined}>
        {viewFull && (
          <div className="space-y-3">
            <Field label="Версия для ИИ (разделы «## Название | kw: слова»)" hint="Мастер подтягивает только разделы, ключевые слова которых встретились в игре, — весь текст не грузится в контекст.">
              <TextArea rows={14} value={viewFull.compact || "(адаптация не выполнена — используется оригинал)"} readOnly={viewFull.builtin} onChange={(e) => setViewFull({ ...viewFull, compact: e.target.value })} />
            </Field>
            <details><summary className="cursor-pointer text-sm text-stone-400">Оригинал</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-xs text-stone-300">{viewFull.content.slice(0, 20000)}</pre></details>
          </div>
        )}
      </Modal>
    </div>
  );
}
