// Данные D&D 5e для интерфейса и для сборки контекста ИИ. Редакции: 2014 (PHB) и 2024.

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export const ABILITIES: { key: AbilityKey; name: string; short: string; desc: string; low: string; high: string }[] = [
  { key: "str", name: "Сила", short: "СИЛ", desc: "Мощь тела: атаки в ближнем бою, подъём и броски тяжестей, борьба, взлом.", low: "Слаб: не поднимет тяжёлое, роняет вещи, проигрывает борьбу.", high: "Ломает посуду и двери в бытовых действиях, пугает хваткой, носит больше." },
  { key: "dex", name: "Ловкость", short: "ЛОВ", desc: "Рефлексы и координация: КД в лёгкой броне, стрельба, скрытность, акробатика, инициатива.", low: "Неуклюж: спотыкается, медленно реагирует, шумит.", high: "Бесшумен, грациозен, уворачивается, ловит предметы на лету." },
  { key: "con", name: "Телосложение", short: "ТЕЛ", desc: "Выносливость: здоровье, стойкость к ядам, болезням, усталости.", low: "Хрупок, быстро устаёт, болеет.", high: "Живуч, переносит жару, голод и выпивку." },
  { key: "int", name: "Интеллект", short: "ИНТ", desc: "Знания и логика: магия волшебника, история, расследование, анализ.", low: "Туго соображает, путает факты, говорит просто.", high: "Замечает связи, помнит детали, говорит точно." },
  { key: "wis", name: "Мудрость", short: "МДР", desc: "Восприятие и интуиция: внимательность, проницательность, магия жреца и друида.", low: "Невнимателен, легко обманывается.", high: "Чует ложь и опасность, трезво оценивает." },
  { key: "cha", name: "Харизма", short: "ХАР", desc: "Сила личности: убеждение, обман, запугивание, магия чародея, колдуна и барда.", low: "Грубоват, отталкивает, люди держатся настороженно.", high: "Располагает к себе, заставляет слушать, сильнее пугает и вдохновляет." },
];

export const SKILLS: { key: string; name: string; ability: AbilityKey; desc: string; effect: string }[] = [
  { key: "acrobatics", name: "Акробатика", ability: "dex", desc: "Баланс, кувырки, прыжки, высвобождение из захвата.", effect: "Удержаться на узкой балке, уйти от захвата, эффектный трюк." },
  { key: "animal", name: "Уход за животными", ability: "wis", desc: "Успокоить зверя, понять его поведение, управлять верховым.", effect: "Приручение, верховая езда в бою, чтение намерений зверя." },
  { key: "arcana", name: "Магия", ability: "int", desc: "Знания о заклинаниях, существах, планах и магических предметах.", effect: "Опознать заклинание/артефакт, понять природу магии." },
  { key: "athletics", name: "Атлетика", ability: "str", desc: "Лазание, плавание, прыжки, борьба, толкание.", effect: "Залезть на стену, переплыть реку, повалить врага." },
  { key: "deception", name: "Обман", ability: "cha", desc: "Ложь, маскировка, блеф.", effect: "Убедительно соврать, сыграть роль, подделать слова." },
  { key: "history", name: "История", ability: "int", desc: "Знания о событиях, правителях, войнах, легендах.", effect: "Вспомнить факт о прошлом, распознать герб." },
  { key: "insight", name: "Проницательность", ability: "wis", desc: "Определить ложь и намерения.", effect: "Понять, врёт ли собеседник, что он скрывает." },
  { key: "intimidation", name: "Запугивание", ability: "cha", desc: "Угроза, давление, демонстрация силы.", effect: "Выбить информацию, заставить отступить." },
  { key: "investigation", name: "Расследование", ability: "int", desc: "Поиск улик, дедукция, анализ механизмов.", effect: "Найти потайную дверь, понять, как сработала ловушка." },
  { key: "medicine", name: "Медицина", ability: "wis", desc: "Стабилизация, диагностика, лечение болезней.", effect: "Остановить кровотечение, определить яд." },
  { key: "nature", name: "Природа", ability: "int", desc: "Знания о растениях, животных, погоде, местности.", effect: "Определить съедобное, предсказать погоду." },
  { key: "perception", name: "Внимательность", ability: "wis", desc: "Заметить, услышать, учуять.", effect: "Заметить засаду, прислушаться за дверью. Пассивно = 10 + мод." },
  { key: "performance", name: "Выступление", ability: "cha", desc: "Музыка, пение, актёрство, рассказ.", effect: "Заработать на площади, очаровать публику." },
  { key: "persuasion", name: "Убеждение", ability: "cha", desc: "Честные переговоры, дипломатия, обаяние.", effect: "Договориться, склонить на свою сторону." },
  { key: "religion", name: "Религия", ability: "int", desc: "Знания о богах, обрядах, нежити и культах.", effect: "Опознать символ, ритуал, слабость нежити." },
  { key: "sleight", name: "Ловкость рук", ability: "dex", desc: "Карманные кражи, фокусы, незаметные манипуляции.", effect: "Стащить кошелёк, подложить предмет." },
  { key: "stealth", name: "Скрытность", ability: "dex", desc: "Двигаться и прятаться незаметно.", effect: "Подкрасться, спрятаться, застать врасплох." },
  { key: "survival", name: "Выживание", ability: "wis", desc: "Выслеживание, ориентирование, охота, привал.", effect: "Найти след, не заблудиться, добыть еду." },
];

export const ALIGNMENTS: { key: string; name: string; desc: string; effect: string }[] = [
  { key: "LG", name: "Законно-добрый", desc: "Честь, долг, защита слабых.", effect: "Держит слово, не бьёт беззащитных; нарушение кодекса мучает совесть." },
  { key: "NG", name: "Нейтрально-добрый", desc: "Помогает по доброте, без догм.", effect: "Гибок в методах, но не причиняет зло без нужды." },
  { key: "CG", name: "Хаотично-добрый", desc: "Свобода и добро выше законов.", effect: "Нарушает несправедливые правила, ненавидит тиранов." },
  { key: "LN", name: "Законно-нейтральный", desc: "Порядок и традиция.", effect: "Следует закону и контракту независимо от морали." },
  { key: "N", name: "Нейтральный", desc: "Баланс, прагматизм.", effect: "Выбирает по обстоятельствам, не лезет в чужие конфликты." },
  { key: "CN", name: "Хаотично-нейтральный", desc: "Непредсказуем, ценит свободу.", effect: "Действует по прихоти; плохо подчиняется приказам." },
  { key: "LE", name: "Законно-злой", desc: "Власть через систему и контракт.", effect: "Хитёр и методичен, честен в сделках, жесток к врагам." },
  { key: "NE", name: "Нейтрально-злой", desc: "Личная выгода без угрызений.", effect: "Предаст при выгоде, готов на жестокость." },
  { key: "CE", name: "Хаотично-злой", desc: "Разрушение и жестокость.", effect: "Импульсивен и опасен; союзники ему не доверяют." },
];

export interface RaceDef {
  key: string;
  name: string;
  asi: Partial<Record<AbilityKey, number>>;
  speed: number;
  size: string;
  traits: string;
  subraces?: { name: string; asi: Partial<Record<AbilityKey, number>>; traits: string }[];
}

export const RACES: RaceDef[] = [
  { key: "human", name: "Человек", asi: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, speed: 30, size: "Средний", traits: "Универсальность, +1 ко всем характеристикам, дополнительный язык." },
  { key: "elf", name: "Эльф", asi: { dex: 2 }, speed: 30, size: "Средний", traits: "Тёмное зрение 60 фт, острые чувства (Внимательность), предки фей (преимущество против очарования), транс вместо сна.", subraces: [
    { name: "Высший эльф", asi: { int: 1 }, traits: "Один заговор волшебника, владение длинным мечом и луками." },
    { name: "Лесной эльф", asi: { wis: 1 }, traits: "Скорость 35 фт, маскировка в природе." },
    { name: "Тёмный эльф (дроу)", asi: { cha: 1 }, traits: "Тёмное зрение 120 фт, чувствительность к солнцу, врождённая магия." },
  ] },
  { key: "dwarf", name: "Дварф", asi: { con: 2 }, speed: 25, size: "Средний", traits: "Тёмное зрение, стойкость к яду, знание камня, скорость не снижается от тяжёлой брони.", subraces: [
    { name: "Холмовой дварф", asi: { wis: 1 }, traits: "+1 хит за уровень." },
    { name: "Горный дварф", asi: { str: 2 }, traits: "Владение лёгкой и средней бронёй." },
  ] },
  { key: "halfling", name: "Полурослик", asi: { dex: 2 }, speed: 25, size: "Маленький", traits: "Удачливый (перебросить 1), храбрый, проворный.", subraces: [
    { name: "Коренастый", asi: { con: 1 }, traits: "Стойкость к яду." },
    { name: "Легконогий", asi: { cha: 1 }, traits: "Может прятаться за более крупными существами." },
  ] },
  { key: "dragonborn", name: "Драконорождённый", asi: { str: 2, cha: 1 }, speed: 30, size: "Средний", traits: "Драконье наследие, дыхательное оружие, сопротивление стихии." },
  { key: "gnome", name: "Гном", asi: { int: 2 }, speed: 25, size: "Маленький", traits: "Тёмное зрение, гномья хитрость (преимущество на спасброски ИНТ/МДР/ХАР против магии).", subraces: [
    { name: "Лесной гном", asi: { dex: 1 }, traits: "Говорит с мелкими зверьками, заговор «малая иллюзия»." },
    { name: "Скальный гном", asi: { con: 1 }, traits: "Знание механизмов, создание безделушек." },
  ] },
  { key: "halfelf", name: "Полуэльф", asi: { cha: 2 }, speed: 30, size: "Средний", traits: "+1 к двум другим характеристикам, тёмное зрение, предки фей, два доп. навыка." },
  { key: "halforc", name: "Полуорк", asi: { str: 2, con: 1 }, speed: 30, size: "Средний", traits: "Тёмное зрение, неуёмная стойкость (1 раз остаться на 1 хите), свирепые атаки." },
  { key: "tiefling", name: "Тифлинг", asi: { cha: 2, int: 1 }, speed: 30, size: "Средний", traits: "Тёмное зрение, адское сопротивление огню, инфернальное наследие (магия)." },
];

export interface ClassDef {
  key: string;
  name: string;
  hitDie: number;
  saves: AbilityKey[];
  skillCount: number;
  skillPool: string[];
  primary: string;
  desc: string;
  armor: string;
  baseAc: number;
  gear: { name: string; qty: number; desc: string }[];
  features: string;
  gold: number;
  subclassLevel: number;
  subclasses: { name: string; desc: string }[];
  recommended: Partial<Record<AbilityKey, number>>;
}

const ALL = SKILLS.map((s) => s.key);

export const CLASSES: ClassDef[] = [
  { key: "barbarian", name: "Варвар", hitDie: 12, saves: ["str", "con"], skillCount: 2, skillPool: ["animal", "athletics", "intimidation", "nature", "perception", "survival"], primary: "Сила, Телосложение", desc: "Яростный воин, живучий и страшный в ближнем бою.", armor: "Без доспехов (КД = 10 + ЛОВ + ТЕЛ), щит", baseAc: 13,
    gear: [{ name: "Секира", qty: 1, desc: "1d12 рубящий" }, { name: "Ручные топоры", qty: 2, desc: "1d6, метательные" }, { name: "Набор путешественника", qty: 1, desc: "верёвка, трут, рационы" }], features: "Ярость (+урон, сопротивление физическому), Защита без доспехов.", gold: 20, subclassLevel: 3,
    subclasses: [{ name: "Путь берсерка", desc: "Безумная ярость, дополнительные атаки." }, { name: "Путь тотемного воина", desc: "Звериные духи: медведь, орёл, волк." }, { name: "Путь буйного сердца", desc: "Стихийная ярость и магия предков." }], recommended: { str: 15, con: 14, dex: 13, wis: 12, cha: 10, int: 8 } },
  { key: "bard", name: "Бард", hitDie: 8, saves: ["dex", "cha"], skillCount: 3, skillPool: ALL, primary: "Харизма", desc: "Артист и заклинатель: вдохновляет союзников, мастер слова.", armor: "Лёгкая броня", baseAc: 12,
    gear: [{ name: "Рапира", qty: 1, desc: "1d8 колющий, фехтовальное" }, { name: "Лютня", qty: 1, desc: "музыкальный инструмент" }, { name: "Кожаный доспех", qty: 1, desc: "КД 11 + ЛОВ" }, { name: "Кинжал", qty: 1, desc: "1d4" }], features: "Бардовское вдохновение, заклинания, универсальность.", gold: 125, subclassLevel: 3,
    subclasses: [{ name: "Коллегия знаний", desc: "Острый ум, дополнительные навыки, срыв чужих действий." }, { name: "Коллегия доблести", desc: "Боевой бард в средней броне." }, { name: "Коллегия очарования", desc: "Мастер соблазна и внушения." }], recommended: { cha: 15, dex: 14, con: 13, wis: 12, int: 10, str: 8 } },
  { key: "cleric", name: "Жрец", hitDie: 8, saves: ["wis", "cha"], skillCount: 2, skillPool: ["history", "insight", "medicine", "persuasion", "religion"], primary: "Мудрость", desc: "Проводник воли божества: исцеление, защита, священный гнев.", armor: "Средняя броня, щит", baseAc: 16,
    gear: [{ name: "Булава", qty: 1, desc: "1d6 дробящий" }, { name: "Кольчуга", qty: 1, desc: "КД 16" }, { name: "Щит", qty: 1, desc: "+2 КД" }, { name: "Священный символ", qty: 1, desc: "фокусировка заклинаний" }], features: "Заклинания жреца, Божественный домен, Channel Divinity.", gold: 125, subclassLevel: 1,
    subclasses: [{ name: "Домен жизни", desc: "Усиленное исцеление, тяжёлая броня." }, { name: "Домен света", desc: "Огонь и сияние против тьмы." }, { name: "Домен войны", desc: "Боевой жрец, божественные удары." }, { name: "Домен знаний", desc: "Тайны, языки, ясновидение." }], recommended: { wis: 15, con: 14, str: 13, cha: 12, dex: 10, int: 8 } },
  { key: "druid", name: "Друид", hitDie: 8, saves: ["int", "wis"], skillCount: 2, skillPool: ["arcana", "animal", "insight", "medicine", "nature", "perception", "religion", "survival"], primary: "Мудрость", desc: "Хранитель природы: превращается в зверей, повелевает стихиями.", armor: "Лёгкая и средняя (не металлическая), щит", baseAc: 13,
    gear: [{ name: "Посох", qty: 1, desc: "1d6 дробящий, фокусировка" }, { name: "Кожаный доспех", qty: 1, desc: "КД 11 + ЛОВ" }, { name: "Деревянный щит", qty: 1, desc: "+2 КД" }, { name: "Набор травника", qty: 1, desc: "лекарственные травы" }], features: "Друидический, заклинания, Дикий облик (со 2 уровня).", gold: 50, subclassLevel: 2,
    subclasses: [{ name: "Круг земли", desc: "Магия местности, восстановление сил." }, { name: "Круг луны", desc: "Боевые превращения в могучих зверей." }, { name: "Круг пастыря", desc: "Дух-союзники и призыв." }], recommended: { wis: 15, con: 14, dex: 13, int: 12, cha: 10, str: 8 } },
  { key: "fighter", name: "Воин", hitDie: 10, saves: ["str", "con"], skillCount: 2, skillPool: ["acrobatics", "animal", "athletics", "history", "insight", "intimidation", "perception", "survival"], primary: "Сила или Ловкость", desc: "Мастер оружия и тактики, стабильный и надёжный.", armor: "Любые доспехи и щиты", baseAc: 16,
    gear: [{ name: "Кольчуга", qty: 1, desc: "КД 16" }, { name: "Длинный меч", qty: 1, desc: "1d8 рубящий" }, { name: "Щит", qty: 1, desc: "+2 КД" }, { name: "Лёгкий арбалет", qty: 1, desc: "1d8, 20 болтов" }, { name: "Арбалетные болты", qty: 20, desc: "боеприпас" }], features: "Боевой стиль, Второе дыхание, Всплеск действий.", gold: 125, subclassLevel: 3,
    subclasses: [{ name: "Мастер боевых искусств", desc: "Манёвры и кости превосходства." }, { name: "Чемпион", desc: "Критические удары чаще, атлетизм." }, { name: "Мистический рыцарь", desc: "Воин с заклинаниями волшебника." }], recommended: { str: 15, con: 14, dex: 13, wis: 12, cha: 10, int: 8 } },
  { key: "monk", name: "Монах", hitDie: 8, saves: ["str", "dex"], skillCount: 2, skillPool: ["acrobatics", "athletics", "history", "insight", "religion", "stealth"], primary: "Ловкость, Мудрость", desc: "Боец без оружия, быстрый и неуловимый, владеет ци.", armor: "Без доспехов (КД = 10 + ЛОВ + МДР)", baseAc: 15,
    gear: [{ name: "Короткий меч", qty: 1, desc: "1d6" }, { name: "Дротики", qty: 10, desc: "1d4, метательные" }, { name: "Набор путешественника", qty: 1, desc: "верёвка, трут, рационы" }], features: "Боевые искусства, Ци, Защита без доспехов.", gold: 12, subclassLevel: 3,
    subclasses: [{ name: "Путь открытой ладони", desc: "Мастер контроля противника." }, { name: "Путь тени", desc: "Скрытность и телепортация в тенях." }, { name: "Путь четырёх стихий", desc: "Стихийная магия ци." }], recommended: { dex: 15, wis: 14, con: 13, str: 12, int: 10, cha: 8 } },
  { key: "paladin", name: "Паладин", hitDie: 10, saves: ["wis", "cha"], skillCount: 2, skillPool: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"], primary: "Сила, Харизма", desc: "Святой воин, связанный клятвой: карающий удар и исцеление.", armor: "Любые доспехи и щиты", baseAc: 18,
    gear: [{ name: "Длинный меч", qty: 1, desc: "1d8" }, { name: "Кольчуга", qty: 1, desc: "КД 16" }, { name: "Щит", qty: 1, desc: "+2 КД" }, { name: "Метательные копья", qty: 5, desc: "1d6" }, { name: "Священный символ", qty: 1, desc: "" }], features: "Божественное чувство, Возложение рук, Священная клятва (с 3 ур.).", gold: 125, subclassLevel: 3,
    subclasses: [{ name: "Клятва преданности", desc: "Классический рыцарь света." }, { name: "Клятва древних", desc: "Защитник природы и радости." }, { name: "Клятва мести", desc: "Беспощадный охотник на зло." }], recommended: { str: 15, cha: 14, con: 13, wis: 12, dex: 10, int: 8 } },
  { key: "ranger", name: "Следопыт", hitDie: 10, saves: ["str", "dex"], skillCount: 3, skillPool: ["animal", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"], primary: "Ловкость, Мудрость", desc: "Охотник и разведчик дикой местности.", armor: "Лёгкая и средняя броня, щит", baseAc: 14,
    gear: [{ name: "Длинный лук", qty: 1, desc: "1d8, дальность 150/600" }, { name: "Стрелы", qty: 20, desc: "боеприпас" }, { name: "Короткие мечи", qty: 2, desc: "1d6" }, { name: "Проклёпанная кожа", qty: 1, desc: "КД 12 + ЛОВ" }], features: "Избранный враг, Исследователь природы, Боевой стиль.", gold: 125, subclassLevel: 3,
    subclasses: [{ name: "Охотник", desc: "Универсальные приёмы против разных целей." }, { name: "Повелитель зверей", desc: "Верный зверь-спутник." }, { name: "Охотник на чудовищ", desc: "Против магии и великанов." }], recommended: { dex: 15, wis: 14, con: 13, str: 12, int: 10, cha: 8 } },
  { key: "rogue", name: "Плут", hitDie: 8, saves: ["dex", "int"], skillCount: 4, skillPool: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleight", "stealth"], primary: "Ловкость", desc: "Мастер скрытности, ловушек и точных ударов.", armor: "Лёгкая броня", baseAc: 13,
    gear: [{ name: "Рапира", qty: 1, desc: "1d8 фехтовальное" }, { name: "Короткий лук", qty: 1, desc: "1d6" }, { name: "Стрелы", qty: 20, desc: "боеприпас" }, { name: "Воровские инструменты", qty: 1, desc: "вскрытие замков" }, { name: "Кожаный доспех", qty: 1, desc: "КД 11 + ЛОВ" }, { name: "Кинжалы", qty: 2, desc: "1d4" }], features: "Скрытая атака, Воровской жаргон, Экспертиза (2 навыка).", gold: 100, subclassLevel: 3,
    subclasses: [{ name: "Вор", desc: "Ловкость рук, проворные лазания." }, { name: "Убийца", desc: "Внезапные смертельные удары." }, { name: "Загадочный ловкач", desc: "Магия иллюзий и чар." }], recommended: { dex: 15, con: 14, int: 13, cha: 12, wis: 10, str: 8 } },
  { key: "sorcerer", name: "Чародей", hitDie: 6, saves: ["con", "cha"], skillCount: 2, skillPool: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"], primary: "Харизма", desc: "Врождённая магия, мощь крови или судьбы.", armor: "Без доспехов", baseAc: 12,
    gear: [{ name: "Лёгкий арбалет", qty: 1, desc: "1d8" }, { name: "Кинжалы", qty: 2, desc: "1d4" }, { name: "Магическая фокусировка", qty: 1, desc: "" }, { name: "Набор путешественника", qty: 1, desc: "" }], features: "Заклинания, Происхождение чародея, Метамагия (с 3 ур.).", gold: 75, subclassLevel: 1,
    subclasses: [{ name: "Драконья кровь", desc: "Чешуя, сопротивление, стихия дракона." }, { name: "Дикая магия", desc: "Хаотичные всплески магии." }, { name: "Теневая магия", desc: "Тьма, тёмное зрение, пёс Тьмы." }], recommended: { cha: 15, con: 14, dex: 13, wis: 12, int: 10, str: 8 } },
  { key: "warlock", name: "Колдун", hitDie: 8, saves: ["wis", "cha"], skillCount: 2, skillPool: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"], primary: "Харизма", desc: "Заключил договор с могущественным покровителем.", armor: "Лёгкая броня", baseAc: 12,
    gear: [{ name: "Лёгкий арбалет", qty: 1, desc: "1d8" }, { name: "Кожаный доспех", qty: 1, desc: "" }, { name: "Кинжалы", qty: 2, desc: "" }, { name: "Магическая фокусировка", qty: 1, desc: "" }], features: "Потусторонний покровитель, Магия договора, Таинственные воззвания.", gold: 100, subclassLevel: 1,
    subclasses: [{ name: "Исчадие", desc: "Покровитель из Преисподней, огонь и стойкость." }, { name: "Архифея", desc: "Очарование и исчезновение." }, { name: "Великий древний", desc: "Телепатия и безумие." }], recommended: { cha: 15, con: 14, dex: 13, wis: 12, int: 10, str: 8 } },
  { key: "wizard", name: "Волшебник", hitDie: 6, saves: ["int", "wis"], skillCount: 2, skillPool: ["arcana", "history", "insight", "investigation", "medicine", "religion"], primary: "Интеллект", desc: "Учёный-маг с самой обширной книгой заклинаний.", armor: "Без доспехов", baseAc: 12,
    gear: [{ name: "Боевой посох", qty: 1, desc: "1d6" }, { name: "Книга заклинаний", qty: 1, desc: "6 заклинаний 1 уровня" }, { name: "Мешочек с компонентами", qty: 1, desc: "" }, { name: "Набор учёного", qty: 1, desc: "чернила, пергамент" }], features: "Подготовка заклинаний, Магическое восстановление, Школа магии.", gold: 100, subclassLevel: 2,
    subclasses: [{ name: "Школа воплощения", desc: "Огненные шары без вреда союзникам." }, { name: "Школа ограждения", desc: "Магические щиты и защита." }, { name: "Школа прорицания", desc: "Предсказания, заранее заданные броски." }, { name: "Школа некромантии", desc: "Нежить и энергия смерти." }], recommended: { int: 15, con: 14, dex: 13, wis: 12, cha: 10, str: 8 } },
];

export const BACKGROUNDS: { key: string; name: string; skills: string[]; gear: string; desc: string; feature: string }[] = [
  { key: "acolyte", name: "Аколит", skills: ["insight", "religion"], gear: "Священный символ, молитвенник, 15 зм", desc: "Служил в храме.", feature: "Приют в храмах своей веры." },
  { key: "criminal", name: "Преступник", skills: ["deception", "stealth"], gear: "Лом, тёмная одежда, 15 зм", desc: "Жил вне закона.", feature: "Связи в преступном мире." },
  { key: "folk", name: "Народный герой", skills: ["animal", "survival"], gear: "Инструменты ремесленника, лопата, 10 зм", desc: "Простой человек, ставший символом надежды.", feature: "Простой народ укроет и поможет." },
  { key: "noble", name: "Благородный", skills: ["history", "persuasion"], gear: "Хороший костюм, перстень-печатка, 25 зм", desc: "Родился в знатной семье.", feature: "Привилегии: аудиенции у знати." },
  { key: "hermit", name: "Отшельник", skills: ["medicine", "religion"], gear: "Свиток с откровением, травы, 5 зм", desc: "Жил в уединении.", feature: "Открытие: уникальное знание." },
  { key: "sailor", name: "Моряк", skills: ["athletics", "perception"], gear: "Верёвка, талисман, 10 зм", desc: "Ходил по морям.", feature: "Бесплатный проезд на кораблях." },
  { key: "soldier", name: "Солдат", skills: ["athletics", "intimidation"], gear: "Знак отличия, трофей, игральные кости, 10 зм", desc: "Служил в армии или страже.", feature: "Воинское звание, уважение военных." },
  { key: "sage", name: "Мудрец", skills: ["arcana", "history"], gear: "Чернила, письмо от коллеги, 10 зм", desc: "Годы изучал знания.", feature: "Знает, где найти нужную информацию." },
  { key: "urchin", name: "Беспризорник", skills: ["sleight", "stealth"], gear: "Нож, карта родного города, 10 зм", desc: "Вырос на улице.", feature: "Знает потайные пути по городу." },
  { key: "outlander", name: "Чужеземец", skills: ["athletics", "survival"], gear: "Посох, охотничий трофей, 10 зм", desc: "Вырос в глуши.", feature: "Не теряется в дикой местности." },
];

export const CONDITIONS = ["Ослеплён", "Очарован", "Оглушён", "Оглох", "Испуган", "Схвачен", "Недееспособен", "Невидим", "Парализован", "Окаменел", "Отравлен", "Сбит с ног", "Опутан", "Ошеломлён", "Без сознания", "Истощение", "Кровотечение", "Проклят"];

export const EDITIONS = [
  { key: "2014", name: "D&D 5e (2014, PHB)", note: "Классические расы с бонусами характеристик, подкласс на 1–3 уровне." },
  { key: "2024", name: "D&D 5e (2024, обновлённые правила)", note: "Бонусы характеристик от предыстории, подкласс на 3 уровне, мастерство оружия." },
];

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export function skillByKey(k: string) {
  return SKILLS.find((s) => s.key === k);
}

export function skillByName(n: string) {
  const l = n.toLowerCase();
  return SKILLS.find((s) => s.name.toLowerCase() === l || s.key === l);
}
