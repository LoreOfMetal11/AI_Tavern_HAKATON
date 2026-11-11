export type RuleEdition = '5e-srd' | '2024-revised' | '3.5e-classic' | 'custom';

export type StatName = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export interface AbilityScores {
  STR: number;
  DEX: number;
  CON: number;
  INT: number;
  WIS: number;
  CHA: number;
}

export interface SkillDefinition {
  name: string;
  nameRu: string;
  stat: StatName;
  proficient: boolean;
}

export type DmMood = 'neutral' | 'combat' | 'mystery' | 'triumph' | 'peril';

export type ConditionType =
  | 'blinded'
  | 'charmed'
  | 'deafened'
  | 'frightened'
  | 'grappled'
  | 'incapacitated'
  | 'invisible'
  | 'paralyzed'
  | 'petrified'
  | 'poisoned'
  | 'prone'
  | 'restrained'
  | 'stunned'
  | 'unconscious'
  | 'exhaustion';

export interface ActiveCondition {
  id: string;
  type: ConditionType;
  nameRu: string;
  level?: number; // for exhaustion (1-6)
  descriptionRu: string;
  mechanicalEffectRu: string;
}

export interface Character {
  id: string;
  campaignId?: string;
  name: string;
  title: string;
  isPlayer: boolean;
  playerSlot: 'A' | 'B' | 'C' | 'D' | 'NPC';
  avatar: string;
  race: string;
  class: string;
  subclass: string;
  level: number;
  hpCurrent: number;
  hpMax: number;
  ac: number;
  speed: number;
  stats: AbilityScores;
  profBonus: number;
  skills: Record<string, boolean>; // skillKey -> proficient
  savingThrows: Record<StatName, boolean>;
  inventory: Array<{ id: string; name: string; quantity: number; description?: string }>;
  gold: number;
  alignment: string;
  backstory: string;
  personalityTraits: string;
  currentCondition?: string;
  activeConditions?: ActiveCondition[];
  notes?: string;
}

export type EntityType = 'npc' | 'location' | 'faction' | 'item' | 'rumor' | 'quest' | 'relation';
export type ActivationMode = 'always' | 'trigger' | 'logic' | 'disabled';

export interface LoreEntity {
  id: string;
  campaignId: string;
  type: EntityType;
  name: string;
  summary: string;
  details: string;
  image?: string;
  triggerKeywords: string[];
  activationMode: ActivationMode;
  isAutoMutable: boolean;
  lastUpdatedNotes?: string;
  isPinned?: boolean;
}

export interface CheckRequest {
  stat: StatName;
  skillName?: string;
  dc: number;
  description: string;
  sourceSpeaker?: string;
  rollResult?: number;
  modifierApplied?: number;
  totalScore?: number;
  passed?: boolean;
}

export interface ChatMessage {
  id: string;
  campaignId: string;
  role: 'system' | 'user' | 'assistant';
  speakerName: string;
  speakerPlayerSlot?: 'A' | 'B' | 'C' | 'D' | 'DM';
  content: string;
  reasoning?: string; // Chain of thought (<think>)
  requestedCheck?: CheckRequest;
  dmMood?: DmMood;
  activeEntitiesAttached?: string[]; // IDs of lore entities that were triggered
  isPinned?: boolean; // Never delete from memory
  timestamp: number;
}

export type ReasoningEffort = 'concise' | 'standard' | 'deep';

export interface PreCheckAssessment {
  requiresCheck: boolean;
  stat?: StatName;
  skillName?: string;
  dc?: number;
  description?: string;
  reason: string;
}

export interface PendingActionCheck {
  actionText: string;
  speakerSlot: 'A' | 'B';
  characterName: string;
  assessment: PreCheckAssessment;
}

export type LLMProvider = 'gemini' | 'lmstudio' | 'ollama' | 'openai' | 'openrouter' | 'custom' | 'simulator';

export interface ModelSettings {
  provider: LLMProvider;
  endpointUrl: string; // e.g. 'http://localhost:1234/v1' or '/api/gemini/chat'
  apiKey: string;
  modelName: string;
  auxModels: {
    gm: string;
    entityAnalyzer: string;
    summarizer: string;
    imageGen: string;
  };
  temperature: number;
  maxTokens: number;
  repetitionPenalty: number;
  frequencyPenalty: number;
  presencePenalty: number;
  contextBudget: number; // 4096, 8192, 16384, 32768
  summarizeThresholdTurns: number; // e.g. 6 turns
  compressionPreserveDirectives: string[];
  optimizeEnglishTokens: boolean; // compresses internal memory tokens
  simulatedDelayMs: number;
  thinkingMode: boolean; // Show CoT / reasoning
  reasoningEffort: ReasoningEffort; // concise | standard | deep
  strictNoPlayerImpersonation: boolean; // Enforce DM cannot act for player characters
  systemPromptOverride?: string;
}

export interface CampaignHistoryEntry {
  id: string;
  title: string;
  summary: string;
  timestamp: number;
  keyEvents: string[];
  charactersInvolved: string[];
  isLocked?: boolean;
}

export interface Campaign {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  coverImage: string;
  edition: RuleEdition;
  customRulesText?: string;
  currentLocation: string;
  activePlayerSlot: 'A' | 'B' | 'C' | 'D' | 'SIMULTANEOUS';
  dmMood?: DmMood;
  characterIds?: string[];
  historyChronicles: CampaignHistoryEntry[];
  pinnedFacts: string[];
  isCleanSession?: boolean;
  lastPlayed: number;
}

export interface ContextBreakdown {
  systemTokens: number;
  rulesTokens: number;
  loreTokens: number;
  summaryTokens: number;
  chatTokens: number;
  totalTokens: number;
  maxBudget: number;
  activeEntities: LoreEntity[];
  coldEntities: LoreEntity[];
  rawPromptPreview: string;
}
