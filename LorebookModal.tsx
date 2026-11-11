import React, { useState } from 'react';
import { X, Plus, Search, Tag, Sparkles, Trash2, Edit3, Check, MapPin, Users, Sword, ShieldAlert, Compass } from 'lucide-react';
import { LoreEntity, EntityType, ActivationMode } from '../types/dnd';

interface LorebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  entities: LoreEntity[];
  onUpdateEntity: (entity: LoreEntity) => void;
  onAddEntity: (entity: LoreEntity) => void;
  onDeleteEntity: (id: string) => void;
}

const TYPE_CONFIG: Record<EntityType, { label: string; icon: React.ReactNode; color: string }> = {
  npc: { label: 'NPC / Персонаж', icon: <Users className="w-3.5 h-3.5" />, color: 'text-amber-400' },
  location: { label: 'Локация / Зона', icon: <MapPin className="w-3.5 h-3.5" />, color: 'text-emerald-400' },
  faction: { label: 'Фракция / Орден', icon: <ShieldAlert className="w-3.5 h-3.5" />, color: 'text-indigo-400' },
  item: { label: 'Предмет / Артефакт', icon: <Sword className="w-3.5 h-3.5" />, color: 'text-rose-400' },
  quest: { label: 'Квест / Задача', icon: <Compass className="w-3.5 h-3.5" />, color: 'text-cyan-400' },
  rumor: { label: 'Слух / Тайна', icon: <Sparkles className="w-3.5 h-3.5" />, color: 'text-purple-400' },
  relation: { label: 'Отношения', icon: <Users className="w-3.5 h-3.5" />, color: 'text-pink-400' },
};

const ACTIVATION_MODES: Array<{ mode: ActivationMode; label: string; desc: string }> = [
  { mode: 'trigger', label: 'По триггерам', desc: 'Включается при совпадении ключевых слов в чате' },
  { mode: 'always', label: 'Всегда в памяти', desc: 'Закреплено в контексте каждого запроса' },
  { mode: 'logic', label: 'По логике ситуации', desc: 'Нейросеть сама распознает контекстную уместность' },
  { mode: 'disabled', label: 'Выключено', desc: 'Временно скрыто из контекста' },
];

export const LorebookModal: React.FC<LorebookModalProps> = ({
  isOpen,
  onClose,
  campaignId,
  entities,
  onUpdateEntity,
  onAddEntity,
  onDeleteEntity,
}) => {
  const [selectedType, setSelectedType] = useState<EntityType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // New Entity Form State
  const [isCreating, setIsCreating] = useState(false);
  const [newType, setNewType] = useState<EntityType>('npc');
  const [newName, setNewName] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newDetails, setNewDetails] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [newMode, setNewMode] = useState<ActivationMode>('trigger');
  const [newAutoMutable, setNewAutoMutable] = useState(true);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredEntities = entities.filter((e) => {
    if (selectedType !== 'all' && e.type !== selectedType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = e.name.toLowerCase().includes(q);
      const matchSummary = e.summary.toLowerCase().includes(q);
      const matchKeywords = e.triggerKeywords.some((k) => k.toLowerCase().includes(q));
      return matchName || matchSummary || matchKeywords;
    }
    return true;
  });

  const handleSaveNew = () => {
    if (!newName.trim()) return;
    const kw = newKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const created: LoreEntity = {
      id: `lore-${Date.now()}`,
      campaignId,
      type: newType,
      name: newName.trim(),
      summary: newSummary.trim() || 'Краткое описание',
      details: newDetails.trim() || 'Подробные факты для ИИ',
      triggerKeywords: kw.length > 0 ? kw : [newName.trim().toLowerCase()],
      activationMode: newMode,
      isAutoMutable: newAutoMutable,
    };

    onAddEntity(created);
    setIsCreating(false);
    setNewName('');
    setNewSummary('');
    setNewDetails('');
    setNewKeywords('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-stone-900 border border-stone-800 rounded-xl shadow-2xl flex flex-col text-stone-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/80">
          <div>
            <h2 className="text-lg font-bold font-fantasy text-amber-200">
              База знаний мира (World Info / Lorebook)
            </h2>
            <p className="text-xs text-stone-400">
              Хранилище фактов, локаций и персонажей с автоматическим и триггерным подтягиванием в контекст ИИ
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-600 hover:bg-amber-500 text-stone-950 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Создать запись</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-stone-400 hover:text-stone-200 rounded-lg hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-stone-800/80 bg-stone-950/40">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors whitespace-nowrap ${
                selectedType === 'all'
                  ? 'bg-stone-800 text-amber-300 border border-amber-600/40'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Все ({entities.length})
            </button>
            {(Object.keys(TYPE_CONFIG) as EntityType[]).map((type) => {
              const cfg = TYPE_CONFIG[type];
              const count = entities.filter((e) => e.type === type).length;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md font-medium transition-colors whitespace-nowrap ${
                    selectedType === type
                      ? 'bg-stone-800 text-amber-300 border border-amber-600/40'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {cfg.icon}
                  <span>{cfg.label.split('/')[0]} ({count})</span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Поиск по имени или триггеру..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs rounded-md bg-stone-900 border border-stone-700 text-stone-200 placeholder:text-stone-400"
            />
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Create New Entity Drawer */}
          {isCreating && (
            <div className="p-4 rounded-xl bg-stone-950 border border-amber-600/40 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Новая запись в базу знаний
                </span>
                <button
                  onClick={() => setIsCreating(false)}
                  className="text-stone-400 hover:text-stone-200 text-xs"
                >
                  Отмена
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-stone-400 block mb-1">Категория сущности</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as EntityType)}
                    className="w-full bg-stone-900 border border-stone-700 rounded px-2.5 py-1 text-xs text-stone-200"
                  >
                    {(Object.keys(TYPE_CONFIG) as EntityType[]).map((t) => (
                      <option key={t} value={t}>
                        {TYPE_CONFIG[t].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-stone-400 block mb-1">Название / Имя</label>
                  <input
                    type="text"
                    placeholder="Например: Сержант Варгас"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-700 rounded px-2.5 py-1 text-xs text-stone-200"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-stone-400 block mb-1">Режим активации в контекст</label>
                  <select
                    value={newMode}
                    onChange={(e) => setNewMode(e.target.value as ActivationMode)}
                    className="w-full bg-stone-900 border border-stone-700 rounded px-2.5 py-1 text-xs text-stone-200"
                  >
                    {ACTIVATION_MODES.map((m) => (
                      <option key={m.mode} value={m.mode}>
                        {m.label} ({m.desc})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-stone-400 block mb-1">Краткая суть (1-2 предложения)</label>
                <input
                  type="text"
                  placeholder="Кто это, где находится и какую роль играет..."
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-700 rounded px-2.5 py-1 text-xs text-stone-200"
                />
              </div>

              <div>
                <label className="text-[11px] text-stone-400 block mb-1">
                  Подробные детали для ИИ (внешность, секреты, мотивы, статы)
                </label>
                <textarea
                  rows={3}
                  placeholder="Факты, которые нейросеть должна знать при активации этой карточки..."
                  value={newDetails}
                  onChange={(e) => setNewDetails(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-700 rounded px-2.5 py-1 text-xs text-stone-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-stone-400 block mb-1">
                    Ключевые слова-триггеры (через запятую)
                  </label>
                  <input
                    type="text"
                    placeholder="варгас, сержант, караул, стража"
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-700 rounded px-2.5 py-1 text-xs text-stone-200 font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 pt-4">
                  <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAutoMutable}
                      onChange={(e) => setNewAutoMutable(e.target.checked)}
                      className="rounded border-stone-700 bg-stone-900 text-amber-500"
                    />
                    <span>Разрешить ИИ автоматически дополнять карточку по ходу сюжета</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveNew}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors"
                >
                  Сохранить в базу знаний
                </button>
              </div>
            </div>
          )}

          {/* Entities Grid */}
          {filteredEntities.length === 0 ? (
            <div className="p-12 text-center text-stone-400 text-xs">
              Нет записей, соответствующих выбранным критериям.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredEntities.map((entity) => {
                const cfg = TYPE_CONFIG[entity.type] || TYPE_CONFIG.npc;
                const isEditingThis = editingId === entity.id;

                return (
                  <div
                    key={entity.id}
                    className="p-4 rounded-xl bg-stone-950/70 border border-stone-800 hover:border-stone-700 flex flex-col justify-between transition-all"
                  >
                    <div className="space-y-2">
                      {/* Top Bar of Card */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`p-1 rounded bg-stone-900 ${cfg.color}`}>{cfg.icon}</span>
                          <span className="text-xs font-semibold text-stone-300">{cfg.label}</span>
                        </div>

                        {/* Activation Mode Selector */}
                        <select
                          value={entity.activationMode}
                          onChange={(e) =>
                            onUpdateEntity({
                              ...entity,
                              activationMode: e.target.value as ActivationMode,
                            })
                          }
                          className="bg-stone-900 border border-stone-700/60 rounded px-2 py-0.5 text-[11px] text-amber-300 font-medium"
                        >
                          {ACTIVATION_MODES.map((m) => (
                            <option key={m.mode} value={m.mode}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Name & Summary */}
                      <div>
                        <h3 className="text-base font-bold text-amber-100 font-fantasy">{entity.name}</h3>
                        <p className="text-xs text-stone-300 mt-0.5">{entity.summary}</p>
                      </div>

                      {/* Details Box */}
                      <div className="p-2.5 rounded-lg bg-stone-900/90 border border-stone-800/80 text-[11px] text-stone-300 leading-relaxed">
                        {entity.details}
                      </div>

                      {/* Auto-Mutation Notes if changed by AI */}
                      {entity.lastUpdatedNotes && (
                        <div className="p-2 rounded bg-amber-950/30 border border-amber-600/30 text-[11px] text-amber-300 flex items-start gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                          <span>
                            <strong>Заметки изменений от ИИ:</strong> {entity.lastUpdatedNotes}
                          </span>
                        </div>
                      )}

                      {/* Triggers list */}
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <Tag className="w-3 h-3 text-stone-400" />
                        {entity.triggerKeywords.map((kw, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded bg-stone-900 text-stone-400 text-[10px] font-mono border border-stone-800"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-stone-800/60 text-xs">
                      <label className="flex items-center gap-1.5 text-[11px] text-stone-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={entity.isAutoMutable}
                          onChange={(e) =>
                            onUpdateEntity({ ...entity, isAutoMutable: e.target.checked })
                          }
                          className="rounded border-stone-700 bg-stone-900 text-amber-500"
                        />
                        <span>Авто-изменение ИИ</span>
                      </label>

                      <button
                        onClick={() => onDeleteEntity(entity.id)}
                        className="text-stone-400 hover:text-rose-400 p-1 rounded transition-colors"
                        title="Удалить карточку"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
