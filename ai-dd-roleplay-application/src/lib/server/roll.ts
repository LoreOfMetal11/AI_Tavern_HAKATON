import { abilityMod, d, fmtMod, profBonus, rollExpr } from "@/lib/dice";
import { ABILITIES, SKILLS, type AbilityKey } from "@/lib/dnd/data";
import { abilityScores, saveMod, skillMod, type PlayerLike } from "@/lib/dnd/validate";
import { norm } from "./context";
import type { Player } from "./store";

export interface RawCheck {
  p?: string;
  t?: string;
  s?: string;
  dc?: number;
  adv?: number;
  dmg?: string;
  ac?: number;
  why?: string;
}

export interface Check {
  playerId: number;
  playerName: string;
  kind: "skill" | "ability" | "save" | "attack" | "initiative";
  key: string;
  label: string;
  dc: number | null;
  adv: -1 | 0 | 1;
  dmg?: string;
  why: string;
  mod: number; // для интерфейса — модификатор известен заранее
}

export interface RollOutcome {
  check: Check;
  d20: number[];
  chosen: number;
  mod: number;
  total: number;
  success: boolean | null;
  margin: number | null;
  crit: boolean;
  fumble: boolean;
  damage: { expr: string; total: number; rolls: number[] } | null;
  text: string; // для ИИ
  short: string; // для истории
}

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

export function makeCheck(raw: RawCheck, acting: Player[], all: Player[]): Check | null {
  const pool = acting.length ? acting : all;
  if (!pool.length) return null;
  const n = norm(raw.p ?? "");
  const p = pool.find((x) => norm(x.name) === n) ?? all.find((x) => norm(x.name) === n) ?? pool.find((x) => n && norm(x.name).includes(n)) ?? pool[0];
  const kind = (["skill", "ability", "save", "attack", "initiative"].includes(raw.t ?? "") ? raw.t : "skill") as Check["kind"];
  let key = norm(raw.s ?? "");
  const sc = abilityScores(p);
  let label = "";
  let mod = 0;
  if (kind === "skill") {
    const sk = SKILLS.find((x) => x.key === key || norm(x.name) === key) ?? SKILLS.find((x) => key && (norm(x.name).startsWith(key.slice(0, 4)) || x.key.startsWith(key.slice(0, 4)))) ?? SKILLS.find((x) => x.key === "perception")!;
    key = sk.key;
    label = sk.name;
    mod = skillMod(p as PlayerLike, sk.key);
  } else if (kind === "initiative") {
    key = "dex";
    label = "Инициатива";
    mod = abilityMod(sc.dex);
  } else if (kind === "attack") {
    const ab: AbilityKey = ABILITY_KEYS.includes(key) ? (key as AbilityKey) : sc.str >= sc.dex ? "str" : "dex";
    key = ab;
    label = "Атака";
    mod = abilityMod(sc[ab]) + profBonus(p.level);
  } else {
    const ab = (ABILITY_KEYS.includes(key) ? key : ABILITIES.find((a) => norm(a.name).startsWith(key.slice(0, 3)))?.key ?? "con") as AbilityKey;
    key = ab;
    const nm = ABILITIES.find((a) => a.key === ab)!.name;
    label = kind === "save" ? `Спасбросок: ${nm}` : `Проверка: ${nm}`;
    mod = kind === "save" ? saveMod(p as PlayerLike, ab) : abilityMod(sc[ab]);
  }
  const dc = kind === "initiative" ? null : Math.max(1, Math.min(35, Math.round(raw.dc ?? raw.ac ?? 12)));
  return {
    playerId: p.id,
    playerName: p.name,
    kind,
    key,
    label,
    dc,
    adv: raw.adv && raw.adv > 0 ? 1 : raw.adv && raw.adv < 0 ? -1 : 0,
    dmg: raw.dmg,
    why: raw.why ?? "",
    mod,
  };
}

/** Бросок делает сервер: игрок и ИИ не могут повлиять на значение. */
export function resolveCheck(check: Check): RollOutcome {
  const rolls = check.adv === 0 ? [d(20)] : [d(20), d(20)];
  const chosen = check.adv === 1 ? Math.max(...rolls) : check.adv === -1 ? Math.min(...rolls) : rolls[0];
  const total = chosen + check.mod;
  const crit = check.kind === "attack" && chosen === 20;
  const fumble = check.kind === "attack" && chosen === 1;
  let success: boolean | null = null;
  if (check.dc !== null) {
    success = total >= check.dc;
    if (check.kind === "attack") success = crit ? true : fumble ? false : success;
  }
  const margin = check.dc !== null ? total - check.dc : null;
  let damage: RollOutcome["damage"] = null;
  if (check.kind === "attack" && success && check.dmg) {
    const base = rollExpr(check.dmg);
    let totalDmg = base.total;
    let rl = base.rolls;
    if (crit) {
      const extra = rollExpr(check.dmg.replace(/[+-]\s*\d+\s*$/, ""));
      totalDmg += extra.total;
      rl = [...rl, ...extra.rolls];
    }
    damage = { expr: check.dmg, total: Math.max(0, totalDmg), rolls: rl };
  }
  const advTxt = check.adv === 1 ? " (advantage)" : check.adv === -1 ? " (disadvantage)" : "";
  const dieTxt = `d20[${rolls.join(",")}]${advTxt} ${fmtMod(check.mod)} = ${total}`;
  let verdict = "";
  if (check.kind === "attack") verdict = `${crit ? "CRITICAL HIT" : fumble ? "CRITICAL MISS" : success ? "HIT" : "MISS"} vs AC ${check.dc}${damage ? `, damage ${damage.total} (${damage.expr}${crit ? ", doubled dice" : ""})` : ""}`;
  else if (check.dc !== null) verdict = `${success ? "SUCCESS" : "FAILURE"} vs DC ${check.dc} (${margin! >= 0 ? "by " : "short by "}${Math.abs(margin!)})`;
  else verdict = `result ${total}`;
  const text = `ROLL RESULT (system, final): ${check.playerName} — ${check.label}${check.why ? ` (${check.why})` : ""}: ${dieTxt} → ${verdict}. Narrate exactly this outcome in this single reply (a miss/failure must really fail; apply any damage to the target). Do not request another roll.`;
  const short = `Roll: ${check.label} ${total}${check.dc !== null ? ` vs ${check.dc}` : ""} — ${check.kind === "attack" ? (success ? (crit ? "crit" : "hit") : "miss") : check.dc !== null ? (success ? "success" : "failure") : "ok"}${damage ? `, dmg ${damage.total}` : ""}`;
  return { check, d20: rolls, chosen, mod: check.mod, total, success, margin, crit, fumble, damage, text, short };
}
