"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, del, post } from "@/lib/client/api";
import type { Settings } from "@/lib/config";
import { EDITIONS } from "@/lib/dnd/data";
import { Badge, Btn, Card, Field, Modal, Select, TextArea, TextInput, Toggle } from "@/components/ui";

interface AdvItem { id: number; name: string; edition: string; turn: number; world: string; players: string[]; updatedAt: string }
interface WorldItem { id: number; name: string; description: string; tone: string }
interface LibItem { id: number; title: string; kind: string; edition: string; builtin: boolean }
interface TplPlayer { id: number; name: string; race: string; className: string; level: number }

export default function Home() {
  const router = useRouter();
  const [advs, setAdvs] = useState<AdvItem[]>([]);
  const [worlds, setWorlds] = useState<WorldItem[]>([]);
  const [books, setBooks] = useState<LibItem[]>([]);
  const [tpls, setTpls] = useState<TplPlayer[]>([]);
  const [open, setOpen] = useState(false);
  const [conn, setConn] = useState<"checking" | "ok" | "fail">("checking");
  const [connMsg, setConnMsg] = useState("");
  const [form, setForm] = useState({ name: "", worldId: "", edition: "2014", chatStyle: "narrative", premise: "", opening: "", rulebookIds: [] as number[], playerTemplateIds: [] as number[] });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setAdvs(await api<AdvItem[]>("/api/adventures"));
    setWorlds(await api<WorldItem[]>("/api/db/worlds"));
    setBooks(await api<LibItem[]>("/api/db/library?kind=rulebook"));
    setTpls(await api<TplPlayer[]>("/api/db/players?templates=1"));
  };
  useEffect(() => {
    load();
    api<Settings>("/api/settings").then(async (s) => {
      const r = s.routes.gm;
      const p = s.providers.find((x) => x.id === r?.providerId) ?? s.providers[0];
      if (!p) return setConn("fail");
      const t = await post<{ ok: boolean; error?: string; models: string[] }>("/api/settings", { provider: p });
      setConn(t.ok ? "ok" : "fail");
      setConnMsg(t.ok ? `${p.name}: ${t.models.length} моделей` : (t.error ?? ""));
    });
  }, []);

  const create = async () => {
    setBusy(true);
    const r = await post<{ id: number }>("/api/adventures", { ...form, worldId: form.worldId ? Number(form.worldId) : null, rulebookIds: form.rulebookIds.length ? form.rulebookIds : undefined });
    setBusy(false);
    router.push(`/play/${r.id}`);
  };
  const edBooks = books.filter((b) => !b.edition || b.edition === form.edition);

  return (
    <div className="font-ui mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl text-amber-100">🎲 Летописец</h1>
          <p className="mt-1 text-stone-400">ИИ-мастер D&D 5e с долгой памятью, базой знаний и честными кубиками.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/library"><Btn>📚 Библиотека</Btn></Link>
          <Link href="/settings"><Btn>⚙ Настройки</Btn></Link>
          <Btn variant="primary" onClick={() => setOpen(true)}>+ Новое приключение</Btn>
        </div>
      </header>

      {conn === "fail" && (
        <Card className="mb-6 border-amber-800 bg-amber-950/30">
          <p className="text-amber-100">ИИ не подключён. {connMsg}</p>
          <p className="mt-1 text-sm text-stone-300">Откройте <Link href="/settings" className="text-amber-300 underline">Настройки → Подключение ИИ</Link>: запустите LM Studio (Local Server) или вставьте API-ключ облачного сервиса.</p>
        </Card>
      )}
      {conn === "ok" && <p className="mb-4 text-xs text-emerald-400">● ИИ подключён — {connMsg}</p>}

      <h2 className="mb-3 text-xl text-amber-100">Приключения</h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {advs.length === 0 && <p className="text-stone-500">Пока пусто. Создайте первое приключение — мир и правила выбираются в пару кликов.</p>}
        {advs.map((a) => (
          <Card key={a.id} className="transition hover:border-amber-700">
            <Link href={`/play/${a.id}`} className="block">
              <div className="font-serif text-xl text-amber-100">{a.name}</div>
              <div className="mt-1 flex flex-wrap gap-1"><Badge tone="amber">5e {a.edition}</Badge><Badge>{a.world}</Badge><Badge>ходов: {a.turn}</Badge></div>
              <div className="mt-2 text-sm text-stone-400">{a.players.length ? a.players.join(", ") : "без героев"}</div>
            </Link>
            <div className="mt-2 text-right"><Btn variant="ghost" onClick={async () => { if (confirm(`Удалить «${a.name}»?`)) { await del(`/api/adventures/${a.id}`); load(); } }}>Удалить</Btn></div>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 mt-10 text-xl text-amber-100">Миры</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {worlds.map((w) => (
          <Link key={w.id} href={`/worlds/${w.id}`}>
            <Card className="h-full transition hover:border-amber-700">
              <div className="font-serif text-lg text-amber-100">{w.name}</div>
              <p className="mt-1 line-clamp-3 text-sm text-stone-400">{w.description}</p>
              {w.tone && <p className="mt-1 text-xs text-stone-500">Тон: {w.tone}</p>}
            </Card>
          </Link>
        ))}
        <Card className="grid place-items-center border-dashed"><Link href="/library" className="text-amber-300 hover:underline">+ Создать или загрузить мир в «Библиотеке»</Link></Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} wide title="Новое приключение" footer={<><Btn onClick={() => setOpen(false)}>Отмена</Btn><Btn variant="primary" disabled={busy || !form.name.trim()} onClick={create}>{busy ? "Создаю…" : "Начать игру"}</Btn></>}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Название"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Туман над Серым Причалом" /></Field>
          <Field label="Мир" hint="Карточки мира будут скопированы в приключение — игра не изменит оригинал."><Select value={form.worldId} onChange={(v) => setForm({ ...form, worldId: v })} options={[{ value: "", label: "— без мира (пустая база) —" }, ...worlds.map((w) => ({ value: String(w.id), label: w.name }))]} /></Field>
          <Field label="Редакция правил" hint={EDITIONS.find((e) => e.key === form.edition)?.note}><Select value={form.edition} onChange={(v) => setForm({ ...form, edition: v, rulebookIds: [] })} options={EDITIONS.map((e) => ({ value: e.key, label: e.name }))} /></Field>
          <Field label="Стиль общения"><Select value={form.chatStyle} onChange={(v) => setForm({ ...form, chatStyle: v })} options={[{ value: "narrative", label: "Повествование" }, { value: "mixed", label: "Повествование + диалоги" }, { value: "group", label: "Групповой чат с NPC" }]} /></Field>
          <div className="md:col-span-2">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-amber-200/80">Книги правил мастера (адаптированы для ИИ)</span>
            {edBooks.map((b) => {
              const sel = form.rulebookIds.length ? form.rulebookIds.includes(b.id) : b.builtin && b.edition === form.edition;
              return <Toggle key={b.id} value={sel} onChange={(v) => { const base = form.rulebookIds.length ? form.rulebookIds : edBooks.filter((x) => x.builtin && x.edition === form.edition).map((x) => x.id); setForm({ ...form, rulebookIds: v ? [...new Set([...base, b.id])] : base.filter((x) => x !== b.id) }); }} label={b.title} hint={b.builtin ? "встроенная" : "загружена вами"} />;
            })}
          </div>
          <Field label="Сюжет / завязка (пусто — возьмётся из мира)" className="md:col-span-2"><TextArea value={form.premise} onChange={(e) => setForm({ ...form, premise: e.target.value })} /></Field>
          <Field label="Вступительная сцена (пусто — возьмётся из мира)" className="md:col-span-2"><TextArea value={form.opening} onChange={(e) => setForm({ ...form, opening: e.target.value })} /></Field>
          {tpls.length > 0 && (
            <div className="md:col-span-2">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-amber-200/80">Готовые персонажи из библиотеки</span>
              {tpls.map((t) => <Toggle key={t.id} value={form.playerTemplateIds.includes(t.id)} onChange={(v) => setForm({ ...form, playerTemplateIds: v ? [...form.playerTemplateIds, t.id] : form.playerTemplateIds.filter((x) => x !== t.id) })} label={`${t.name} — ${t.race} ${t.className}, ур. ${t.level}`} />)}
            </div>
          )}
          <p className="text-xs text-stone-400 md:col-span-2">Героев можно создать уже в игре — кнопка «+ Игрок» слева. Несколько игроков — несколько карточек.</p>
        </div>
      </Modal>
    </div>
  );
}
