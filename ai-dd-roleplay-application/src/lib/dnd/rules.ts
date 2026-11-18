// Встроенные книги правил, ЗАРАНЕЕ адаптированные под ИИ: сжатый английский, секции с ключевыми словами.
// Формат секции:  ## Название | kw: слово1, слово2  — ключевые слова нужны для выборочной подгрузки.
// Секция с kw: * подгружается всегда.

const CORE = `
## Core loop | kw: *
You are the Dungeon Master. Loop: player states intent -> you decide if outcome is uncertain AND meaningful -> if yes request ONE roll -> narrate result and consequences -> hand turn back with a clear situation.
No roll for trivial tasks or impossible ones. Never roll to please the player. Stats ALWAYS shape narration even without dice (STR 18 crushes cups in a handshake, CHA 6 sounds rude, high INT notices details).
Failure moves story forward (cost, complication), not a dead stop. Success gives what was intended, not more.

## Ability checks | kw: check, roll, dc, skill, try, attempt, проверка, бросок, попытка
d20 + ability mod + proficiency (if proficient; x2 if expertise) vs DC. DC: very easy 5, easy 10, medium 15, hard 20, very hard 25, nearly impossible 30.
Advantage/disadvantage: roll 2d20, keep higher/lower. They never stack; one of each cancels. Passive check = 10 + mods (+5 adv, -5 dis).
Group check: half or more succeed. Contest: both roll, higher wins (tie: status quo).
Skills: Athletics STR; Acrobatics, Sleight of Hand, Stealth DEX; Arcana, History, Investigation, Nature, Religion INT; Animal Handling, Insight, Medicine, Perception, Survival WIS; Deception, Intimidation, Performance, Persuasion CHA.

## Saving throws | kw: save, saving, dodge, resist, spell, trap, breath, спасбросок, ловушка
d20 + ability mod + proficiency (if proficient in that save) vs DC. Used when something happens TO a character: traps, spells, poison, breath weapons. Natural 20/1 on saves has no special effect except death saves.

## Combat flow | kw: combat, fight, attack, initiative, round, turn, battle, strike, hit, бой, атака, инициатива, удар
Start: everyone rolls initiative (d20+DEX). Surprised creatures cannot act in round 1. Each turn: move (up to speed) + action + bonus action (if any) + free interaction + reaction (once per round).
Actions: Attack, Cast a Spell, Dash, Disengage, Dodge, Help, Hide, Ready, Search, Use an Object.
Attack roll: d20 + ability mod + proficiency vs target AC. Nat 20 = hit and crit (double damage dice). Nat 1 = miss. Damage = weapon dice + ability mod (STR melee, DEX ranged/finesse).
Ranged in melee range or long range: disadvantage. Attacking prone: melee adv, ranged dis. Unseen attacker: advantage; unseen target: disadvantage.
Cover: half +2 AC/DEX saves, three-quarters +5, total cannot be targeted directly.
Opportunity attack: reaction when an enemy leaves your reach without Disengage.
Two-weapon fighting: bonus action off-hand attack without ability mod to damage.

## Damage and death | kw: damage, hp, hit points, heal, death, dying, unconscious, kill, wound, урон, смерть, здоровье, лечение, ранение
HP 0 = a PC falls unconscious and makes death saves at start of each turn: d20, 10+ success, below 10 failure, nat 20 = regain 1 HP, nat 1 = two failures. 3 successes = stable, 3 failures = dead. Damage while at 0 HP = one failure (crit = two). Massive damage: if remaining damage after reaching 0 >= max HP, instant death. Monsters usually die at 0 HP.
Resistance halves damage, vulnerability doubles, immunity negates. Temp HP absorbs first and does not stack.
Healing never exceeds max HP. Healing potion 2d4+2. Short rest: spend hit dice (d-die + CON mod). Long rest (8h): all HP, half of max hit dice.
Describe wounds vividly and persistently: a broken arm stays broken until healed.

## Conditions | kw: blinded, charmed, deafened, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious, exhaustion, condition, состояние, отравлен, схвачен
Blinded: auto-fail sight checks, attacks vs it have adv, its attacks dis. Charmed: cannot attack charmer. Frightened: dis on checks/attacks while source in sight, cannot move closer. Grappled: speed 0. Incapacitated: no actions/reactions. Invisible: attacks vs it dis, its attacks adv. Paralyzed: incapacitated, auto-fail STR/DEX saves, attacks adv, hits within 5 ft are crits. Poisoned: dis on attacks and checks. Prone: crawl or stand (half speed); melee adv vs it, ranged dis. Restrained: speed 0, attacks vs it adv, its attacks dis, dis DEX saves. Stunned: incapacitated, auto-fail STR/DEX saves, attacks vs it adv. Unconscious: prone, drops items, hits within 5 ft are crits. Exhaustion levels 1-6: 1 dis checks, 2 speed half, 3 dis attacks/saves, 4 HP max half, 5 speed 0, 6 death.

## Spellcasting | kw: spell, cast, magic, cantrip, slot, concentration, ritual, component, заклинание, магия, заговор
Spell slots are spent on casting; cantrips are free. Casting at a higher slot boosts the spell. Concentration: one at a time; on damage CON save DC 10 or half damage (higher) or lose it. Spell attack = d20 + spellcasting mod + prof. Spell save DC = 8 + prof + spellcasting mod. Components V/S/M; no free hand = no S. Ritual spells take +10 min, no slot.
Track slots and consumed material components on the character sheet.

## Social interaction | kw: persuade, talk, negotiate, lie, deceive, intimidate, charm, bribe, haggle, social, убеждение, обман, запугивание, торговля, переговоры
NPC has attitude: friendly, indifferent, hostile. Good arguments/leverage/gifts shift DC; hostile NPC: DC 20, indifferent: 15, friendly: 10. Roleplay good ideas with no roll if leverage is clear. NPCs act only on what they KNOW; lies work only if believable. Intimidation can create enemies; Deception can be caught later.

## Exploration and travel | kw: travel, journey, explore, search, trap, door, lock, climb, swim, jump, camp, forage, hunt, путешествие, поиск, замок, лазание, прыжок, привал
Travel pace per hour: slow 2 mi (stealth), normal 3 mi, fast 4 mi (-5 passive Perception). 8 hours travel/day; more = CON save or exhaustion.
Long jump = STR score ft with 10 ft run-up; high jump = 3 + STR mod ft. Carry capacity 15 x STR lb; push/drag 30 x STR. Swimming/climbing costs double movement without a speed.
Falling: 1d6 bludgeoning per 10 ft (max 20d6). Suffocation: CON mod+1 minutes breath. Lock picking: thieves' tools, DC 10-25. Traps: spot with Investigation/Perception, disarm with tools or DEX.
Light: bright, dim (lightly obscured, dis on Perception), dark (blind). Torch 20ft bright + 20 dim for 1 hour.

## Equipment and economy | kw: buy, sell, gold, price, shop, inventory, item, weapon, armor, potion, coin, equipment, купить, цена, золото, предмет, оружие, доспех, зелье
10 cp = 1 sp, 10 sp = 1 gp. Prices: meal 3 sp, inn night 5 sp, dagger 2 gp, longsword 15 gp, chain mail 75 gp, rope 1 gp, torch 1 cp, healing potion 50 gp, rations 5 sp/day.
Armor AC: padded/leather 11+DEX, studded 12+DEX, hide 12+DEX(max2), chain shirt 13+DEX(max2), scale 14+DEX(max2), breastplate 14+DEX(max2), half plate 15+DEX(max2), ring 14, chain mail 16, splint 17, plate 18, shield +2. Heavy armor needs STR or speed -10.
Consumables (potions, arrows, rations, torches, scrolls) MUST be deducted when used. Items that do not exist in the world or that the PC does not carry cannot be used.

## Leveling | kw: level, xp, experience, advance, milestone, уровень, опыт
XP thresholds: 2:300, 3:900, 4:2700, 5:6500, 6:14000, 7:23000, 8:34000, 9:48000, 10:64000. Proficiency bonus: lvl 1-4 +2, 5-8 +3, 9-12 +4, 13-16 +5, 17+ +6. Milestone leveling is allowed. Level up gives HP (die avg + CON) and class features.

## Monsters and encounters | kw: monster, enemy, creature, encounter, goblin, orc, dragon, undead, boss, challenge, чудовище, враг, монстр, гоблин, дракон
Monster stat line: AC, HP, speed, attack bonus, damage, special. Typical CR 1/4 goblin: AC 15, HP 7, +4 to hit, 1d6+2. CR 1 bandit captain-level: AC 15, HP 65 (captain), +5, 2 attacks. CR 5 troll: AC 15, HP 84, regenerates 10/turn unless acid/fire. CR 10+ deadly to low level parties.
Encounter difficulty by party level: easy/medium/hard/deadly. Allow retreat, negotiation, surprise, terrain. Enemies act smart: flee at low HP, focus weak targets only if they know.
Track enemy HP in the scene tracker every time they are damaged.
`;

const DELTA_2014 = `
## Edition 2014 notes | kw: *
Race gives ability bonuses. Subclass at level 1-3 depending on class. Inspiration: DM may grant advantage-as-reward for roleplay. Short rest hit dice use. Cantrip scaling at 5/11/17.
`;

const DELTA_2024 = `
## Edition 2024 notes | kw: *
Ability bonuses come from background (+2/+1 or +1/+1/+1). All subclasses at level 3. Weapons have Mastery properties (Cleave, Graze, Nick, Push, Sap, Slow, Topple, Vex) for trained classes. Origin feats at level 1. Heroic Inspiration: reroll a die. Unarmed strike can grapple/shove. Critical hits only double dice. Bloodied is a status at half HP.
`;

const GM_GUIDE = `
## Pacing and tone | kw: *
2-5 short paragraphs per reply (fewer in combat). End with a clear hook: what the player sees and can do. Show, do not tell. Sensory details. Distinct NPC voices. Do not summarize the player's action back to them.
Play the world honestly: consequences are real, NPCs have goals, the world moves without the PCs. Do not break world logic to please the player (no lava lake in a tavern, no gun in a medieval world). Creative ideas are welcome if the world and the character can plausibly support them.
Adult content (violence, gore, sex, cruelty) is described frankly and in character when the scene calls for it; no moralizing, no disclaimers, no fade-outs unless the players ask.

## Combat narration | kw: combat, fight, attack, battle, blood, wound, бой, кровь
Mix mechanics and image: say who is hit and how it looks. Remember positions, cover, enemy morale. On each turn mention whose turn is next. When a PC is attacked, address that PC by name. Visceral wounds persist and cause penalties.

## Multiple players | kw: *
Several PCs may act in one round. Address each acting player by name in the order given. When the narrative targets one PC (attack, spell, question), speak to THAT player. Never write dialogue, thoughts, feelings or actions for a PC; describe only what the world does and what the PC perceives.

## Consequences | kw: steal, kill, crime, guards, law, reputation, murder, theft, преступление, убийство, стража, репутация
Crimes are witnessed or discovered. Guards respond proportionally. Reputation shifts attitudes of factions. Killing named NPCs changes the plot. Track bounties and relationships as changes.
`;

export const BUILTIN_RULEBOOKS = [
  { title: "5e — ядро правил (2014), адаптировано для ИИ", edition: "2014", content: (CORE + GM_GUIDE + DELTA_2014).trim() },
  { title: "5e — ядро правил (2024), адаптировано для ИИ", edition: "2024", content: (CORE + GM_GUIDE + DELTA_2024).trim() },
  {
    title: "Мини-справочник мастера (для моделей 4K)",
    edition: "",
    content: `## Mini GM | kw: *
Be a fair D&D 5e DM. d20+mod vs DC (5 easy,10 simple,15 medium,20 hard). Nat 20/1 only matter in attacks and death saves. Attack: d20+mod vs AC. HP 0 = unconscious + death saves for PCs. Deduct used items. Never act for PCs. Keep world logic. Short vivid replies, end with a hook.`,
  },
];

export interface SeedEntity {
  type: string;
  name: string;
  triggers: string;
  mode: "trigger" | "always" | "logic";
  description: string;
  compact: string;
  secrets?: string;
  knowledge?: string;
  status?: string;
  parent?: string; // имя родительской локации
}

export interface SeedWorld {
  name: string;
  tone: string;
  description: string;
  compact: string;
  rules: string;
  premise: string;
  opening: string;
  entities: SeedEntity[];
  relations: { from: string; to: string; label: string }[];
}

export const SEED_WORLDS: SeedWorld[] = [
  {
    name: "Побережье Туманов",
    tone: "Морская авантюра, интриги портовых городов, суеверия, лёгкая тень ужаса.",
    description:
      "Торговые города-республики на изрезанном побережье, где с моря каждый вечер приходит неестественный туман. Магия редка и дорога, порох неизвестен. В тумане люди иногда исчезают, а иногда возвращаются — не теми.",
    compact:
      "Coastal city-states, sea trade, low magic (rare, costly), no gunpowder. A strange fog rolls in each dusk; people vanish or return changed. Guilds and smugglers rule ports. Tone: nautical adventure, intrigue, creeping dread.",
    rules: "Низкая магия. Нет огнестрельного оружия. Боги почитаются как покровители ремёсел и моря.",
    premise: "В порту Серый Причал пропали три корабля подряд. Гильдия торговцев нанимает искателей приключений разобраться, пока город не взбунтовался.",
    opening:
      "Вечерний туман ползёт по пирсам Серого Причала. В таверне «Ржавый якорь» пахнет смолой и пролитым элем, а за дальним столом седой капитан третий раз перечитывает записку и не поднимает глаз. Дверь скрипит, впуская холод.",
    entities: [
      { type: "location", name: "Серый Причал", triggers: "причал, порт, город, серый причал", mode: "always", description: "Главный порт побережья: узкие улицы, склады, шумные рынки. Власть делят Гильдия торговцев и городская стража.", compact: "Grey Wharf: main port city. Narrow streets, warehouses, markets. Ruled jointly by Merchant Guild and City Watch. Fog every dusk." },
      { type: "location", name: "Таверна «Ржавый якорь»", triggers: "таверна, ржавый якорь, трактир", mode: "trigger", description: "Портовая таверна, где собираются моряки и контрабандисты. Хозяйка — Марта Кроу.", compact: "Rusty Anchor: dockside tavern, sailors and smugglers. Owner Marta Crow. Rooms 5sp/night.", parent: "Серый Причал" },
      { type: "location", name: "Туманные Рифы", triggers: "рифы, туманные рифы, пропавшие корабли", mode: "logic", description: "Опасные скалы у входа в бухту. Здесь исчезли корабли. В густом тумане слышен колокольный звон.", compact: "Mist Reefs: dangerous rocks at harbor mouth, ships vanished here. A bell tolls inside the fog.", secrets: "Под рифами лежит затонувший храм, а колокол звонит сам." },
      { type: "character", name: "Марта Кроу", triggers: "марта, кроу, хозяйка, трактирщица", mode: "trigger", description: "Крепкая вдова лет пятидесяти, хозяйка «Ржавого якоря». Знает всех и всё, но продаёт сведения за услугу.", compact: "Marta Crow, ~50, widow, owns the Rusty Anchor. Shrewd, blunt, trades info for favors. Protective of regulars.", knowledge: "Знает, что капитан Хельм прячет карту. Слышала колокол с рифов.", status: "жива, здорова" },
      { type: "character", name: "Капитан Хельм", triggers: "капитан, хельм, седой капитан", mode: "trigger", description: "Седой капитан, единственный вернувшийся с Туманных Рифов. Говорит мало и вздрагивает от звона.", compact: "Captain Helm, grey-haired, only survivor from the Reefs. Silent, flinches at bells. Hides a chart.", secrets: "Он не выжил — он вернулся иным и слышит зов колокола.", knowledge: "Видел затонувший храм.", status: "подавлен, скрывает карту" },
      { type: "faction", name: "Гильдия торговцев", triggers: "гильдия, торговцы, гильдмастер", mode: "trigger", description: "Богатейшая сила города. Теряет деньги из-за пропавших кораблей, готова платить и закрывать глаза на методы.", compact: "Merchant Guild: richest power in Grey Wharf, losing money to vanished ships, pays well, ignores methods." },
      { type: "quest", name: "Пропавшие корабли", triggers: "пропавшие корабли, задание, расследование", mode: "always", description: "Выяснить, что стало с тремя кораблями. Награда — 300 зм от Гильдии.", compact: "Quest: find what happened to three vanished ships. Reward 300gp from the Guild. Clue: Captain Helm, the Reefs, a bell.", status: "активен" },
      { type: "rumor", name: "Слух о колоколе", triggers: "колокол, звон", mode: "trigger", description: "Матросы шепчутся: кто услышал колокол в тумане — тот уже принадлежит морю.", compact: "Rumor: those who hear the bell in the fog already belong to the sea." },
    ],
    relations: [
      { from: "Марта Кроу", to: "Капитан Хельм", label: "жалеет и приглядывает" },
      { from: "Гильдия торговцев", to: "Серый Причал", label: "контролирует торговлю" },
    ],
  },
  {
    name: "Пепельные Земли",
    tone: "Тёмное фэнтези, выживание, моральные дилеммы, суровая магия с ценой.",
    description:
      "Королевство Ардейн пало после Пепельной ночи — магического пожара, спалившего столицу. Теперь на руинах правят разбойничьи лорды, культы и вымирающие гарнизоны. Магия сильна, но каждый заговор оставляет на теле метку пепла.",
    compact:
      "Fallen kingdom of Ardein after the Ashen Night (magical fire razed the capital). Bandit lords, cults, dwindling garrisons. Magic is strong but each casting leaves an ash-mark on the caster's body. Tone: grim dark fantasy, survival, hard choices.",
    rules: "Каждое заклинание оставляет метку пепла (визуально, накопительно). Лечение редкое. Нежить встречается в руинах.",
    premise: "Караван беженцев идёт к последней крепости Ардейна. Вас наняли охранять его, но у каравана есть свой секрет.",
    opening:
      "Пепел падает как серый снег. Караван из семи повозок замер перед обрушенным мостом, и возчики оглядываются на кромку леса. Старшая каравана, Лиара, шагает к вам: «Нужно, чтобы кто-то посмотрел, что там, впереди, пока не стемнело».",
    entities: [
      { type: "location", name: "Руины Ардейна", triggers: "руины, ардейн, столица", mode: "always", description: "Сожжённая столица: чёрные стены, пепельные дюны, бродячие мертвецы.", compact: "Ruins of Ardein: burnt capital, black walls, ash dunes, wandering undead." },
      { type: "location", name: "Крепость Последний Дозор", triggers: "крепость, дозор, последний дозор", mode: "trigger", description: "Последний гарнизон королевства. Запасы на исходе, командир всё ещё верит в возрождение.", compact: "Last Watch fortress: final garrison, low supplies, commander still believes in restoration." },
      { type: "character", name: "Лиара", triggers: "лиара, старшая, караван", mode: "trigger", description: "Жёсткая предводительница каравана, бывшая королевская разведчица. Скрывает, что везёт в повозке.", compact: "Liara, caravan leader, ex-royal scout. Tough, laconic, protective. Hides cargo in the 7th wagon.", secrets: "В седьмой повозке — наследник короны, тяжело ранен.", knowledge: "Знает безопасные тропы к Дозору.", status: "напряжена" },
      { type: "character", name: "Брат Кассиан", triggers: "кассиан, брат, монах, культ", mode: "logic", description: "Странствующий монах в тёмном, слишком любопытный к грузу каравана.", compact: "Brother Cassian, wandering monk in black, too curious about the cargo. Actually a cultist of the Ash Choir.", secrets: "Агент Пепельного Хора, ищет наследника.", status: "притворяется паломником" },
      { type: "faction", name: "Пепельный Хор", triggers: "хор, пепельный хор, культ", mode: "trigger", description: "Культ, поклоняющийся огню Пепельной ночи. Хочет повторить катастрофу.", compact: "Ash Choir: cult worshipping the Ashen Night fire, wants to repeat it. Marked with ash scars." },
      { type: "quest", name: "Охрана каравана", triggers: "охрана, караван, задание", mode: "always", description: "Довести караван до Последнего Дозора живым. Оплата — 50 зм каждому и место в крепости.", compact: "Quest: escort caravan to Last Watch alive. Pay 50gp each plus a place in the fortress.", status: "активен" },
    ],
    relations: [
      { from: "Брат Кассиан", to: "Пепельный Хор", label: "тайный агент" },
      { from: "Лиара", to: "Крепость Последний Дозор", label: "ведёт караван" },
    ],
  },
];
