import { randomInt } from "node:crypto";

export interface DiceTerm {
  count: number;
  sides: number;
  keep?: { mode: "h" | "l"; n: number };
}

export interface DiceResult {
  expr: string;
  rolls: number[];
  kept: number[];
  modifier: number;
  total: number;
}

/** Бросок одного кубика криптостойким ГСЧ на сервере — игрок не может повлиять на результат. */
export function d(sides: number): number {
  return randomInt(1, Math.max(2, sides) + 1);
}

/** Разбор формул вида 2d6+3, 4d6kh3, d20-1, 1d8+1d4+2 */
export function rollExpr(exprRaw: string): DiceResult {
  const expr = exprRaw.replace(/\s+/g, "").toLowerCase().replace(/к/g, "d").replace(/д/g, "d");
  const parts = expr.match(/[+-]?[^+-]+/g) ?? [];
  const allRolls: number[] = [];
  const allKept: number[] = [];
  let modifier = 0;
  let total = 0;
  for (const part of parts) {
    const sign = part.startsWith("-") ? -1 : 1;
    const body = part.replace(/^[+-]/, "");
    const m = body.match(/^(\d*)d(\d+)(?:k([hl])(\d+))?$/);
    if (m) {
      const count = Math.min(100, Math.max(1, parseInt(m[1] || "1", 10)));
      const sides = Math.min(1000, Math.max(2, parseInt(m[2], 10)));
      const rolls = Array.from({ length: count }, () => d(sides));
      let kept = rolls;
      if (m[3]) {
        const n = Math.min(count, parseInt(m[4], 10));
        const sorted = [...rolls].sort((a, b) => (m[3] === "h" ? b - a : a - b));
        kept = sorted.slice(0, n);
      }
      allRolls.push(...rolls);
      allKept.push(...kept);
      total += sign * kept.reduce((a, b) => a + b, 0);
    } else if (/^\d+$/.test(body)) {
      modifier += sign * parseInt(body, 10);
      total += sign * parseInt(body, 10);
    }
  }
  return { expr: exprRaw, rolls: allRolls, kept: allKept, modifier, total };
}

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function profBonus(level: number): number {
  return Math.floor((Math.max(1, level) - 1) / 4) + 2;
}

export function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}
