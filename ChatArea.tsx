import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Dice6,
  RotateCcw,
  Edit2,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Pin,
  Check,
  User,
  Users,
  X,
} from 'lucide-react';
import { ChatMessage, Character, CheckRequest, PendingActionCheck } from './dnd';
import { DM_MOOD_CONFIG } from './galleryAssets';

interface ChatAreaProps {
  messages: ChatMessage[];
  characters: Character[];
  activeSlot: 'A' | 'B' | 'SIMULTANEOUS';
  onSelectSlot: (slot: 'A' | 'B' | 'SIMULTANEOUS') => void;
  isLoading: boolean;
  onSendMessage: (text: string, speakerSlot?: 'A' | 'B') => void;
  onEditMessage: (id: string, newText: string) => void;
  onDeleteMessage: (id: string) => void;
  onRegenerateMessage: (id: string) => void;
  onRequestCheckRoll: (check: CheckRequest) => void;
  pendingActionCheck?: PendingActionCheck | null;
  onRollPendingCheck?: () => void;
  onSkipPendingCheck?: () => void;
  onCancelPendingCheck?: () => void;
}

const FALLBACK_CHAR_A: Character = {
  id: 'temp-a',
  name: 'Игрок А',
  title: 'Первый герой',
  isPlayer: true,
  playerSlot: 'A',
  race: 'Человек',
  class: 'Воин',
  subclass: 'Защитник',
  level: 1,
  hpCurrent: 10,
  hpMax: 10,
  ac: 10,
  speed: 30,
  stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
  profBonus: 2,
  skills: {},
  savingThrows: { STR: true, DEX: false, CON: true, INT: false, WIS: false, CHA: false },
  avatar: '/src/assets/images/avatar_valeria_paladin_1793967563124.jpg',
  inventory: [],
  gold: 10,
  alignment: 'Нейтральный',
  backstory: 'Первый участник отряда.',
  personalityTraits: 'Решительный.',
  notes: '',
};

const FALLBACK_CHAR_B: Character = {
  id: 'temp-b',
  name: 'Игрок B',
  title: 'Второй герой',
  isPlayer: true,
  playerSlot: 'B',
  race: 'Эльф',
  class: 'Следопыт',
  subclass: 'Охотник',
  level: 1,
  hpCurrent: 10,
  hpMax: 10,
  ac: 10,
  speed: 35,
  stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
  profBonus: 2,
  skills: {},
  savingThrows: { STR: false, DEX: true, CON: false, INT: false, WIS: true, CHA: false },
  avatar: '/src/assets/images/avatar_eldrin_wizard_1793967563854.jpg',
  inventory: [],
  gold: 10,
  alignment: 'Хаотичный добрый',
  backstory: 'Второй участник отряда.',
  personalityTraits: 'Внимательный.',
  notes: '',
};

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  characters,
  activeSlot,
  onSelectSlot,
  isLoading,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onRegenerateMessage,
  onRequestCheckRoll,
  pendingActionCheck,
  onRollPendingCheck,
  onSkipPendingCheck,
  onCancelPendingCheck,
}) => {
  const [inputText, setInputText] = useState('');
  const [simultaneousTextB, setSimultaneousTextB] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [openThoughts, setOpenThoughts] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const charA = characters.find((c) => c.playerSlot === 'A') || characters[0] || FALLBACK_CHAR_A;
  const charB = characters.find((c) => c.playerSlot === 'B') || characters[1] || characters[0] || FALLBACK_CHAR_B;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = () => {
    if (isLoading) return;

    if (activeSlot === 'SIMULTANEOUS') {
      const combined = `${charA.name}: ${inputText.trim()}\n\n${charB.name}: ${simultaneousTextB.trim()}`;
      if (!inputText.trim() && !simultaneousTextB.trim()) return;
      onSendMessage(combined);
      setInputText('');
      setSimultaneousTextB('');
    } else {
      if (!inputText.trim()) return;
      onSendMessage(inputText.trim(), activeSlot);
      setInputText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleThought = (id: string) => {
    setOpenThoughts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const startEdit = (msg: ChatMessage) => {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content);
  };

  const saveEdit = (id: string) => {
    onEditMessage(id, editingContent);
    setEditingMessageId(null);
  };

  const getSpeakerAvatar = (msg: ChatMessage): string | undefined => {
    if (msg.role === 'assistant') {
      return undefined; // Special DM crest
    }
    if (msg.speakerPlayerSlot === 'B') {
      return charB.avatar;
    }
    return charA.avatar;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-stone-950 overflow-hidden relative">
      {/* Messages Timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6">
        {messages.map((msg) => {
          const isDm = msg.role === 'assistant';
          const isEditing = editingMessageId === msg.id;
          const avatar = getSpeakerAvatar(msg);

          const moodCfg = isDm ? (DM_MOOD_CONFIG[msg.dmMood || 'neutral'] || DM_MOOD_CONFIG.neutral) : null;

          return (
            <div
              key={msg.id}
              className={`flex gap-3 md:gap-4 group ${
                isDm ? 'justify-start' : 'justify-start'
              }`}
            >
              {/* Avatar Column */}
              <div className="shrink-0 pt-1">
                {isDm ? (
                  <div className="relative">
                    <img
                      src="/src/assets/images/avatar_dm_master_mystic_1793979259583.jpg"
                      alt="Dungeon Master"
                      referrerPolicy="no-referrer"
                      className={`w-10 h-10 rounded-xl object-cover border-2 transition-all ${moodCfg?.borderColor} ${moodCfg?.glowClass}`}
                    />
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-stone-900 flex items-center justify-center">
                      <Sparkles className="w-2 h-2 text-stone-950" />
                    </div>
                  </div>
                ) : (
                  <img
                    src={avatar}
                    alt={msg.speakerName}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-xl object-cover border border-amber-600/50 shadow-md"
                  />
                )}
              </div>

              {/* Message Bubble Content */}
              <div
                className={`flex-1 max-w-3xl rounded-2xl p-4 md:p-5 transition-all ${
                  isDm
                    ? `bg-stone-900/95 border text-stone-100 shadow-xl ${moodCfg?.borderColor || 'border-stone-800'}`
                    : msg.speakerPlayerSlot === 'B'
                    ? 'bg-stone-900/80 border border-amber-900/50 text-stone-200'
                    : 'bg-stone-900/80 border border-emerald-900/50 text-stone-200'
                }`}
              >
                {/* Author Bar */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800/60 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-bold font-fantasy ${
                        isDm ? 'text-amber-300' : 'text-stone-200'
                      }`}
                    >
                      {msg.speakerName}
                    </span>
                    {msg.speakerPlayerSlot && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-amber-400 font-mono">
                        {msg.speakerPlayerSlot === 'DM'
                          ? 'Ведущий'
                          : `Игрок ${msg.speakerPlayerSlot}`}
                      </span>
                    )}
                    {isDm && moodCfg && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${moodCfg.borderColor} ${moodCfg.badgeBg} ${moodCfg.badgeText} flex items-center gap-1`}>
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>{moodCfg.title}</span>
                      </span>
                    )}
                  </div>

                  {/* Message Action Tools */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(msg)}
                      className="p-1 rounded text-stone-400 hover:text-stone-200 hover:bg-stone-800"
                      title="Редактировать сообщение"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {isDm && (
                      <button
                        onClick={() => onRegenerateMessage(msg.id)}
                        className="p-1 rounded text-stone-400 hover:text-amber-300 hover:bg-stone-800"
                        title="Сгенерировать другой вариант ответа"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteMessage(msg.id)}
                      className="p-1 rounded text-stone-400 hover:text-rose-400 hover:bg-stone-800"
                      title="Удалить из истории (не загрязняет память)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Collapsible Chain of Thought (Thinking Mode) */}
                {msg.reasoning && (
                  <div className="mb-3 rounded-lg bg-stone-950/70 border border-amber-950/80 overflow-hidden text-xs">
                    <button
                      onClick={() => toggleThought(msg.id)}
                      className="w-full px-3 py-1.5 flex items-center justify-between text-amber-400/80 hover:text-amber-300 bg-stone-950/90 transition-colors"
                    >
                      <span className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        Размышления мастера (D&D 5e Reasoning)
                      </span>
                      {openThoughts[msg.id] ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {openThoughts[msg.id] && (
                      <div className="p-3 text-[11px] text-stone-400 font-mono leading-relaxed whitespace-pre-wrap border-t border-stone-800/60 bg-stone-950/50">
                        {msg.reasoning}
                      </div>
                    )}
                  </div>
                )}

                {/* Main Prose / Content */}
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-700 rounded-lg p-2.5 text-xs text-stone-100"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingMessageId(null)}
                        className="px-2.5 py-1 text-xs rounded bg-stone-800 text-stone-300"
                      >
                        Отмена
                      </button>
                      <button
                        onClick={() => saveEdit(msg.id)}
                        className="px-3 py-1 text-xs font-semibold rounded bg-amber-600 text-stone-950 flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Сохранить</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs md:text-sm text-stone-200 leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                )}

                {/* Interactive Ability Check Card if requested by AI */}
                {msg.requestedCheck && (
                  <div className="mt-4 p-3.5 rounded-xl bg-amber-950/30 border border-amber-600/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        <span>Требуется проверка характеристики:</span>
                      </div>
                      <p className="text-stone-300 text-[11px]">
                        {msg.requestedCheck.description} ·{' '}
                        <span className="font-mono text-amber-400 font-semibold">
                          DC {msg.requestedCheck.dc}
                        </span>
                      </p>
                    </div>

                    <button
                      onClick={() => onRequestCheckRoll(msg.requestedCheck!)}
                      className="px-3.5 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-md"
                    >
                      <Dice6 className="w-4 h-4" />
                      <span>Бросить кубик d20</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-4 items-center animate-pulse">
            <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-md">
              <Dice6 className="w-6 h-6 animate-spin text-amber-400" />
            </div>
            <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 text-stone-400 text-xs font-mono">
              Мастер оценивает правила D&D 5e и сплетает нити повествования...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Stage with Player Switcher & Shortcuts */}
      <div className="p-3 md:p-4 bg-stone-900/95 border-t border-stone-800 backdrop-blur-md">
        {/* Pre-Check Action Assessment Banner */}
        {pendingActionCheck && (
          <div className="mb-3 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/60 shadow-lg animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs font-bold text-amber-200 font-fantasy">
                    Мастер D&D 5e требует проверку перед описанием исхода
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900/60 border border-amber-600/50 text-amber-300 font-mono font-bold">
                    DC {pendingActionCheck.assessment.dc || 13}
                  </span>
                </div>
                <p className="text-xs text-stone-200">
                  <span className="text-amber-400 font-semibold">{pendingActionCheck.characterName}:</span> «{pendingActionCheck.actionText}»
                </p>
                <p className="text-[11px] text-stone-300">
                  <strong>Проверка:</strong> {pendingActionCheck.assessment.description}
                  {pendingActionCheck.assessment.reason && ` · ${pendingActionCheck.assessment.reason}`}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                <button
                  onClick={onRollPendingCheck}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center gap-1.5 shadow-md transition-colors"
                >
                  <Dice6 className="w-4 h-4" />
                  <span>Бросить d20</span>
                </button>
                <button
                  onClick={onSkipPendingCheck}
                  className="px-3 py-1.5 text-xs rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition-colors"
                  title="Разрешить исход нарративно без броска кости"
                >
                  <span>Нарративно</span>
                </button>
                <button
                  onClick={onCancelPendingCheck}
                  className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded transition-colors"
                  title="Отменить действие"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Player Turn Tabs & Illuminated Cards */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 p-1 bg-stone-950 rounded-lg border border-stone-800/80 text-xs">
            {/* Player A Button */}
            <button
              onClick={() => onSelectSlot('A')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                activeSlot === 'A'
                  ? 'bg-amber-600 text-stone-950 font-bold shadow-sm shadow-amber-950'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>{charA.name.split(' ')[0]} (A)</span>
              <span className="hidden sm:inline text-[10px] opacity-80 font-mono">[{charA.class.split(' ')[0]}]</span>
            </button>

            {/* Player B Button */}
            <button
              onClick={() => onSelectSlot('B')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                activeSlot === 'B'
                  ? 'bg-amber-600 text-stone-950 font-bold shadow-sm shadow-amber-950'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>{charB.name.split(' ')[0]} (B)</span>
              <span className="hidden sm:inline text-[10px] opacity-80 font-mono">[{charB.class.split(' ')[0]}]</span>
            </button>

            {/* Simultaneous Turn Button */}
            <button
              onClick={() => onSelectSlot('SIMULTANEOUS')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                activeSlot === 'SIMULTANEOUS'
                  ? 'bg-amber-600 text-stone-950 font-bold shadow-sm shadow-amber-950'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Оба игрока действуют одновременно"
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>Совместно</span>
            </button>
          </div>

          {/* Quick Action Presets */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setInputText((prev) => `${prev}Крадусь в тени, соблюдая осторожность. `)}
              className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] border border-stone-700/60"
            >
              Скрытность
            </button>
            <button
              onClick={() => setInputText((prev) => `${prev}Внимательно осматриваю окружение в поисках скрытых деталей. `)}
              className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] border border-stone-700/60"
            >
              Осмотр
            </button>
            <button
              onClick={() => setInputText((prev) => `${prev}Обращаюсь к присутствующим и пытаюсь убедить их. `)}
              className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] border border-stone-700/60"
            >
              Убеждение
            </button>
          </div>
        </div>

        {/* Input Box */}
        {activeSlot === 'SIMULTANEOUS' ? (
          <div className="space-y-2">
            <div>
              <span className="text-[11px] text-amber-300 font-semibold block mb-1">
                Ход {charA.name}:
              </span>
              <textarea
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Действия и слова первого героя..."
                className="w-full bg-stone-950 border border-stone-700 rounded-lg p-2.5 text-xs text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <span className="text-[11px] text-amber-300 font-semibold block mb-1">
                Ход {charB.name}:
              </span>
              <textarea
                rows={2}
                value={simultaneousTextB}
                onChange={(e) => setSimultaneousTextB(e.target.value)}
                placeholder="Действия и слова второго героя..."
                className="w-full bg-stone-950 border border-stone-700 rounded-lg p-2.5 text-xs text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={handleSend}
                disabled={isLoading}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Отправить общий ход</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <textarea
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Опишите действия, слова или намерения ${
                activeSlot === 'A' ? charA.name : charB.name
              }... (Shift+Enter для переноса строки)`}
              className="flex-1 bg-stone-950 border border-stone-700 rounded-lg p-2.5 text-xs text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !inputText.trim()}
              className="px-4 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-40 shrink-0"
              title="Отправить (Enter)"
            >
              <Send className="w-4 h-4" />
              <span className="text-[10px] uppercase font-mono">Ход</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
