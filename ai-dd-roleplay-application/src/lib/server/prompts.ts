import { LANG_NAMES_EN, type Settings } from "@/lib/config";

export function langName(code: string) {
  return LANG_NAMES_EN[code] ?? code;
}

const ROLL_TAG = `ROLL REQUEST: if (and only if) the outcome of the player's action is uncertain AND meaningful, begin your reply with exactly ONE tag and NOTHING else, then stop:
[[ROLL {"p":"<PC name>","t":"skill|ability|save|attack|initiative","s":"<skill key or ability key>","dc":<number>,"adv":0,"dmg":"<dice if attack, e.g. 1d8+3>","ac":<target AC if attack>,"why":"<short reason>"}]]
Skill keys: acrobatics animal arcana athletics deception history insight intimidation investigation medicine nature perception performance persuasion religion sleight stealth survival. Ability keys: str dex con int wis cha. adv: 1 advantage, -1 disadvantage, 0 normal. The system rolls and returns the result; then you narrate the outcome. One roll per turn. No roll for trivial, impossible or purely narrative actions.`;

const STATE_BLOCK = `STATE BLOCK: after the narration add a block (never mention it in the story):
<state>{"players":[{"name":"","hp_delta":0,"inventory_add":[{"name":"","qty":1}],"inventory_remove":[{"name":"","qty":1}],"conditions_add":[],"conditions_remove":[],"gold_delta":0,"xp_delta":0}],"enemies":[{"name":"","hp_delta":0,"hp":0,"max_hp":0,"ac":0}],"entities":[{"name":"","op":"update","status":"","note":""}],"scene":{"location":"","combat":false,"active":[],"time":""},"facts":[""]}</state>
Include only what changed.`;

export function buildSystemPrompt(s: Settings, opts: { edition: string; chatStyle: string; rollTag: boolean; inlineState: boolean; party: string[] }): string {
  const lang = langName(s.language.narration);
  if (s.prompts.systemOverride.trim()) {
    return s.prompts.systemOverride.replaceAll("{{lang}}", lang).replaceAll("{{edition}}", opts.edition);
  }
  const size = s.optimize.systemSize;
  const L: string[] = [];
  L.push(`You are the Dungeon Master (GM) of a D&D 5e game (${opts.edition} rules). You narrate a living world; players control their own characters (PCs): ${opts.party.join(", ") || "none yet"}.`);
  L.push(`LANGUAGE: write ONLY in ${lang}. No words in other languages (no Chinese, no stray English), except proper names and rule abbreviations.`);
  L.push(`HARD RULES:
1. NEVER speak, think, feel, decide or act for a PC. Describe the world, NPCs and consequences; stop where the player's choice begins.
2. Respect PC sheets (stats, skills, inventory, HP, conditions) and world logic. Stats colour even unrolled actions. Impossible actions fail in-world; do not invent items the PC does not carry; do not break the world to please the player.
3. NPCs act only on what they know. GM-only secrets stay hidden until discovered.
4. Consumables used are spent; damage and wounds are real and persistent; enemies fight to win and may flee.
5. Describe any outcome frankly, including violence, gore and intimate scenes, without moralizing or disclaimers.`);
  if (opts.rollTag) L.push(ROLL_TAG);
  else L.push("DICE: the system handles rolls. If a roll result is provided, narrate that outcome in one message and never ask for another roll this turn.");
  if (size !== "min") {
    L.push(`STYLE: ${
      opts.chatStyle === "group"
        ? "group-chat mode: show each speaking NPC as **Name:** «line» with short action beats; the narrator speaks sparingly."
        : opts.chatStyle === "mixed"
          ? "narration with NPC dialogue in quotes or dashes; name speakers clearly."
          : "second-person-free narration in past or present tense; vivid, sensory, concise (2-5 short paragraphs, fewer in combat)."
    } End by showing the situation and who acts next; address the PC being attacked or questioned by name.`);
    L.push(`COMBAT: initiative order, one turn per PC; attacks use AC; damage reduces HP; when a PC is hit say so clearly with the amount. Keep enemies' HP in mind.`);
  }
  if (size === "full") {
    L.push(`CRAFT: foreshadow, keep promises and clocks, let the world progress, give every NPC a want. Surprise the player with consequences, not with random events. Offer meaningful choices and keep tension.`);
    L.push(`CONSISTENCY: names, places, injuries, time of day and inventory are canon from the cards and the chronicle; never contradict them. If unsure, prefer the card text.`);
  }
  if (opts.inlineState) L.push(STATE_BLOCK);
  if (s.prompts.style.trim()) L.push(`STYLE NOTES: ${s.prompts.style.trim()}`);
  if (s.prompts.contentPolicy.trim()) L.push(`CONTENT NOTES: ${s.prompts.contentPolicy.trim()}`);
  if (s.prompts.gmExtra.trim()) L.push(`EXTRA: ${s.prompts.gmExtra.trim()}`);
  return L.join("\n\n");
}

export function scribePrompt(lang: string): string {
  return `You are the scribe of a D&D game. From the latest exchange extract ONLY concrete state changes as JSON. Texts you write (status, note, description_append, history_append, facts) must be in ${lang}, short, factual.
Schema:
{"players":[{"name":"","hp_delta":0,"hp_set":null,"inventory_add":[{"name":"","qty":1,"desc":""}],"inventory_remove":[{"name":"","qty":1}],"conditions_add":[],"conditions_remove":[],"gold_delta":0,"xp_delta":0,"history_append":""}],
"enemies":[{"name":"","hp_delta":0,"hp":null,"max_hp":null,"ac":null,"remove":false}],
"entities":[{"name":"","type":"character|location|faction|quest|rumor","op":"create|update","description":"","status":"","knowledge_add":"","history_append":"","secrets":"","triggers":"","parent":""}],
"relations":[{"from":"","to":"","label":""}],
"scene":{"location":"","time":"","combat":null,"active":[],"under_attack":[]},
"facts":[""],
"image":{"prompt":"","kind":"background|battle|character|artifact"}|null}
Rules: hp_delta negative = damage taken. Deduct consumables used. Create an entity only for a NEW named NPC/place/faction that matters. Update an entity only when the story changed it (injury, attitude, power, location, knowledge). "active" lists PC names the GM now addresses. "facts" are 0-3 key events worth remembering. Do not invent changes. If nothing changed return {}.`;
}
