"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, del, patch, post, streamSse } from "@/lib/client/api";
import type { AdvData, Msg } from "@/lib/client/types";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/config";
import { Badge, Bar, Btn, Tabs, TextArea, TextInput } from "@/components/ui";
import { CharacterForm, type PlayerRow } from "@/components/CharacterForm";
import { KnowledgePanel } from "@/components/KnowledgePanel";
import { AdventurePanel, ContextPanel, HistoryPanel, MemoryPanel } from "@/components/PlayPanels";
import { DiceModal, type CheckInfo, type OutcomeInfo } from "@/components/DiceModal";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function RichText({ text }: { text: string }) {
  const html = text
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>").replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return <div className="prose-gm" dangerouslySetInnerHTML={{ __html: html }} />;
}

type PanelTab = "kb" | "mem" | "ctx" | "hist" | "adv";

export default function PlayPage() {
  const { id } = useParams<{ id: string }>();
  const advId = Number(id);
  const router = useRouter();
  const [data, setData] = useState<AdvData | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [input, setInput] = useState("");
  const [acting, setActing] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [warn, setWarn] = useState("");
  const [toast, setToast] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [shown, setShown] = useState("");
  const [rollReq, setRollReq] = useState<CheckInfo | null>(null);
  const [outcome, setOutcome] = useState<OutcomeInfo | null>(null);
  const [tab, setTab] = useState<PanelTab>("kb");
  const [sheet, setSheet] = useState<{ open: boolean; player: (PlayerRow & { id: number }) | null }>({ open: false, player: null });
  const [editMsg, setEditMsg] = useState<{ id: number; text: string } | null>(null);
  const [analysis, setAnalysis] = useState<{ suggested: { label: string; mod: number } | null; notes: string[] } | null>(null);
  const [ctxKey, setCtxKey] = useState(0);
  const [ctxInfo, setCtxInfo] = useState<{ tokens: number; budget: number } | null>(null);
  const [memSuggest, setMemSuggest] = useState(false);
  const [dice, setDice] = useState("1d20");
  const [diceLog, setDiceLog] = useState("");
  const [localImg, setLocalImg] = useState<Record<number, string>>({});
  const [imgBusy, setImgBusy] = useState<number | null>(null);
  const targetRef = useRef("");
  const shownRef = useRef("");
  const settingsRef = useRef(settings);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  settingsRef.current = settings;

  const reload = useCallback(async () => {
    const d = await api<AdvData>(`/api/adventures/${advId}`);
    setData(d);
    setCtxKey((k) => k + 1);
    return d;
  }, [advId]);

  useEffect(() => {
    api<Settings>("/api/settings").then(setSettings);
    reload().then((d) => {
      if (d.players.length) setActing([d.players[0].id]);
      else setSheet({ open: true, player: null });
      const p = d.adventure.pending as { check?: CheckInfo; roll?: OutcomeInfo } | null;
      if (p?.check) {
        setRollReq(p.check);
        if (p.roll) setOutcome(p.roll);
      }
    });
  }, [reload]);

  // «печатная машинка»
  useEffect(() => {
    const t = setInterval(() => {
      const tgt = targetRef.current;
      const cur = shownRef.current;
      if (cur === tgt) return;
      const cps = settingsRef.current.delay.streamCps;
      const step = cps <= 0 ? tgt.length : Math.max(1, Math.round(cps * 0.03));
      const next = tgt.startsWith(cur) ? tgt.slice(0, cur.length + step) : tgt.slice(0, step);
      shownRef.current = next;
      setShown(next);
    }, 30);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [data?.messages.length, shown, status]);

  const waitFlush = () =>
    new Promise<void>((res) => {
      const c = setInterval(() => {
        if (shownRef.current === targetRef.current) {
          clearInterval(c);
          res();
        }
      }, 40);
    });
  const resetStream = () => {
    targetRef.current = "";
    shownRef.current = "";
    setShown("");
  };

  const speak = useCallback(
    async (text: string) => {
      const t = settingsRef.current.media.tts;
      if (t.kind === "openai") {
        const r = await fetch("/api/tools", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "tts", text }) });
        if (r.ok) new Audio(URL.createObjectURL(await r.blob())).play();
      } else if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.replace(/[*_#]/g, ""));
        u.lang = settingsRef.current.language.narration;
        window.speechSynthesis.speak(u);
      }
    },
    [],
  );

  const runGm = useCallback(
    async (stage: "start" | "resume" | "regenerate") => {
      setBusy(true);
      setErr("");
      setWarn("");
      setStatus("Мастер думает…");
      resetStream();
      setStreaming(true);
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        await streamSse(
          `/api/adventures/${advId}/gm`,
          { stage },
          async (ev) => {
            switch (ev.type) {
              case "status": setStatus(String(ev.text)); break;
              case "context": setCtxInfo({ tokens: Number(ev.tokens), budget: Number(ev.budget) }); break;
              case "token": targetRef.current += String(ev.text); break;
              case "reset": targetRef.current = ""; shownRef.current = ""; setShown(""); break;
              case "replace": targetRef.current = String(ev.text); break;
              case "roll_request": setRollReq(ev.check as CheckInfo); setOutcome(null); break;
              case "roll": setOutcome(ev.outcome as OutcomeInfo); break;
              case "done": {
                await waitFlush();
                setStreaming(false);
                const d = await reload();
                const last = [...d.messages].reverse().find((m) => m.role === "assistant" && m.status === "active");
                if (last && settingsRef.current.media.tts.enabled && settingsRef.current.media.tts.auto) speak(last.content);
                break;
              }
              case "changes": setToast(ev.items as string[]); setTimeout(() => setToast([]), 9000); await reload(); break;
              case "image": await reload(); break;
              case "memory": await reload(); break;
              case "memory_suggest": setMemSuggest(true); break;
              case "warn": setWarn(String(ev.text)); break;
              case "error": setErr(String(ev.message)); break;
            }
          },
          ac.signal,
        );
      } catch (e) {
        if (!ac.signal.aborted) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
        setStreaming(false);
        setStatus("");
        resetStream();
        await reload();
      }
    },
    [advId, reload, speak],
  );

  const send = async () => {
    if (!input.trim() || busy || !data) return;
    const text = input;
    setInput("");
    try {
      await post(`/api/adventures/${advId}/messages`, { text, playerIds: acting });
      await reload();
      await runGm("start");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const onRoll = async () => {
    try {
      return await post<OutcomeInfo>(`/api/adventures/${advId}/roll`, {});
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return null;
    }
  };
  const afterRoll = () => {
    const resume = !!rollReq;
    setRollReq(null);
    setOutcome(null);
    if (resume) runGm("resume");
  };

  const saveEdit = async () => {
    if (!editMsg) return;
    const r = await patch<{ regenerate: boolean }>(`/api/adventures/${advId}/messages/${editMsg.id}`, { content: editMsg.text });
    setEditMsg(null);
    await reload();
    if (r.regenerate) runGm("start");
  };
  const deleteMsg = async (m: Msg) => {
    const warnText = m.role === "user" ? "Удалить сообщение? Ответ мастера и всё после этого хода будет откатано (изменения карточек тоже)." : "Удалить ответ мастера? Его изменения карточек будут отменены.";
    if (!confirm(warnText)) return;
    await del(`/api/adventures/${advId}/messages/${m.id}`);
    await reload();
  };
  const pinMsg = async (m: Msg) => {
    await patch(`/api/adventures/${advId}/messages/${m.id}`, { pinned: !m.pinned });
    await reload();
  };
  const drawScene = async (m: Msg) => {
    setImgBusy(m.id);
    try {
      const r = await post<{ url: string }>("/api/tools", { op: "image", prompt: m.content.slice(0, 900), kind: "scene illustration" });
      setLocalImg((x) => ({ ...x, [m.id]: r.url }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setImgBusy(null);
  };
  const rollFree = async () => {
    const r = await post<{ total: number; rolls: number[]; modifier: number }>("/api/tools", { op: "dice", expr: dice });
    setDiceLog(`${dice}: [${r.rolls.join(", ")}]${r.modifier ? ` ${r.modifier > 0 ? "+" : ""}${r.modifier}` : ""} = ${r.total}`);
  };

  // живая проверка ввода (алгоритмическая, без модели)
  useEffect(() => {
    if (!input.trim() || !acting.length) {
      setAnalysis(null);
      return;
    }
    const t = setTimeout(() => {
      post<{ suggested: { label: string; mod: number } | null; notes: string[] }>("/api/tools", { op: "analyze", adventureId: advId, playerId: acting[0], text: input.split(/\/n/i)[0] }).then(setAnalysis).catch(() => undefined);
    }, 500);
    return () => clearTimeout(t);
  }, [input, acting, advId]);

  const msgs = useMemo(() => (data?.messages ?? []).filter((m) => m.status === "active"), [data]);
  if (!data) return <div className="font-ui p-8 text-stone-400">Загрузка…</div>;
  const a = data.adventure;
  const sc = a.scene ?? {};
  const names = new Map(data.players.map((p) => [p.id, p]));
  const last = msgs[msgs.length - 1];
  const needsReply = last?.role === "user" && !busy && !rollReq;
  const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
  const changeMap = new Map<number, string[]>();
  for (const c of data.changes) if (c.messageId && !c.reverted) changeMap.set(c.messageId, [...(changeMap.get(c.messageId) ?? []), c.summary]);
  const tokInfo = ctxInfo ?? (data.stats ? null : null);

  return (
    <div className="font-ui flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-stone-800 bg-stone-950/80 px-4 py-2">
        <Link href="/" className="text-sm text-amber-300 hover:underline">← Меню</Link>
        <h1 className="font-serif text-lg text-amber-100">{a.name}</h1>
        <Badge tone="amber">D&D 5e · {a.edition}</Badge>
        {data.world && <Badge>{data.world.name}</Badge>}
        {sc.location && <Badge tone="blue">📍 {sc.location}</Badge>}
        {sc.time && <Badge>🕒 {sc.time}</Badge>}
        {sc.combat && <Badge tone="red">⚔ бой, раунд {sc.round ?? 1}</Badge>}
        <div className="ml-auto flex items-center gap-3">
          {tokInfo && settings.context.showBudgetInChat && (
            <div className="w-36" title="Токенов в последнем запросе / бюджет">
              <div className="text-[10px] text-stone-400">контекст {tokInfo.tokens}/{tokInfo.budget}</div>
              <Bar value={tokInfo.tokens} max={tokInfo.budget} tone={tokInfo.tokens > tokInfo.budget * 0.95 ? "red" : "amber"} />
            </div>
          )}
          <Link href="/settings" className="text-sm text-stone-300 hover:text-white">⚙ Настройки</Link>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_420px]">
        {/* ---------- Левая колонка: партия ---------- */}
        <aside className="hidden min-h-0 overflow-y-auto border-r border-stone-800 p-3 lg:block">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-200/80">Партия</h2>
            <Btn onClick={() => setSheet({ open: true, player: null })}>+ Игрок</Btn>
          </div>
          <div className="space-y-2">
            {data.players.map((p) => {
              const isActive = (sc.active ?? []).includes(p.id);
              const attacked = (sc.underAttack ?? []).includes(p.id);
              const idx = acting.indexOf(p.id);
              return (
                <div key={p.id} className={`rounded-xl border bg-stone-900/70 p-2 transition ${attacked ? "glow-attack" : isActive ? "glow-turn" : "border-stone-800"} ${idx >= 0 ? "ring-1 ring-amber-500/60" : ""}`}>
                  <div className="flex items-center gap-2">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <div className="grid h-12 w-12 place-items-center rounded-lg bg-stone-800 text-xl">🛡</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate font-semibold text-stone-100">{p.name}</span>
                        {attacked && <Badge tone="red">атакован!</Badge>}
                        {isActive && !attacked && <Badge tone="amber">ваш ход</Badge>}
                      </div>
                      <div className="truncate text-xs text-stone-400">{p.race} {p.className}{p.subclass ? ` · ${p.subclass}` : ""} · ур.{p.level}</div>
                    </div>
                    <button onClick={() => setSheet({ open: true, player: p })} className="text-stone-400 hover:text-white" title="Лист персонажа">✎</button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-stone-300">
                    <span>❤ {p.hp}/{p.maxHp}</span>
                    <span>🛡 {p.ac}</span>
                    <span>🪙 {p.gold}</span>
                  </div>
                  <Bar value={p.hp} max={p.maxHp} tone={p.hp <= p.maxHp / 4 ? "red" : "green"} />
                  {p.conditions.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{p.conditions.map((c) => <Badge key={c} tone="red">{c}</Badge>)}</div>}
                  <details className="mt-1 text-xs text-stone-400">
                    <summary className="cursor-pointer">Инвентарь ({p.inventory.length})</summary>
                    <ul className="mt-1 list-disc pl-4">{p.inventory.map((i, k) => <li key={k}>{i.name}{i.qty > 1 ? ` ×${i.qty}` : ""}</li>)}</ul>
                  </details>
                  <button onClick={() => setActing((cur) => (cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id]))} className={`mt-1.5 w-full rounded-md border px-2 py-1 text-xs ${idx >= 0 ? "border-amber-600 bg-amber-900/40 text-amber-100" : "border-stone-700 text-stone-400 hover:bg-stone-800"}`}>
                    {idx >= 0 ? `Действует (${idx + 1})` : "Действовать за него"}
                  </button>
                </div>
              );
            })}
          </div>
          {(sc.enemies ?? []).length > 0 && (
            <div className="mt-4">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-red-300/80">Враги</h2>
              <div className="space-y-1.5">
                {sc.enemies!.map((e) => (
                  <div key={e.id} className="rounded-lg border border-red-900/60 bg-red-950/20 p-2 text-xs">
                    <div className="flex justify-between"><span className="font-semibold text-red-100">{e.name}</span><span>{e.hp}/{e.maxHp}{e.ac ? ` · КД ${e.ac}` : ""}</span></div>
                    <Bar value={e.hp} max={e.maxHp} tone="red" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ---------- Чат ---------- */}
        <main className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {msgs.map((m) => {
              const pl = m.playerId ? names.get(m.playerId) : null;
              const isEditing = editMsg?.id === m.id;
              const imgs = [...(m.meta.images ?? []).map((i) => i.url), ...(localImg[m.id] ? [localImg[m.id]] : [])];
              const ch = changeMap.get(m.id);
              return (
                <div key={m.id} className={`group rounded-xl border p-3 ${m.role === "assistant" ? "border-stone-800 bg-stone-900/50" : "ml-8 border-sky-900/50 bg-sky-950/20"}`}>
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    {m.role === "assistant" ? <Badge tone="amber">🎲 Мастер</Badge> : <Badge tone="blue">{pl?.name ?? "Игрок"}</Badge>}
                    {m.pinned && <Badge tone="amber">📌</Badge>}
                    {m.summarized && <Badge tone="green">в блокноте</Badge>}
                    {m.meta.rollText && <Badge tone="amber">🎲 {m.meta.rollText}</Badge>}
                    {(m.meta.issues ?? []).map((i, k) => <Badge key={k} tone="red">штраф: {i.detail}</Badge>)}
                    {m.meta.retries ? <Badge>переписан ×{m.meta.retries}</Badge> : null}
                    <span className="ml-auto flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                      {m.role === "assistant" && settings.media.tts.enabled && <Btn variant="ghost" onClick={() => speak(m.content)} title="Озвучить">🔊</Btn>}
                      {m.role === "assistant" && settings.media.image.enabled && <Btn variant="ghost" disabled={imgBusy === m.id} onClick={() => drawScene(m)} title="Нарисовать сцену">{imgBusy === m.id ? "…" : "🖼"}</Btn>}
                      <Btn variant="ghost" onClick={() => pinMsg(m)} title="Закрепить (не забывать)">📌</Btn>
                      {!(m.meta.opening) && <Btn variant="ghost" onClick={() => setEditMsg({ id: m.id, text: m.content })} title="Редактировать">✎</Btn>}
                      {m.role === "assistant" && m.id === lastAssistant?.id && !busy && <Btn variant="ghost" onClick={() => runGm("regenerate")} title="Сгенерировать заново">⟳</Btn>}
                      {!(m.meta.opening) && <Btn variant="ghost" onClick={() => deleteMsg(m)} title="Удалить">🗑</Btn>}
                    </span>
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <TextArea rows={5} value={editMsg!.text} onChange={(e) => setEditMsg({ ...editMsg!, text: e.target.value })} />
                      <p className="text-xs text-stone-400">{m.role === "user" ? "После сохранения мастер ответит заново; последующие ходы будут откатаны." : "Правка текста ответа; ложные факты из блокнота будут пересжаты."}</p>
                      <div className="flex gap-2"><Btn variant="primary" onClick={saveEdit}>Сохранить</Btn><Btn onClick={() => setEditMsg(null)}>Отмена</Btn></div>
                    </div>
                  ) : (
                    <RichText text={m.content} />
                  )}
                  {imgs.map((u) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={u} src={u} alt="" className="mt-2 max-h-80 rounded-lg border border-stone-700" />
                  ))}
                  {ch && ch.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">{ch.map((c, i) => <Badge key={i} tone="green">✎ {c}</Badge>)}</div>
                  )}
                </div>
              );
            })}
            {streaming && (
              <div className="rounded-xl border border-amber-800/60 bg-stone-900/50 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs"><Badge tone="amber">🎲 Мастер</Badge><span className="animate-pulse text-amber-300">{status}</span></div>
                {shown ? <RichText text={shown} /> : <p className="text-sm text-stone-500">…</p>}
              </div>
            )}
            {!streaming && busy && status && <p className="text-center text-sm text-amber-300">{status}</p>}
            {toast.length > 0 && (
              <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-2 text-xs text-emerald-200">Карточки обновлены: {toast.join(" · ")}</div>
            )}
            {memSuggest && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-800 bg-amber-950/30 p-2 text-xs text-amber-200">
                История переполняется. <Btn onClick={() => { setTab("mem"); setMemSuggest(false); }}>Открыть блокнот</Btn>
              </div>
            )}
            {warn && <p className="text-xs text-amber-300">⚠ {warn}</p>}
            {err && <div className="rounded-lg border border-red-800 bg-red-950/40 p-2 text-sm text-red-200">{err} <Btn variant="ghost" onClick={() => setErr("")}>скрыть</Btn></div>}
            {needsReply && <div className="text-center"><Btn variant="primary" onClick={() => runGm("start")}>Получить ответ мастера</Btn></div>}
            <div ref={endRef} />
          </div>

          {/* ---------- Ввод ---------- */}
          <div className="border-t border-stone-800 bg-stone-950/80 p-3">
            {analysis && (analysis.suggested || analysis.notes.length > 0) && (
              <div className="mb-2 rounded-lg border border-stone-800 bg-stone-900/60 p-2 text-xs text-stone-300">
                {analysis.suggested && <span className="mr-3">🎯 Возможная проверка: <b className="text-amber-200">{analysis.suggested.label} {analysis.suggested.mod >= 0 ? "+" : ""}{analysis.suggested.mod}</b></span>}
                {analysis.notes.map((n, i) => <div key={i} className="text-amber-300">⚠ {n}</div>)}
              </div>
            )}
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs text-stone-400">
              <span>Действуют:</span>
              {acting.length === 0 && <span className="text-stone-500">никто (выберите карточку слева)</span>}
              {acting.map((pid, i) => <Badge key={pid} tone="amber">{i + 1}. {names.get(pid)?.name}</Badge>)}
              {data.players.length > 1 && <span className="text-stone-500">· одновременные действия делите через <code className="rounded bg-stone-800 px-1">/n</code> (по порядку, либо «Имя: …»)</span>}
              <span className="ml-auto flex items-center gap-1">
                <TextInput value={dice} onChange={(e) => setDice(e.target.value)} className="!w-24 !py-0.5" />
                <Btn onClick={rollFree}>🎲</Btn>
                {diceLog && <span className="text-amber-200">{diceLog}</span>}
              </span>
            </div>
            <div className="flex gap-2">
              <TextArea rows={3} value={input} placeholder="Что делает ваш персонаж? (Ctrl+Enter — отправить)" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }} disabled={busy} />
              <div className="flex w-28 flex-col gap-1">
                {busy ? <Btn variant="danger" className="flex-1" onClick={() => abortRef.current?.abort()}>Стоп</Btn> : <Btn variant="primary" className="flex-1" onClick={send} disabled={!input.trim()}>Отправить</Btn>}
                {lastAssistant && !busy && last?.role === "assistant" && last.id === lastAssistant.id && !last.meta.opening && <Btn onClick={() => runGm("regenerate")}>⟳ Заново</Btn>}
              </div>
            </div>
          </div>
        </main>

        {/* ---------- Правая панель ---------- */}
        <aside className="hidden min-h-0 flex-col border-l border-stone-800 lg:flex">
          <div className="border-b border-stone-800 p-2">
            <Tabs<PanelTab> small value={tab} onChange={setTab} tabs={[{ key: "kb", label: "База знаний" }, { key: "mem", label: "Память" }, { key: "ctx", label: "Контекст" }, { key: "hist", label: "История" }, { key: "adv", label: "Сцена и правила" }]} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {tab === "kb" && <KnowledgePanel adventureId={advId} worldId={a.worldId} reloadKey={ctxKey} />}
            {tab === "mem" && <MemoryPanel advId={advId} data={data} reload={reload} />}
            {tab === "ctx" && <ContextPanel advId={advId} draft={input} actingIds={acting} reloadKey={ctxKey} />}
            {tab === "hist" && <HistoryPanel advId={advId} data={data} reload={reload} onEdit={(m) => setEditMsg({ id: m.id, text: m.content })} onDelete={deleteMsg} onPin={pinMsg} />}
            {tab === "adv" && <AdventurePanel advId={advId} data={data} reload={reload} onDeleted={() => router.push("/")} />}
          </div>
        </aside>
      </div>

      <DiceModal check={rollReq} outcome={outcome} animate={settings.dice.animation} onRoll={onRoll} onContinue={afterRoll} />
      <CharacterForm open={sheet.open} onClose={() => setSheet({ open: false, player: null })} adventureId={advId} initial={sheet.player} edition={a.edition} onSaved={async () => { const d = await reload(); if (!acting.length && d.players.length) setActing([d.players[0].id]); }} />
    </div>
  );
}
