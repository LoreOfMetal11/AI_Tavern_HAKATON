import { abilityMod, profBonus, fmtMod } from "@/lib/dice";
import { ABILITIES, SKILLS, type AbilityKey } from "./data";

export interface PlayerLike {
  id: number;
  name: string;
  level: number;
  abilities: unknown;
  skills: unknown;
  saves: unknown;
  inventory: unknown;
  hp: number;
  maxHp: number;
  conditions: unknown;
}

export function abilityScores(p: { abilities: unknown }): Record<AbilityKey, number> {
  const a = (p.abilities ?? {}) as Partial<Record<AbilityKey, number>>;
  return { str: a.str ?? 10, dex: a.dex ?? 10, con: a.con ?? 10, int: a.int ?? 10, wis: a.wis ?? 10, cha: a.cha ?? 10 };
}

export function skillLevel(p: { skills: unknown }, key: string): number {
  const arr = (Array.isArray(p.skills) ? p.skills : []) as { key: string; level?: number }[];
  const f = arr.find((s) => s.key === key);
  return f ? (f.level ?? 1) : 0;
}

export function skillMod(p: PlayerLike, key: string): number {
  const sk = SKILLS.find((s) => s.key === key);
  if (!sk) return 0;
  const sc = abilityScores(p);
  return abilityMod(sc[sk.ability]) + skillLevel(p, key) * profBonus(p.level);
}

export function saveMod(p: PlayerLike, ab: AbilityKey): number {
  const sc = abilityScores(p);
  const saves = (Array.isArray(p.saves) ? p.saves : []) as string[];
  return abilityMod(sc[ab]) + (saves.includes(ab) ? profBonus(p.level) : 0);
}

const SKILL_HINTS: [string, RegExp][] = [
  ["stealth", /подкрад|крадус|крад[её]мся|скрытн|прячусь|спрячусь|затаюсь|sneak|hide|stealth/i],
  ["athletics", /взлез|залез|лезу|взбира|плыв|переплы|прыгаю|прыжок|борьб|толкаю|выламыва|выбиваю дверь|ломаю|поднимаю|тащу|climb|swim|jump|shove|grapple|lift/i],
  ["acrobatics", /кувырок|акробат|балансир|увернусь|перекат|tumble|acrobat/i],
  ["persuasion", /убежда|уговарива|договарива|прошу|попрошу|торгуюсь|persuade|negotiate|haggle/i],
  ["deception", /совр[уа]|обману|блеф|притворя|выдаю себя|lie to|bluff|deceive/i],
  ["intimidation", /запуг|угрожа|пугаю|угроза|intimidat|threaten/i],
  ["insight", /лжёт ли|врёт ли|читаю (его|её)|понять,? (врёт|лжёт)|insight/i],
  ["perception", /осматрива|прислушива|замечаю|оглядыва|вслушива|listen|notice|look around|spot/i],
  ["investigation", /обыскива|осматриваю (комнат|стол|тело)|изучаю|ищу (следы|улики|ловушк)|search|inspect|investigat/i],
  ["sleight", /карман|стащу|украду|подбрасываю|pickpocket|steal|palm/i],
  ["survival", /выслежива|иду по следу|охочусь|ориентиру|track|forage|hunt/i],
  ["medicine", /перевязыва|лечу|стабилизиру|останавлива[юя] кровь|bandage|stabilize/i],
  ["arcana", /опознаю (заклинан|магию)|магическ.* знак|руны|arcana/i],
  ["religion", /молюсь|узнаю (символ|бога)|religion/i],
  ["performance", /пою|играю на|выступаю|танцую|sing|perform|dance/i],
];

const ATTACK_RE = /атак|бью|ударю|удар[яю]|рублю|колю|стреляю|пускаю стрел|кидаю (нож|топор|копь)|режу|attack|shoot|strike|stab|slash/i;
const SPELL_RE = /заклинани|колдую|произношу|кастую|cast/i;

const ITEM_WORDS: [string, RegExp][] = [
  ["меч", /\bмеч/i], ["лук/стрелы", /\bлук\b|лука|стрел/i], ["верёвка", /верёвк|веревк|канат/i], ["факел", /факел/i],
  ["зелье", /зель/i], ["кинжал", /кинжал|нож\b|ножом/i], ["щит", /\bщит/i], ["арбалет", /арбалет/i], ["отмычки", /отмычк|воровск/i],
  ["свиток", /свит(ок|ки)/i], ["топор", /топор/i], ["посох", /посох/i], ["книга", /книг/i], ["лампа", /ламп|фонар/i],
  ["молоток", /молот/i], ["лопата", /лопат/i], ["ключ", /\bключ/i],
];

const MODERN_RE = /пистолет|автомат|ружь[её]|винтовк|граната|телефон|компьютер|машин[аеу]\b|бензин|динамит|порох|gun|rifle|phone|grenade|computer|dynamite/i;

function invNames(p: PlayerLike): string[] {
  const inv = (Array.isArray(p.inventory) ? p.inventory : []) as { name: string; qty?: number }[];
  return inv.filter((i) => (i.qty ?? 1) > 0).map((i) => i.name.toLowerCase());
}

export interface Analysis {
  suggested: { skill?: string; ability?: AbilityKey; label: string; mod: number; kind: "skill" | "attack" | "spell" } | null;
  notes: string[];
}

/** Алгоритмическая «проверка здравого смысла»: возможности персонажа, инвентарь, анахронизмы. Без обращения к модели. */
export function analyzeAction(text: string, p: PlayerLike): Analysis {
  const notes: string[] = [];
  const sc = abilityScores(p);
  let suggested: Analysis["suggested"] = null;

  for (const [skill, re] of SKILL_HINTS) {
    if (re.test(text)) {
      const sk = SKILLS.find((s) => s.key === skill)!;
      suggested = { skill, ability: sk.ability, label: sk.name, mod: skillMod(p, skill), kind: "skill" };
      break;
    }
  }
  if (ATTACK_RE.test(text)) {
    const melee = !/стрел|лук|арбалет|shoot|кидаю|бросаю/i.test(text);
    const ab: AbilityKey = melee ? (sc.str >= sc.dex ? "str" : "dex") : "dex";
    suggested = { ability: ab, label: melee ? "Атака ближнего боя" : "Дальняя атака", mod: abilityMod(sc[ab]) + profBonus(p.level), kind: "attack" };
  } else if (SPELL_RE.test(text) && !suggested) {
    suggested = { label: "Заклинание", mod: 0, kind: "spell" };
  }

  // вес / расстояния
  const kg = text.match(/(\d+(?:[.,]\d+)?)\s*(кг|килограмм)/i);
  if (kg) {
    const lb = parseFloat(kg[1].replace(",", ".")) * 2.2;
    const cap = sc.str * 15;
    if (lb > cap * 2) notes.push(`Вес ~${Math.round(lb)} фнт превышает предел толкания/волочения (${cap * 2} фнт) при СИЛ ${sc.str}: физически невозможно.`);
    else if (lb > cap) notes.push(`Вес ~${Math.round(lb)} фнт больше грузоподъёмности ${cap} фнт (СИЛ ${sc.str}): только волочить, скорость вдвое ниже.`);
  }
  const jump = text.match(/прыг\w*[^.]{0,40}?(\d+)\s*(м|метр)/i);
  if (jump) {
    const ft = parseInt(jump[1], 10) * 3.3;
    if (ft > sc.str * 1.5) notes.push(`Прыжок ~${Math.round(ft)} фт: предел с разбега — ${sc.str} фт (СИЛ ${sc.str}).`);
  }

  if (MODERN_RE.test(text)) notes.push("Упомянут предмет, которого может не быть в этом мире (проверь правила мира).");

  const inv = invNames(p);
  const missing: string[] = [];
  for (const [label, re] of ITEM_WORDS) {
    if (re.test(text)) {
      const has = inv.some((n) => re.test(n) || n.includes(label.split("/")[0]));
      if (!has) missing.push(label);
    }
  }
  if (missing.length) notes.push(`Нет в инвентаре (упомянуто): ${missing.join(", ")}. Либо игрок не может этим воспользоваться, либо найдёт в сцене.`);

  const conds = (Array.isArray(p.conditions) ? p.conditions : []) as string[];
  if (conds.length) notes.push(`Состояния: ${conds.join(", ")} — учитывай ограничения.`);
  if (p.hp <= 0) notes.push("Персонаж без сознания / при смерти: не может действовать самостоятельно.");
  else if (p.hp <= p.maxHp / 4) notes.push("Персонаж тяжело ранен (≤25% ЗД): боль и слабость заметны в действиях.");

  return { suggested, notes };
}

export function describeAbilityEffects(sc: Record<AbilityKey, number>): string {
  return ABILITIES.map((a) => `${a.short} ${sc[a.key]} (${fmtMod(abilityMod(sc[a.key]))})`).join(" ");
}
