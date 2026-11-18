"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { Btn, Modal } from "./ui";

interface MediaList {
  dir: string;
  files: { url: string; name: string; folder: string }[];
}

export function ImagePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (url: string) => void }) {
  const [list, setList] = useState<MediaList | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "images" | "generated">("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => api<MediaList>("/api/media").then(setList);
  useEffect(() => {
    if (open) load();
  }, [open]);

  const upload = async (f: File) => {
    setBusy(true);
    const fd = new FormData();
    fd.append("file", f);
    const r = await fetch("/api/media", { method: "POST", body: fd });
    setBusy(false);
    if (r.ok) {
      const j = await r.json();
      await load();
      onPick(j.url);
      onClose();
    }
  };

  const files = (list?.files ?? []).filter((f) => filter === "all" || f.folder === filter);
  return (
    <Modal open={open} onClose={onClose} title="Выбор картинки из папки" wide>
      <p className="mb-3 text-sm text-stone-400">
        Положите картинки в папку <code className="rounded bg-stone-800 px-1 text-amber-200">{list?.dir ?? "data/images"}</code> — они появятся здесь. Либо загрузите файл кнопкой.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["all", "images", "generated"] as const).map((k) => (
          <Btn key={k} variant={filter === k ? "primary" : "default"} onClick={() => setFilter(k)}>
            {k === "all" ? "Все" : k === "images" ? "Мои" : "Созданные ИИ"}
          </Btn>
        ))}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <Btn onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? "Загрузка…" : "Загрузить файл…"}</Btn>
        <Btn variant="ghost" onClick={load}>Обновить</Btn>
      </div>
      {files.length === 0 && <p className="py-8 text-center text-stone-500">Пока нет картинок.</p>}
      <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto md:grid-cols-5">
        {files.map((f) => (
          <button key={f.url} onClick={() => { onPick(f.url); onClose(); }} className="group overflow-hidden rounded-lg border border-stone-700 hover:border-amber-500">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={f.name} className="aspect-square w-full object-cover" loading="lazy" />
            <div className="truncate px-1 py-0.5 text-[10px] text-stone-400">{f.name}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function ImageField({ value, onChange, label = "Картинка" }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="font-ui">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-amber-200/80">{label}</span>
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-16 w-16 rounded-lg border border-stone-700 object-cover" />
        ) : (
          <div className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-stone-700 text-xs text-stone-500">нет</div>
        )}
        <Btn onClick={() => setOpen(true)}>Выбрать из папки…</Btn>
        {value && <Btn variant="ghost" onClick={() => onChange("")}>Убрать</Btn>}
      </div>
      <ImagePicker open={open} onClose={() => setOpen(false)} onPick={onChange} />
    </div>
  );
}
