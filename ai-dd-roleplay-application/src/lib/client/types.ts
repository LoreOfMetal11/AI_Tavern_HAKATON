import type { PlayerRow } from "@/components/CharacterForm";
import type { EntityRow } from "@/components/KnowledgePanel";

export interface Msg {
  id: number;
  adventureId: number;
  turn: number;
  role: "user" | "assistant" | "system";
  playerId: number | null;
  content: string;
  meta: { issues?: { kind: string; detail: string }[]; roll?: { check: { label: string }; total: number; success: boolean | null }; rollText?: string; images?: { url: string }[]; retries?: number; plan?: string | null; ms?: number; manual?: boolean; opening?: boolean };
  status: string;
  pinned: boolean;
  summarized: boolean;
  tokens: number;
}
export interface Mem {
  id: number;
  level: number;
  kind: string;
  content: string;
  fromTurn: number;
  toTurn: number;
  locked: boolean;
  author: string;
  tokens: number;
}
export interface Change {
  id: number;
  messageId: number | null;
  turn: number;
  target: string;
  summary: string;
  reverted: boolean;
  op: string;
}
export interface Enemy {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  ac?: number;
}
export interface SceneData {
  location?: string;
  time?: string;
  combat?: boolean;
  round?: number;
  enemies?: Enemy[];
  active?: number[];
  underAttack?: number[];
}
export interface AdvData {
  adventure: { id: number; name: string; worldId: number | null; edition: string; premise: string; opening: string; chatStyle: string; scene: SceneData; pending: unknown; overrides: Record<string, unknown>; turn: number; rulebookIds: number[] };
  world: { id: number; name: string } | null;
  players: (PlayerRow & { id: number })[];
  entities: EntityRow[];
  memories: Mem[];
  messages: Msg[];
  changes: Change[];
  stats: { tokens: number; budget: number; messages: number; shouldCompact: boolean } | null;
}
export interface CtxReport {
  at: number;
  totalTokens: number;
  budget: number;
  limits: Record<string, { used: number; limit: number }>;
  blocks: { id: string; group: string; title: string; tokens: number; included: boolean; reason: string; text: string }[];
  messages: { role: string; content: string }[];
  candidates?: { triggered: { id: number; name: string; score: number }[]; logic: { id: number; name: string; score: number }[] };
  overflow?: number;
}
