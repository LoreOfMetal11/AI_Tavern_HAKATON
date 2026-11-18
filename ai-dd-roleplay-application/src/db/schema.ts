import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  real,
  index,
} from "drizzle-orm/pg-core";

/** Единственная строка (id=1) с глобальными настройками сервиса. */
export const settingsTable = pgTable("settings", {
  id: integer("id").primaryKey(),
  data: jsonb("data").notNull().default({}),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Мир: шаблон кампании. Сущности мира клонируются в приключение при старте. */
export const worlds = pgTable("worlds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  compact: text("compact").notNull().default(""), // версия для ИИ (внутренний язык)
  tone: text("tone").notNull().default(""),
  rules: text("rules").notNull().default(""), // законы мира: магия, технологии, религия
  image: text("image").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adventures = pgTable("adventures", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  worldId: integer("world_id"),
  edition: text("edition").notNull().default("2014"),
  premise: text("premise").notNull().default(""), // сюжет / завязка
  premiseCompact: text("premise_compact").notNull().default(""),
  opening: text("opening").notNull().default(""),
  rulebookIds: jsonb("rulebook_ids").notNull().default([]), // library ids
  chatStyle: text("chat_style").notNull().default("narrative"), // narrative | mixed | group
  scene: jsonb("scene").notNull().default({}),
  pending: jsonb("pending"), // ожидающий бросок
  lastContext: jsonb("last_context"), // что реально ушло в модель
  overrides: jsonb("overrides").notNull().default({}), // переопределения настроек для приключения
  turn: integer("turn").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Персонажи (NPC), локации, фракции, квесты, слухи: единая «база знаний». */
export const entities = pgTable(
  "entities",
  {
    id: serial("id").primaryKey(),
    worldId: integer("world_id"),
    adventureId: integer("adventure_id"), // null = канон мира
    type: text("type").notNull().default("character"), // character|location|faction|quest|rumor|item|event
    name: text("name").notNull(),
    aliases: text("aliases").notNull().default(""), // доп. имена через запятую
    triggers: text("triggers").notNull().default(""), // триггерные слова через запятую
    mode: text("mode").notNull().default("trigger"), // trigger | always | logic | off
    description: text("description").notNull().default(""), // для пользователя
    compact: text("compact").notNull().default(""), // для ИИ
    secrets: text("secrets").notNull().default(""), // только мастер
    knowledge: text("knowledge").notNull().default(""), // что знает персонаж
    history: text("history").notNull().default(""), // карточка истории: как пришёл к состоянию
    status: text("status").notNull().default(""), // текущее состояние
    stats: jsonb("stats").notNull().default({}), // hp, ac, cr, атрибуты NPC и т.п.
    parentId: integer("parent_id"), // локация внутри локации
    image: text("image").notNull().default(""),
    locked: boolean("locked").notNull().default(false), // ИИ не может менять
    neverForget: boolean("never_forget").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("entities_adv_idx").on(t.adventureId), index("entities_world_idx").on(t.worldId)],
);

export const relations = pgTable("relations", {
  id: serial("id").primaryKey(),
  worldId: integer("world_id"),
  adventureId: integer("adventure_id"),
  fromId: integer("from_id").notNull(),
  toId: integer("to_id").notNull(),
  label: text("label").notNull().default(""),
  note: text("note").notNull().default(""),
});

/** Карточки игроков (PC). */
export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  adventureId: integer("adventure_id"), // null = шаблон в библиотеке
  name: text("name").notNull(),
  playerName: text("player_name").notNull().default(""),
  race: text("race").notNull().default(""),
  className: text("class_name").notNull().default(""),
  subclass: text("subclass").notNull().default(""),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  background: text("background").notNull().default(""),
  alignment: text("alignment").notNull().default(""),
  abilities: jsonb("abilities").notNull().default({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
  skills: jsonb("skills").notNull().default([]), // [{key, level: 0|1|2}]
  saves: jsonb("saves").notNull().default([]), // ["str","con"]
  hp: integer("hp").notNull().default(10),
  maxHp: integer("max_hp").notNull().default(10),
  tempHp: integer("temp_hp").notNull().default(0),
  ac: integer("ac").notNull().default(10),
  speed: integer("speed").notNull().default(30),
  gold: integer("gold").notNull().default(0),
  inventory: jsonb("inventory").notNull().default([]), // [{name, qty, desc, consumable}]
  features: text("features").notNull().default(""), // умения, заклинания
  conditions: jsonb("conditions").notNull().default([]),
  backstory: text("backstory").notNull().default(""),
  personality: text("personality").notNull().default(""),
  appearance: text("appearance").notNull().default(""),
  history: text("history").notNull().default(""), // карточка истории (авто)
  compact: text("compact").notNull().default(""),
  image: text("image").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    adventureId: integer("adventure_id").notNull(),
    turn: integer("turn").notNull().default(0),
    role: text("role").notNull(), // user | assistant | system
    playerId: integer("player_id"),
    content: text("content").notNull().default(""),
    meta: jsonb("meta").notNull().default({}), // roll, issues, images, usage
    status: text("status").notNull().default("active"), // active | deleted | superseded
    pinned: boolean("pinned").notNull().default(false),
    summarized: boolean("summarized").notNull().default(false),
    tokens: integer("tokens").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("messages_adv_idx").on(t.adventureId, t.turn)],
);

/** Блокнот истории: сжатые записи. level 0 = сцены, 1 = главы, 2 = хроника. */
export const memories = pgTable("memories", {
  id: serial("id").primaryKey(),
  adventureId: integer("adventure_id").notNull(),
  level: integer("level").notNull().default(0),
  kind: text("kind").notNull().default("summary"), // summary | fact | note
  content: text("content").notNull(),
  fromTurn: integer("from_turn").notNull().default(0),
  toTurn: integer("to_turn").notNull().default(0),
  importance: real("importance").notNull().default(0.5),
  locked: boolean("locked").notNull().default(false), // не удалять и не сжимать
  author: text("author").notNull().default("ai"), // ai | user
  tokens: integer("tokens").notNull().default(0),
  tags: text("tags").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Журнал изменений карточек: позволяет откатить при регенерации/удалении. */
export const changes = pgTable("changes", {
  id: serial("id").primaryKey(),
  adventureId: integer("adventure_id").notNull(),
  messageId: integer("message_id"),
  turn: integer("turn").notNull().default(0),
  target: text("target").notNull(), // entity | player | scene | relation
  targetId: integer("target_id"),
  op: text("op").notNull().default("update"), // create | update | delete
  summary: text("summary").notNull().default(""),
  before: jsonb("before"),
  after: jsonb("after"),
  reverted: boolean("reverted").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Библиотека: книги правил, миры, персонажи, сюжеты, заметки. */
export const library = pgTable("library", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull().default("rulebook"), // rulebook | world | character | plot | note
  title: text("title").notNull(),
  source: text("source").notNull().default(""),
  edition: text("edition").notNull().default(""),
  content: text("content").notNull().default(""), // оригинал
  compact: text("compact").notNull().default(""), // адаптация под ИИ
  builtin: boolean("builtin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
