"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, del, patch, post } from "@/lib/client/api";
import { Badge, Btn, Field, Modal, Select, Tabs, TextArea, TextInput, Toggle } from "./ui";
import { ImageField } from "./ImagePicker";

export interface EntityRow {
  id: number;
  worldId: number | null;
  adventureId: number | null;
  type: string;
  name: string;
  aliases: string;
  triggers: string;
  mode: string;
  description: string;
  compact: string;
  secrets: string;
  knowledge: string;
  history: string;
  status: string;
  parentId: number | null;
  image: string;
  locked: boolean;
  neverForget: boolean;
}
interface Rel {
  id: number;
  fromId: number;
  toId: number;
  label: string;
  note: string;
}

const TYPES = [
  { key: "all", label: "Все" },
  { key: "character", label: "Персонажи" },
  { key: "location", label: "Локации" },
  { key: "faction", label: "Фракции" },
  { key: "quest", label: "Квесты" },
  { key: "rumor", label: "Слухи" },
  { key: "item", label: "Предметы" },
  { key: "event", label: "События" },
];
const MODES = [
  { value: "trigger", label: "По триггерам — подтягивается, когда названо" },
  { value: "always", label: "Всегда — всегда в памяти модели" },
  { value: "logic", label: "По логике — ИИ сам вспоминает по ситуации" },
  { value: "off", label: "Выключено" },
];
const MODE_BADGE: Record<string, { t: string; tone: "amber" | "green" | "blue" | "stone" }> = {
  trigger: { t: "триггер", tone: "amber" },
  always: { t: "всегда", tone: "green" },
  logic: { t: "логика", tone: "blue" },
  off: { t: "выкл", tone: "stone" },
};

const blank = (type = "character"): Partial<EntityRow> => ({ type, name: "", aliases: "", triggers: "", mode: type === "quest" ? "always" : "trigger", description: "", compact: "", secrets: "", knowledge: "", history: "", status: "", parentId: null, image: "", locked: false, neverForget: false });

export function KnowledgePanel({ adventureId, worldId, reloadKey = 0, onChanged }: { adventureId: number | null; worldId: number | null; reloadKey?: number; onChanged?: () => void }) {
  const [ents, setEnts] = useState<EntityRow[]>([]);
  const [rels, setRels] = useState<Rel[]>([]);
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Partial<EntityRow> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [imp, setImp] = useState(false);
  const [impText, setImpText] = useState("");
  const [impUrl, setImpUrl] = useState("");
  const [impDeep, setImpDeep] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const scope = adventureId ? `adventureId=${adventureId}` : `worldId=${worldId}`;

  const load = useCallback(async () => {
    const [e, r] = await Promise.all([api<EntityRow[]>(`/api/db/entities?${scope}`), api<Rel[]>(`/api/db/relations?${scope}`)]);
    setEnts(e.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)));
    setRels(r);
  }, [scope]);
  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const save = async () => {
    if (!edit?.name?.trim()) return;
    const body = { ...edit, worldId, adventureId };
    if (edit.id) await patch(`/api/db/entities?id=${edit.id}`, body);
    else await post("/api/db/entities", body);
    setEdit(null);
    await load();
    onChanged?.();
  };
  const remove = async (id: number) => {
    if (!confirm("Удалить карточку и её связи?")) return;
    await del(`/api/db/entities?id=${id}`);
    setEdit(null);
    await load();
    onChanged?.();
  };
  const optimize = async () => {
    if (!edit?.description) return;
    setBusy(true);
    setMsg("");
    try {
      const st = await api<{ language: { internal: string } }>("/api/settings");
      const r = await post<{ items?: string[]; error?: string }>("/api/tools", { op: "translate", texts: [edit.description, edit.secrets ?? "", edit.knowledge ?? ""], to: st.language.internal, compress: true });
      if (r.items) setEdit({ ...edit, compact: r.items[0] });
      else setMsg(r.error ?? "Не удалось");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };
  const runImport = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await post<{ created: number; relations: number; chunks: number }>("/api/import", { mode: "lore", text: impText, url: impUrl || undefined, adventureId, worldId, deep: impDeep });
      setMsg(`Готово: создано карточек ${r.created}, связей ${r.relations} (обработано фрагментов: ${r.chunks}).`);
      setImpText("");
      setImpUrl("");
      await load();
      onChanged?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  const list = ents.filter((e) => (type === "all" || e.type === type) && (!q || (e.name + e.description + e.triggers).toLowerCase().includes(q.toLowerCase())));
  const nameOf = (id: number) => ents.find((e) => e.id === id)?.name ?? "?";
  const myRels = edit?.id ? rels.filter((r) => r.fromId === edit.id || r.toId === edit.id) : [];
  const [relTo, setRelTo] = useState("");
  const [relLabel, setRelLabel] = useState("");

  return (
    <div className="font-ui space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <TextInput placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-[180px]" />
        <Btn variant="primary" onClick={() => setEdit(blank(type === "all" ? "character" : type))}>+ Карточка</Btn>
        <Btn onClick={() => setImp(!imp)}>Загрузить текст…</Btn>
      </div>
      <Tabs tabs={TYPES} value={type} onChange={setType} small />
      {imp && (
        <div className="space-y-2 rounded-lg border border-stone-700 bg-stone-900/60 p-3">
          <p className="text-xs text-stone-400">ИИ прочитает текст (страницу сайта, заметки, книгу мира) и создаст карточки персонажей, локаций, фракций, квестов, слухов и связей.</p>
          <TextInput placeholder="Ссылка на страницу (необязательно)" value={impUrl} onChange={(e) => setImpUrl(e.target.value)} />
          <TextArea rows={4} placeholder="…или вставьте текст" value={impText} onChange={(e) => setImpText(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept=".txt,.md,.json,.html,.htm" hidden onChange={async (e) => e.target.files?.[0] && setImpText(await e.target.files[0].text())} />
            <Btn onClick={() => fileRef.current?.click()}>Файл (.txt .md .html)…</Btn>
            <Toggle value={impDeep} onChange={setImpDeep} label="Глубокий анализ" hint="Мелкие NPC, слухи, тайны, связи" />
            <Btn variant="primary" onClick={runImport} disabled={busy || (!impText && !impUrl)}>{busy ? "Анализ…" : "Разобрать в базу"}</Btn>
          </div>
        </div>
      )}
      {msg && <p className="text-sm text-amber-200">{msg}</p>}
      <div className="space-y-1.5">
        {list.length === 0 && <p className="py-6 text-center text-sm text-stone-500">Карточек пока нет.</p>}
        {list.map((e) => (
          <button key={e.id} onClick={() => setEdit(e)} className="flex w-full items-center gap-2 rounded-lg border border-stone-800 bg-stone-900/50 p-2 text-left hover:border-amber-700">
            {e.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.image} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
            ) : (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded bg-stone-800 text-lg">{{ character: "🧙", location: "🏰", faction: "⚑", quest: "📜", rumor: "👂", item: "🗡", event: "⚡" }[e.type] ?? "•"}</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-stone-100">{e.name}</span>
                <Badge tone={MODE_BADGE[e.mode]?.tone}>{MODE_BADGE[e.mode]?.t}</Badge>
                {e.locked && <Badge>🔒</Badge>}
                {e.neverForget && <Badge tone="red">не забывать</Badge>}
              </div>
              <div className="truncate text-xs text-stone-400">{e.status ? `${e.status} · ` : ""}{e.description || e.compact}</div>
            </div>
          </button>
        ))}
      </div>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        wide
        title={edit?.id ? `Карточка: ${edit.name}` : "Новая карточка"}
        footer={
          <>
            {edit?.id && <Btn variant="danger" onClick={() => remove(edit.id!)}>Удалить</Btn>}
            <Btn onClick={() => setEdit(null)}>Отмена</Btn>
            <Btn variant="primary" onClick={save}>Сохранить</Btn>
          </>
        }
      >
        {edit && (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Имя / название"><TextInput value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Тип"><Select value={edit.type ?? "character"} onChange={(v) => setEdit({ ...edit, type: v })} options={TYPES.filter((t) => t.key !== "all").map((t) => ({ value: t.key, label: t.label }))} /></Field>
            <Field label="Режим подтягивания" className="md:col-span-2" hint="Триггер: слова ниже в сообщениях → ИИ читает карточку (при размышлении сам решает, подтягивать ли). Логика: ИИ оценивает ситуацию и вспоминает подходящее.">
              <Select value={edit.mode ?? "trigger"} onChange={(v) => setEdit({ ...edit, mode: v })} options={MODES} />
            </Field>
            <Field label="Триггерные слова (через запятую)"><TextInput value={edit.triggers ?? ""} onChange={(e) => setEdit({ ...edit, triggers: e.target.value })} placeholder="кузнец, Борин, кузница" /></Field>
            <Field label="Другие имена / прозвища"><TextInput value={edit.aliases ?? ""} onChange={(e) => setEdit({ ...edit, aliases: e.target.value })} /></Field>
            <Field label="Описание (для вас, на родном языке)" className="md:col-span-2"><TextArea rows={4} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="Версия для ИИ (кратко, внутренний язык)" className="md:col-span-2" hint="Пусто — ИИ читает обычное описание. Кнопка ниже сжимает и переводит автоматически.">
              <TextArea rows={3} value={edit.compact ?? ""} onChange={(e) => setEdit({ ...edit, compact: e.target.value })} />
              <Btn className="mt-1" onClick={optimize} disabled={busy || !edit.description}>{busy ? "…" : "⚡ Оптимизировать для ИИ"}</Btn>
            </Field>
            <Field label="Текущее состояние"><TextInput value={edit.status ?? ""} onChange={(e) => setEdit({ ...edit, status: e.target.value })} placeholder="ранен, враждебен, в пути…" /></Field>
            <Field label="Родительская локация">
              <Select value={String(edit.parentId ?? "")} onChange={(v) => setEdit({ ...edit, parentId: v ? Number(v) : null })} options={[{ value: "", label: "— нет —" }, ...ents.filter((x) => x.type === "location" && x.id !== edit.id).map((x) => ({ value: String(x.id), label: x.name }))]} />
            </Field>
            <Field label="Тайны (знает только мастер)"><TextArea rows={2} value={edit.secrets ?? ""} onChange={(e) => setEdit({ ...edit, secrets: e.target.value })} /></Field>
            <Field label="Что знает персонаж / слухи" hint="Отделяет знания героя от истории мира."><TextArea rows={2} value={edit.knowledge ?? ""} onChange={(e) => setEdit({ ...edit, knowledge: e.target.value })} /></Field>
            <Field label="Карточка истории (как пришёл к состоянию)" className="md:col-span-2"><TextArea rows={2} value={edit.history ?? ""} onChange={(e) => setEdit({ ...edit, history: e.target.value })} /></Field>
            <ImageField value={edit.image ?? ""} onChange={(v) => setEdit({ ...edit, image: v })} />
            <div>
              <Toggle value={!!edit.locked} onChange={(v) => setEdit({ ...edit, locked: v })} label="Защитить от изменений ИИ" />
              <Toggle value={!!edit.neverForget} onChange={(v) => setEdit({ ...edit, neverForget: v })} label="Никогда не забывать" hint="Приоритет при нехватке бюджета." />
            </div>
            {edit.id && (
              <div className="md:col-span-2">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-amber-200/80">Отношения</span>
                <div className="space-y-1">
                  {myRels.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 text-sm">
                      <span>{nameOf(r.fromId)} → <b>{r.label}</b> → {nameOf(r.toId)}</span>
                      <Btn variant="ghost" onClick={async () => { await del(`/api/db/relations?id=${r.id}`); load(); }}>×</Btn>
                    </div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Select value={relTo} onChange={setRelTo} options={[{ value: "", label: "С кем связан…" }, ...ents.filter((x) => x.id !== edit.id).map((x) => ({ value: String(x.id), label: x.name }))]} />
                  <TextInput placeholder="Связь: брат, должник, враг…" value={relLabel} onChange={(e) => setRelLabel(e.target.value)} />
                  <Btn onClick={async () => { if (!relTo || !relLabel) return; await post("/api/db/relations", { worldId, adventureId, fromId: edit.id, toId: Number(relTo), label: relLabel }); setRelLabel(""); load(); }}>Добавить</Btn>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
