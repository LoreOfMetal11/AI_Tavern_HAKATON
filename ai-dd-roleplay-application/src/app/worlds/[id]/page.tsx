"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, patch } from "@/lib/client/api";
import { Btn, Card, Field, TextArea, TextInput } from "@/components/ui";
import { ImageField } from "@/components/ImagePicker";
import { KnowledgePanel } from "@/components/KnowledgePanel";

interface World { id: number; name: string; description: string; compact: string; tone: string; rules: string; image: string }

export default function WorldPage() {
  const { id } = useParams<{ id: string }>();
  const wid = Number(id);
  const [w, setW] = useState<World | null>(null);
  const [saved, setSaved] = useState("");
  useEffect(() => {
    api<World[]>("/api/db/worlds").then((l) => setW(l.find((x) => x.id === wid) ?? null));
  }, [wid]);
  if (!w) return <div className="font-ui p-8 text-stone-400">Загрузка…</div>;
  const save = async () => {
    await patch(`/api/db/worlds?id=${wid}`, w);
    setSaved("Сохранено");
    setTimeout(() => setSaved(""), 2000);
  };
  const optimize = async () => {
    const st = await api<{ language: { internal: string } }>("/api/settings");
    const r = await fetch("/api/tools", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "translate", texts: [w.description + "\n" + w.rules], to: st.language.internal, compress: true }) });
    const j = await r.json();
    if (j.items) setW({ ...w, compact: j.items[0] });
    else setSaved(j.error ?? "Не удалось");
  };
  return (
    <div className="font-ui mx-auto max-w-5xl p-4 md:p-8">
      <Link href="/library" className="text-sm text-amber-300 hover:underline">← Библиотека</Link>
      <h1 className="mb-4 font-serif text-3xl text-amber-100">Мир: {w.name}</h1>
      <Card className="mb-6 grid gap-3 md:grid-cols-2">
        <Field label="Название"><TextInput value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} /></Field>
        <Field label="Тон и жанр"><TextInput value={w.tone} onChange={(e) => setW({ ...w, tone: e.target.value })} /></Field>
        <Field label="Описание мира (для вас)" className="md:col-span-2"><TextArea rows={4} value={w.description} onChange={(e) => setW({ ...w, description: e.target.value })} /></Field>
        <Field label="Законы мира" hint="Магия, технологии, религии. По ним мастер отсеивает невозможное (никакой лавы в таверне, никаких пистолетов в средневековье)." className="md:col-span-2"><TextArea rows={2} value={w.rules} onChange={(e) => setW({ ...w, rules: e.target.value })} /></Field>
        <Field label="Версия для ИИ (кратко)" className="md:col-span-2"><TextArea rows={3} value={w.compact} onChange={(e) => setW({ ...w, compact: e.target.value })} /><Btn className="mt-1" onClick={optimize}>⚡ Оптимизировать для ИИ</Btn></Field>
        <ImageField value={w.image} onChange={(v) => setW({ ...w, image: v })} label="Картинка мира" />
        <div className="flex items-end gap-3"><Btn variant="primary" onClick={save}>Сохранить мир</Btn><span className="text-sm text-emerald-300">{saved}</span></div>
      </Card>
      <h2 className="mb-3 text-xl text-amber-100">База знаний мира</h2>
      <p className="mb-3 text-sm text-stone-400">Это «канон» мира: при создании приключения карточки копируются в него, и ИИ меняет только копии.</p>
      <KnowledgePanel adventureId={null} worldId={wid} />
    </div>
  );
}
