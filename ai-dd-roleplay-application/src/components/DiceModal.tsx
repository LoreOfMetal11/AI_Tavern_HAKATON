"use client";
import { useEffect, useState } from "react";
import { Btn, Modal } from "./ui";

export interface CheckInfo {
  playerName: string;
  label: string;
  dc: number | null;
  mod: number;
  adv: number;
  why: string;
  kind: string;
}
export interface OutcomeInfo {
  check: CheckInfo;
  d20: number[];
  chosen: number;
  mod: number;
  total: number;
  success: boolean | null;
  margin: number | null;
  crit: boolean;
  fumble: boolean;
  damage: { expr: string; total: number; rolls: number[] } | null;
}

const fm = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Окно броска: мастер запросил проверку → игрок жмёт «Бросить», сервер бросает кубик, интерфейс показывает результат. */
export function DiceModal({
  check,
  outcome,
  animate,
  onRoll,
  onContinue,
}: {
  check: CheckInfo | null;
  outcome: OutcomeInfo | null;
  animate: boolean;
  onRoll: () => Promise<OutcomeInfo | null>;
  onContinue: () => void;
}) {
  const [shown, setShown] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [local, setLocal] = useState<OutcomeInfo | null>(null);
  const res = outcome ?? local;

  useEffect(() => {
    setLocal(null);
    setShown(null);
    setRolling(false);
  }, [check?.label, check?.playerName]);

  useEffect(() => {
    if (outcome && animate) {
      setRolling(true);
      const t = setInterval(() => setShown(1 + Math.floor(Math.random() * 20)), 70);
      const e = setTimeout(() => {
        clearInterval(t);
        setRolling(false);
        setShown(outcome.chosen);
      }, 1000);
      return () => {
        clearInterval(t);
        clearTimeout(e);
      };
    }
    if (outcome) setShown(outcome.chosen);
  }, [outcome, animate]);

  const open = !!check || !!outcome;
  const c = check ?? outcome?.check ?? null;
  const roll = async () => {
    setRolling(true);
    const t = setInterval(() => setShown(1 + Math.floor(Math.random() * 20)), 70);
    const o = await onRoll();
    await new Promise((r) => setTimeout(r, animate ? 900 : 0));
    clearInterval(t);
    setRolling(false);
    if (o) {
      setLocal(o);
      setShown(o.chosen);
    }
  };

  const done = !!res && !rolling;
  const tone = !done ? "border-amber-600" : res!.success === null ? "border-stone-500" : res!.success ? "border-emerald-500" : "border-red-500";
  return (
    <Modal open={open} onClose={() => (done ? onContinue() : undefined)} title={c ? `${c.playerName}: ${c.label}` : "Бросок"}>
      {c && (
        <div className="text-center">
          <p className="mb-1 text-sm text-stone-300">{c.why || "Мастер просит бросок"}</p>
          <p className="mb-4 text-xs text-stone-400">
            Сложность: <b className="text-amber-200">{c.dc ?? "—"}</b> · Модификатор: <b className="text-amber-200">{fm(c.mod)}</b>
            {c.adv !== 0 && <> · <b className="text-amber-200">{c.adv > 0 ? "преимущество" : "помеха"}</b></>}
          </p>
          <div className={`mx-auto mb-4 grid h-28 w-28 place-items-center rounded-2xl border-4 bg-stone-900 text-5xl font-bold text-amber-100 ${tone} ${rolling ? "dice-rolling" : ""}`}>{shown ?? "d20"}</div>
          {done && res && (
            <div className="mb-3 space-y-1">
              <p className="text-lg">
                {res.d20.length > 1 ? `[${res.d20.join(", ")}] → ${res.chosen}` : res.chosen} {fm(res.mod)} = <b className="text-amber-200">{res.total}</b>
                {res.check.dc !== null && <span className="text-stone-400"> против {res.check.dc}</span>}
              </p>
              {res.success !== null && (
                <p className={`text-xl font-semibold ${res.success ? "text-emerald-400" : "text-red-400"}`}>
                  {res.crit ? "Критическое попадание!" : res.fumble ? "Критический промах!" : res.success ? (res.check.kind === "attack" ? "Попадание" : "Успех") : res.check.kind === "attack" ? "Промах" : "Провал"}
                </p>
              )}
              {res.damage && <p className="text-sm text-red-300">Урон: {res.damage.total} ({res.damage.expr}; [{res.damage.rolls.join(", ")}])</p>}
            </div>
          )}
          <div className="flex justify-center gap-2">
            {!res && !rolling && <Btn variant="primary" onClick={roll}>🎲 Бросить d20</Btn>}
            {done && <Btn variant="primary" onClick={onContinue}>Продолжить историю</Btn>}
          </div>
        </div>
      )}
    </Modal>
  );
}
