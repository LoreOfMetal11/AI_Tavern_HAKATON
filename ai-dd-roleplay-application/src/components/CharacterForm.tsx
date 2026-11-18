"use client";
import { useEffect, useMemo, useState } from "react";
import { ABILITIES, ALIGNMENTS, BACKGROUNDS, CLASSES, CONDITIONS, POINT_BUY_COST, RACES, SKILLS, STANDARD_ARRAY, type AbilityKey } from "@/lib/dnd/data";
import { abilityMod, fmtMod, profBonus } from "@/lib/dice";
import { del, patch, post } from "@/lib/client/api";
import { Badge, Btn, Field, Modal, NumInput, Select, TextArea, TextInput } from "./ui";
import { ImageField } from "./ImagePicker";

export interface PlayerRow {
  id?: number;
  adventureId: number | null;
  name: string;
  playerName: string;
  race: string;
  className: string;
  subclass: string;
  level: number;
  xp: number;
  background: string;
  alignment: string;
  abilities: Record<AbilityKey, number>;
  skills: { key: string; level: number }[];
  saves: string[];
  hp: number;
  maxHp: number;
  tempHp: number;
  ac: number;
  speed: number;
  gold: number;
  inventory: { name: string; qty: number; desc?: string }[];
  features: string;
  conditions: string[];
  backstory: string;
  personality: string;
  appearance: string;
  history: string;
  image: string;
}

const KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

export const blankPlayer = (adventureId: number | null): PlayerRow => ({
  adventureId, name: "", playerName: "", race: "", className: "", subclass: "", level: 1, xp: 0, background: "", alignment: "N",
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, skills: [], saves: [], hp: 10, maxHp: 10, tempHp: 0, ac: 10, speed: 30, gold: 0,
  inventory: [], features: "", conditions: [], backstory: "", personality: "", appearance: "", history: "", image: "",
});

function acFor(cls: string, m: Record<AbilityKey, number>) {
  const d = abilityMod(m.dex);
  switch (cls) {
    case "barbarian": return 10 + d + abilityMod(m.con);
    case "monk": return 10 + d + abilityMod(m.wis);
    case "sorcerer": case "wizard": return 10 + d;
    case "bard": case "rogue": case "warlock": return 11 + d;
    case "druid": return 13 + d;
    case "ranger": return 12 + Math.min(d, 2);
    default: return 18;
  }
}

export function CharacterForm({ open, onClose, adventureId, initial, edition = "2014", onSaved }: { open: boolean; onClose: () => void; adventureId: number | null; initial?: PlayerRow | null; edition?: string; onSaved: () => void }) {
  const editing = !!initial?.id;
  const [p, setP] = useState<PlayerRow>(blankPlayer(adventureId));
  const [base, setBase] = useState<Record<AbilityKey, number>>({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
  const [method, setMethod] = useState<"standard" | "pointbuy" | "roll" | "manual">("standard");
  const [raceKey, setRaceKey] = useState("human");
  const [subrace, setSubrace] = useState("");
  const [classKey, setClassKey] = useState("fighter");
  const [bgKey, setBgKey] = useState("soldier");
  const [bonus2, setBonus2] = useState<AbilityKey>("str");
  const [bonus1, setBonus1] = useState<AbilityKey>("con");
  const [picked, setPicked] = useState<string[]>([]);
  const [auto, setAuto] = useState(true);
  const [importText, setImportText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr("");
    if (initial) {
      setP({ ...blankPlayer(adventureId), ...initial });
      setAuto(false);
      setMethod("manual");
    } else {
      setP(blankPlayer(adventureId));
      setAuto(true);
      setMethod("standard");
      const c = CLASSES.find((x) => x.key === "fighter")!;
      setBase({ str: c.recommended.str ?? 10, dex: c.recommended.dex ?? 10, con: c.recommended.con ?? 10, int: c.recommended.int ?? 10, wis: c.recommended.wis ?? 10, cha: c.recommended.cha ?? 10 });
      setPicked([]);
    }
  }, [open, initial, adventureId]);

  const race = RACES.find((r) => r.key === raceKey)!;
  const cls = CLASSES.find((c) => c.key === classKey)!;
  const bg = BACKGROUNDS.find((b) => b.key === bgKey)!;
  const sub = race.subraces?.find((s) => s.name === subrace);
  const ed2024 = edition === "2024";

  const finalAb = useMemo(() => {
    const out = { ...base } as Record<AbilityKey, number>;
    if (ed2024) {
      out[bonus2] += 2;
      out[bonus1] += bonus1 === bonus2 ? 0 : 1;
    } else {
      for (const [k, v] of Object.entries(race.asi)) out[k as AbilityKey] += v ?? 0;
      for (const [k, v] of Object.entries(sub?.asi ?? {})) out[k as AbilityKey] += v ?? 0;
    }
    for (const k of KEYS) out[k] = Math.min(20, out[k]);
    return out;
  }, [base, race, sub, ed2024, bonus1, bonus2]);

  // автопересчёт производных полей в режиме создания
  useEffect(() => {
    if (!auto) return;
    const conMod = abilityMod(finalAb.con);
    const maxHp = Math.max(1, cls.hitDie + conMod + (p.level - 1) * (Math.floor(cls.hitDie / 2) + 1 + conMod) + (race.key === "dwarf" && subrace === "Холмовой дварф" ? p.level : 0));
    const skillsKeys = [...new Set([...bg.skills, ...picked])];
    setP((x) => ({
      ...x,
      race: sub ? sub.name : race.name,
      className: cls.name,
      background: bg.name,
      abilities: finalAb,
      saves: cls.saves,
      skills: skillsKeys.map((k) => ({ key: k, level: x.skills.find((s) => s.key === k)?.level === 2 ? 2 : 1 })),
      maxHp,
      hp: maxHp,
      ac: acFor(cls.key, finalAb),
      speed: race.speed + (sub?.name === "Лесной эльф" ? 5 : 0),
      gold: cls.gold,
      inventory: [...cls.gear, { name: "Снаряжение предыстории", qty: 1, desc: bg.gear }],
      features: [`${cls.name}: ${cls.features}`, `${race.name}: ${race.traits}${sub ? ` ${sub.name}: ${sub.traits}` : ""}`, `Предыстория «${bg.name}»: ${bg.feature}`, x.subclass ? `Подкласс ${x.subclass}: ${cls.subclasses.find((s) => s.name === x.subclass)?.desc ?? ""}` : ""].filter(Boolean).join("\n"),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, finalAb, cls, race, sub, bg, picked, p.level]);

  const applyMethod = (m: typeof method) => {
    setMethod(m);
    if (m === "standard") {
      const order = [...KEYS].sort((a, b) => (cls.recommended[b] ?? 0) - (cls.recommended[a] ?? 0));
      const nb = { ...base };
      order.forEach((k, i) => (nb[k] = STANDARD_ARRAY[i]));
      setBase(nb);
    } else if (m === "pointbuy") setBase({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
  };
  const rollAll = async () => {
    const vals: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await post<{ total: number }>("/api/tools", { op: "dice", expr: "4d6kh3" });
      vals.push(r.total);
    }
    vals.sort((a, b) => b - a);
    const order = [...KEYS].sort((a, b) => (cls.recommended[b] ?? 0) - (cls.recommended[a] ?? 0));
    const nb = { ...base };
    order.forEach((k, i) => (nb[k] = vals[i]));
    setBase(nb);
  };
  const spent = KEYS.reduce((a, k) => a + (POINT_BUY_COST[base[k]] ?? 0), 0);

  const toggleSkill = (k: string) => {
    if (picked.includes(k)) setPicked(picked.filter((x) => x !== k));
    else if (picked.length < cls.skillCount) setPicked([...picked, k]);
  };
  const save = async () => {
    if (!p.name.trim()) return setErr("Введите имя персонажа");
    setBusy(true);
    try {
      if (editing) await patch(`/api/db/players?id=${initial!.id}`, p);
      else await post("/api/db/players", p);
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };
  const doImport = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await post<{ card: Partial<PlayerRow> }>("/api/import", { mode: "character", text: importText });
      setAuto(false);
      setMethod("manual");
      setP({ ...blankPlayer(adventureId), ...r.card, adventureId, skills: p.skills, saves: p.saves } as PlayerRow);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  const al = ALIGNMENTS.find((a) => a.key === p.alignment);
  const hints: string[] = [];
  if (!editing) {
    const main = KEYS.filter((k) => (cls.recommended[k] ?? 0) >= 14).slice(0, 2);
    for (const k of main) if (finalAb[k] < 13) hints.push(`${ABILITIES.find((a) => a.key === k)!.name} ниже 13 — ключевая для класса «${cls.name}», будет трудно.`);
    if (picked.length < cls.skillCount) hints.push(`Выберите навыков класса: ещё ${cls.skillCount - picked.length}.`);
    if (method === "pointbuy" && spent > 27) hints.push(`Потрачено ${spent} из 27 очков — превышение.`);
    if (ed2024) hints.push("Редакция 2024: бонусы характеристик даёт предыстория (+2 и +1).");
  }

  return (
    <Modal open={open} onClose={onClose} wide title={editing ? `Лист персонажа: ${initial?.name}` : "Создание персонажа"} footer={<>{editing && <Btn variant="danger" onClick={async () => { if (confirm("Удалить персонажа?")) { await del(`/api/db/players?id=${initial!.id}`); onSaved(); onClose(); } }}>Удалить</Btn>}<Btn onClick={onClose}>Отмена</Btn><Btn variant="primary" disabled={busy} onClick={save}>Сохранить</Btn></>}>
      <div className="space-y-5">
        {err && <p className="rounded bg-red-900/50 p-2 text-sm text-red-200">{err}</p>}
        {!editing && (
          <details className="rounded-lg border border-stone-800 p-2 text-sm">
            <summary className="cursor-pointer text-amber-200">Импорт персонажа из текста (ИИ)</summary>
            <TextArea rows={4} className="mt-2" placeholder="Вставьте описание персонажа или лист в свободной форме…" value={importText} onChange={(e) => setImportText(e.target.value)} />
            <Btn className="mt-2" onClick={doImport} disabled={busy || !importText}>Разобрать</Btn>
          </details>
        )}
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Имя персонажа"><TextInput value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
          <Field label="Имя игрока"><TextInput value={p.playerName} onChange={(e) => setP({ ...p, playerName: e.target.value })} /></Field>
          <Field label="Уровень"><NumInput value={p.level} min={1} max={20} onChange={(v) => setP({ ...p, level: Math.max(1, Math.min(20, v)) })} /></Field>
        </div>

        {!editing && (
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Раса" hint={race.traits}><Select value={raceKey} onChange={(v) => { setRaceKey(v); setSubrace(""); }} options={RACES.map((r) => ({ value: r.key, label: r.name }))} /></Field>
            <Field label="Подраса" hint={sub?.traits}><Select value={subrace} onChange={setSubrace} options={[{ value: "", label: race.subraces ? "— выбрать —" : "нет подрас" }, ...(race.subraces ?? []).map((s) => ({ value: s.name, label: s.name }))]} /></Field>
            <Field label="Класс" hint={`${cls.desc} d${cls.hitDie}, спасброски: ${cls.saves.map((s) => s.toUpperCase()).join("/")}`}><Select value={classKey} onChange={(v) => { setClassKey(v); setPicked([]); setP((x) => ({ ...x, subclass: "" })); }} options={CLASSES.map((c) => ({ value: c.key, label: c.name }))} /></Field>
            <Field label="Подкласс" hint={`Доступен с ${ed2024 ? 3 : cls.subclassLevel} уровня; можно выбрать заранее. ${cls.subclasses.find((s) => s.name === p.subclass)?.desc ?? ""}`}><Select value={p.subclass} onChange={(v) => setP({ ...p, subclass: v })} options={[{ value: "", label: "— без подкласса —" }, ...cls.subclasses.map((s) => ({ value: s.name, label: s.name }))]} /></Field>
            <Field label="Предыстория" hint={`${bg.desc} ${bg.feature}`}><Select value={bgKey} onChange={setBgKey} options={BACKGROUNDS.map((b) => ({ value: b.key, label: b.name }))} /></Field>
            {ed2024 && (
              <>
                <Field label="+2 к характеристике"><Select value={bonus2} onChange={(v) => setBonus2(v as AbilityKey)} options={ABILITIES.map((a) => ({ value: a.key, label: a.name }))} /></Field>
                <Field label="+1 к характеристике"><Select value={bonus1} onChange={(v) => setBonus1(v as AbilityKey)} options={ABILITIES.map((a) => ({ value: a.key, label: a.name }))} /></Field>
              </>
            )}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Мировоззрение" hint={al ? `${al.desc} ${al.effect}` : ""}><Select value={p.alignment} onChange={(v) => setP({ ...p, alignment: v })} options={ALIGNMENTS.map((a) => ({ value: a.key, label: `${a.name} (${a.key})` }))} /></Field>
          {editing && (
            <div className="grid grid-cols-3 gap-2">
              <Field label="Раса"><TextInput value={p.race} onChange={(e) => setP({ ...p, race: e.target.value })} /></Field>
              <Field label="Класс"><TextInput value={p.className} onChange={(e) => setP({ ...p, className: e.target.value })} /></Field>
              <Field label="Подкласс"><TextInput value={p.subclass} onChange={(e) => setP({ ...p, subclass: e.target.value })} /></Field>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-amber-100">Характеристики</h4>
            {!editing && (
              <>
                {(["standard", "pointbuy", "roll", "manual"] as const).map((m) => (
                  <Btn key={m} variant={method === m ? "primary" : "default"} onClick={() => (m === "roll" ? (setMethod("roll"), rollAll()) : applyMethod(m))}>
                    {{ standard: "Стандартный набор", pointbuy: "Покупка очков", roll: "Бросок 4d6", manual: "Вручную" }[m]}
                  </Btn>
                ))}
                {method === "pointbuy" && <Badge tone={spent > 27 ? "red" : "green"}>очков: {spent}/27</Badge>}
                <Btn variant="ghost" onClick={() => { setMethod("manual"); setBase({ str: cls.recommended.str ?? 10, dex: cls.recommended.dex ?? 10, con: cls.recommended.con ?? 10, int: cls.recommended.int ?? 10, wis: cls.recommended.wis ?? 10, cha: cls.recommended.cha ?? 10 }); }}>Рекомендуемые для класса</Btn>
              </>
            )}
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {ABILITIES.map((a) => {
              const val = p.abilities[a.key];
              return (
                <div key={a.key} className="rounded-lg border border-stone-800 bg-stone-900/50 p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-100">{a.name}</span>
                    <span className="text-lg font-bold text-stone-100">{val} <span className="text-sm text-amber-300">({fmtMod(abilityMod(val))})</span></span>
                  </div>
                  {!editing ? (
                    <div className="mt-1 flex items-center gap-1">
                      {method === "pointbuy" ? (
                        <>
                          <Btn onClick={() => setBase({ ...base, [a.key]: Math.max(8, base[a.key] - 1) })}>−</Btn>
                          <span className="w-8 text-center">{base[a.key]}</span>
                          <Btn onClick={() => setBase({ ...base, [a.key]: Math.min(15, base[a.key] + 1) })}>+</Btn>
                        </>
                      ) : (
                        <NumInput value={base[a.key]} min={3} max={20} onChange={(v) => setBase({ ...base, [a.key]: v })} className="w-20" />
                      )}
                      <span className="text-[11px] text-stone-500">база {!ed2024 && (race.asi[a.key] || sub?.asi[a.key]) ? `+ раса ${(race.asi[a.key] ?? 0) + (sub?.asi[a.key] ?? 0)}` : ""}</span>
                    </div>
                  ) : (
                    <NumInput value={val} min={1} max={30} onChange={(v) => setP({ ...p, abilities: { ...p.abilities, [a.key]: v } })} className="mt-1 w-24" />
                  )}
                  <p className="mt-1 text-[11px] leading-snug text-stone-400">{a.desc}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-stone-300">{val <= 8 ? a.low : val >= 16 ? a.high : `Средний уровень: бонус ${fmtMod(abilityMod(val))} к проверкам.`}</p>
                </div>
              );
            })}
          </div>
          {hints.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm text-amber-200">{hints.map((h) => <li key={h}>{h}</li>)}</ul>}
        </div>

        <div>
          <h4 className="mb-1 text-sm font-semibold text-amber-100">Навыки <span className="font-normal text-stone-400">— бонус мастерства +{profBonus(p.level)}{!editing ? `; выберите ${cls.skillCount} навыков класса, предыстория даёт: ${bg.skills.map((k) => SKILLS.find((s) => s.key === k)?.name).join(", ")}` : ""}</span></h4>
          <div className="grid gap-1.5 md:grid-cols-2">
            {SKILLS.map((s) => {
              const lvl = p.skills.find((x) => x.key === s.key)?.level ?? 0;
              const fromBg = !editing && bg.skills.includes(s.key);
              const canPick = !editing && cls.skillPool.includes(s.key) && !fromBg;
              const mod = abilityMod(p.abilities[s.ability]) + lvl * profBonus(p.level);
              return (
                <div key={s.key} className={`flex items-start gap-2 rounded-md border p-1.5 text-sm ${lvl ? "border-amber-700 bg-amber-950/30" : "border-stone-800"}`}>
                  <button
                    disabled={!editing && !canPick}
                    onClick={() => {
                      if (editing) {
                        const next = lvl === 0 ? [...p.skills, { key: s.key, level: 1 }] : lvl === 1 ? p.skills.map((x) => (x.key === s.key ? { ...x, level: 2 } : x)) : p.skills.filter((x) => x.key !== s.key);
                        setP({ ...p, skills: next });
                      } else if (canPick) toggleSkill(s.key);
                    }}
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border text-[10px] ${lvl === 2 ? "border-amber-400 bg-amber-500 text-black" : lvl ? "border-amber-500 bg-amber-700 text-white" : "border-stone-600"} disabled:opacity-40`}
                    title={editing ? "клик: мастерство → экспертиза → нет" : canPick ? "выбрать навык класса" : fromBg ? "из предыстории" : "недоступно классу"}
                  >
                    {lvl === 2 ? "★" : lvl ? "✓" : ""}
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5"><span className="font-medium text-stone-100">{s.name}</span><Badge>{ABILITIES.find((a) => a.key === s.ability)!.short}</Badge><span className="text-amber-300">{fmtMod(mod)}</span></div>
                    <div className="text-[11px] leading-snug text-stone-400">{s.desc} <span className="text-stone-300">{s.effect}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-6">
          <Field label="Макс. ЗД"><NumInput value={p.maxHp} onChange={(v) => setP({ ...p, maxHp: v })} /></Field>
          <Field label="Тек. ЗД"><NumInput value={p.hp} onChange={(v) => setP({ ...p, hp: v })} /></Field>
          <Field label="КД"><NumInput value={p.ac} onChange={(v) => setP({ ...p, ac: v })} /></Field>
          <Field label="Скорость"><NumInput value={p.speed} onChange={(v) => setP({ ...p, speed: v })} /></Field>
          <Field label="Золото"><NumInput value={p.gold} onChange={(v) => setP({ ...p, gold: v })} /></Field>
          <Field label="Опыт"><NumInput value={p.xp} onChange={(v) => setP({ ...p, xp: v })} /></Field>
        </div>

        <div>
          <h4 className="mb-1 text-sm font-semibold text-amber-100">Инвентарь</h4>
          <div className="space-y-1">
            {p.inventory.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_1.5fr_auto] gap-1">
                <TextInput value={it.name} onChange={(e) => setP({ ...p, inventory: p.inventory.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <NumInput value={it.qty} min={0} onChange={(v) => setP({ ...p, inventory: p.inventory.map((x, j) => (j === i ? { ...x, qty: v } : x)) })} />
                <TextInput value={it.desc ?? ""} placeholder="описание, свойства" onChange={(e) => setP({ ...p, inventory: p.inventory.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)) })} />
                <Btn variant="ghost" onClick={() => setP({ ...p, inventory: p.inventory.filter((_, j) => j !== i) })}>×</Btn>
              </div>
            ))}
          </div>
          <Btn className="mt-1" onClick={() => setP({ ...p, inventory: [...p.inventory, { name: "", qty: 1, desc: "" }] })}>+ Предмет</Btn>
        </div>

        <div>
          <h4 className="mb-1 text-sm font-semibold text-amber-100">Состояния</h4>
          <div className="flex flex-wrap gap-1">
            {CONDITIONS.map((c) => (
              <button key={c} onClick={() => setP({ ...p, conditions: p.conditions.includes(c) ? p.conditions.filter((x) => x !== c) : [...p.conditions, c] })} className={`rounded px-2 py-0.5 text-xs ${p.conditions.includes(c) ? "bg-red-800 text-white" : "bg-stone-800 text-stone-300"}`}>{c}</button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Умения, заклинания, особенности" className="md:col-span-2"><TextArea rows={4} value={p.features} onChange={(e) => setP({ ...p, features: e.target.value })} /></Field>
          <Field label="История персонажа"><TextArea rows={4} value={p.backstory} onChange={(e) => setP({ ...p, backstory: e.target.value })} /></Field>
          <Field label="Характер, идеалы, связи, слабости"><TextArea rows={4} value={p.personality} onChange={(e) => setP({ ...p, personality: e.target.value })} /></Field>
          <Field label="Внешность"><TextArea rows={2} value={p.appearance} onChange={(e) => setP({ ...p, appearance: e.target.value })} /></Field>
          <Field label="Карточка развития (заполняет ИИ: травмы, перемены)"><TextArea rows={2} value={p.history} onChange={(e) => setP({ ...p, history: e.target.value })} /></Field>
          <ImageField value={p.image} onChange={(v) => setP({ ...p, image: v })} label="Портрет" />
        </div>
      </div>
    </Modal>
  );
}
