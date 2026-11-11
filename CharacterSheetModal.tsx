import React, { useState } from 'react';
import {
  X,
  Shield,
  Heart,
  Zap,
  Plus,
  Minus,
  Dice6,
  Edit2,
  Check,
  Book,
  UserPlus,
  Image as ImageIcon,
  Trash2,
  AlertTriangle,
  Flame,
  Info,
} from 'lucide-react';
import { Character, StatName, CheckRequest, ActiveCondition, ConditionType } from './dnd';
import { DND_SKILLS, formatModifier, getModifier, DND_CONDITIONS_CATALOG } from './rules';
import { ImagePickerModal } from './ImagePickerModal';

interface CharacterSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  characters: Character[];
  activeSlot: 'A' | 'B' | 'C' | 'D';
  onSelectSlot: (slot: 'A' | 'B' | 'C' | 'D') => void;
  onUpdateCharacter: (updated: Character) => void;
  onCreateCharacter?: (newChar: Character) => void;
  onDeleteCharacter?: (id: string) => void;
  onRollSkill: (check: CheckRequest) => void;
}

const STAT_DESCRIPTIONS: Record<
  StatName,
  { nameRu: string; description: string; benchmark: (v: number) => string }
> = {
  STR: {
    nameRu: 'Сила',
    description: 'Физическая мощь, мускулатура и способность поднимать тяжести.',
    benchmark: (v) =>
      v >= 18
        ? 'Легендарная мощь: сокрушает каменные преграды, переносит до 270 кг'
        : v >= 14
        ? 'Атлет: легко ломает дубовые брусья, побеждает в рукопашной'
        : v >= 10
        ? 'Обычная сила взрослого человека'
        : 'Слабость: трудно нести тяжелые доспехи',
  },
  DEX: {
    nameRu: 'Ловкость',
    description: 'Координация, грация, скорость реакции и скрытность.',
    benchmark: (v) =>
      v >= 18
        ? 'Неуловимый: ходит по тонким веткам, ловит стрелы на лету'
        : v >= 14
        ? 'Высокая сноровка: бесшумная походка, молниеносный лук'
        : v >= 10
        ? 'Стандартная координация'
        : 'Неуклюжесть: легко оступается, шумные шаги',
  },
  CON: {
    nameRu: 'Телосложение',
    description: 'Выносливость, стойкость к ранам, ядам и болезням.',
    benchmark: (v) =>
      v >= 18
        ? 'Железное здоровье: переносит смертельные яды и долгие марши'
        : v >= 14
        ? 'Закаленный воин: легко держит удар'
        : v >= 10
        ? 'Здоровый организм'
        : 'Хрупкое здоровье: быстро утомляется',
  },
  INT: {
    nameRu: 'Интеллект',
    description: 'Память, логика, знание арканных искусств и истории.',
    benchmark: (v) =>
      v >= 18
        ? 'Гений: расшифровывает древние языки, помнит сотни трактатов'
        : v >= 14
        ? 'Эрудит: аналитический склад ума, знаток тайн'
        : v >= 10
        ? 'Обычная грамотность'
        : 'Прямолинейность: с трудом понимает абстрактные схемы',
  },
  WIS: {
    nameRu: 'Мудрость',
    description: 'Интуиция, внимательность, связь с природой и духом.',
    benchmark: (v) =>
      v >= 18
        ? 'Ясновидящий: чувствует ложь за версту, слышит дыхание в лесу'
        : v >= 14
        ? 'Чуткий следопыт: замечает засады и скрытые знаки'
        : v >= 10
        ? 'Обычная проницательность'
        : 'Рассеянность: часто не замечает очевидных деталей',
  },
  CHA: {
    nameRu: 'Харизма',
    description: 'Лидерство, обаяние, внушительность и сила личности.',
    benchmark: (v) =>
      v >= 18
        ? 'Прирожденный вождь: вдохновляет полки, очаровывает королей'
        : v >= 14
        ? 'Убедительный оратор: вызывает доверие и уважение'
        : v >= 10
        ? 'Обычная манера общения'
        : 'Замкнутость: производит неловкое или пугающее впечатление',
  },
};

export const CharacterSheetModal: React.FC<CharacterSheetModalProps> = ({
  isOpen,
  onClose,
  characters,
  activeSlot,
  onSelectSlot,
  onUpdateCharacter,
  onCreateCharacter,
  onDeleteCharacter,
  onRollSkill,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] = useState<'current' | 'new'>('current');
  const [newItemName, setNewItemName] = useState('');

  // New Character Form State
  const [newName, setNewName] = useState('');
  const [newClass, setNewClass] = useState('Воин');
  const [newSubclass, setNewSubclass] = useState('Мастер боевых искусств');
  const [newRace, setNewRace] = useState('Человек');
  const [newAlignment, setNewAlignment] = useState('Хаотично-добрый');
  const [newLevel, setNewLevel] = useState(3);
  const [newHp, setNewHp] = useState(28);
  const [newAc, setNewAc] = useState(15);
  const [newSpeed, setNewSpeed] = useState(30);
  const [newAvatar, setNewAvatar] = useState('/src/assets/images/avatar_mage_sorceress_1793979257712.jpg');
  const [newBackstory, setNewBackstory] = useState('');
  const [newPersonality, setNewPersonality] = useState('');

  const character =
    characters.find((c) => c.playerSlot === activeSlot) ||
    characters[0];

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isImagePickerOpen) onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isImagePickerOpen]);

  if (!isOpen || !character) return null;

  const handleStatChange = (stat: StatName, delta: number) => {
    const newStats = {
      ...character.stats,
      [stat]: Math.max(3, Math.min(20, character.stats[stat] + delta)),
    };
    onUpdateCharacter({ ...character, stats: newStats });
  };

  const handleHpChange = (delta: number) => {
    const newHp = Math.max(0, Math.min(character.hpMax, character.hpCurrent + delta));
    onUpdateCharacter({ ...character, hpCurrent: newHp });
  };

  const handleToggleSkill = (skillKey: string) => {
    onUpdateCharacter({
      ...character,
      skills: {
        ...character.skills,
        [skillKey]: !character.skills[skillKey],
      },
    });
  };

  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    const newItem = {
      id: `inv-${Date.now()}`,
      name: newItemName.trim(),
      quantity: 1,
    };
    onUpdateCharacter({
      ...character,
      inventory: [...character.inventory, newItem],
    });
    setNewItemName('');
  };

  const handleRemoveItem = (id: string) => {
    onUpdateCharacter({
      ...character,
      inventory: character.inventory.filter((i) => i.id !== id),
    });
  };

  const handleAddCondition = (type: ConditionType, level: number = 1) => {
    const catalogItem = DND_CONDITIONS_CATALOG.find((c) => c.type === type);
    if (!catalogItem) return;

    const existing = (character.activeConditions || []).filter((c) => c.type !== type);
    const newCondition: ActiveCondition = {
      id: `cond-${Date.now()}-${type}`,
      type,
      nameRu: catalogItem.nameRu,
      level: type === 'exhaustion' ? level : undefined,
      descriptionRu: catalogItem.descriptionRu,
      mechanicalEffectRu: catalogItem.mechanicalEffectRu,
    };

    const newConditionsList = [...existing, newCondition];
    onUpdateCharacter({
      ...character,
      activeConditions: newConditionsList,
      currentCondition: newConditionsList.map((c) => c.nameRu.split(' ')[0]).join(', ') || 'В норме',
    });
  };

  const handleRemoveCondition = (id: string) => {
    const updated = (character.activeConditions || []).filter((c) => c.id !== id);
    onUpdateCharacter({
      ...character,
      activeConditions: updated,
      currentCondition: updated.length > 0 ? updated.map((c) => c.nameRu.split(' ')[0]).join(', ') : 'В норме',
    });
  };

  const handleExhaustionChange = (delta: number) => {
    const currentExhaustion = (character.activeConditions || []).find((c) => c.type === 'exhaustion');
    const currentLevel = currentExhaustion?.level || 0;
    const newLevel = Math.max(0, Math.min(6, currentLevel + delta));

    if (newLevel === 0 && currentExhaustion) {
      handleRemoveCondition(currentExhaustion.id);
    } else if (newLevel > 0) {
      handleAddCondition('exhaustion', newLevel);
    }
  };

  const handleSaveCreatedCharacter = () => {
    if (!newName.trim() || !onCreateCharacter) return;

    // Find next available slot
    const slots: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
    const takenSlots = characters.map((c) => c.playerSlot);
    const freeSlot = slots.find((s) => !takenSlots.includes(s)) || 'C';

    const created: Character = {
      id: `char-${Date.now()}`,
      campaignId: character.campaignId,
      name: newName.trim(),
      title: `${newRace} · ${newClass}`,
      isPlayer: true,
      playerSlot: freeSlot,
      avatar: newAvatar,
      race: newRace,
      class: newClass,
      subclass: newSubclass,
      level: newLevel,
      hpCurrent: newHp,
      hpMax: newHp,
      ac: newAc,
      speed: newSpeed,
      stats: {
        STR: 14,
        DEX: 14,
        CON: 14,
        INT: 10,
        WIS: 12,
        CHA: 10,
      },
      profBonus: 2,
      skills: {
        athletics: true,
        perception: true,
      },
      savingThrows: {
        STR: true,
        DEX: false,
        CON: true,
        INT: false,
        WIS: false,
        CHA: false,
      },
      inventory: [
        { id: `inv-${Date.now()}-1`, name: 'Основное оружие героя', quantity: 1 },
        { id: `inv-${Date.now()}-2`, name: 'Целебное зелье', quantity: 2 },
      ],
      gold: 25,
      alignment: newAlignment,
      backstory: newBackstory.trim() || 'Искатель приключений, стремящийся к славе.',
      personalityTraits: newPersonality.trim() || 'Храбрый и надежный спутник.',
      currentCondition: 'В норме',
    };

    onCreateCharacter(created);
    onSelectSlot(freeSlot);
    setIsCreatingNew(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-stone-900 border border-stone-800 rounded-xl shadow-2xl flex flex-col text-stone-100 overflow-hidden">
        {/* Header with Slot Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-stone-800 bg-stone-950/80">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold font-fantasy text-amber-200">Лист персонажа (D&D 5e)</h2>
            <div className="flex items-center gap-1 p-1 bg-stone-900 rounded-lg border border-stone-800 overflow-x-auto">
              {characters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onSelectSlot(c.playerSlot as 'A' | 'B' | 'C' | 'D')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    activeSlot === c.playerSlot
                      ? 'bg-amber-600 text-stone-950 font-bold'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {c.name.split(' ')[0]} ({c.playerSlot})
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onCreateCharacter && (
              <button
                onClick={() => setIsCreatingNew(!isCreatingNew)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-600/40 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Герой</span>
              </button>
            )}
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition-colors"
            >
              {isEditing ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Edit2 className="w-3.5 h-3.5 text-amber-400" />}
              <span>{isEditing ? 'Готово' : 'Редактировать'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-stone-400 hover:text-stone-200 rounded-lg hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* New Character Creation Drawer */}
          {isCreatingNew && (
            <div className="p-4 rounded-xl bg-stone-950 border border-amber-600/50 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Создание нового игрового персонажа
                </span>
                <button
                  onClick={() => setIsCreatingNew(false)}
                  className="text-stone-400 hover:text-stone-200 text-xs"
                >
                  Отмена
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-stone-400 block mb-1">Имя героя</label>
                  <input
                    type="text"
                    placeholder="Например: Селеста"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-stone-900 border border-stone-700 text-stone-100"
                  />
                </div>
                <div>
                  <label className="text-stone-400 block mb-1">Раса</label>
                  <input
                    type="text"
                    placeholder="Человек / Эльф / Дворф..."
                    value={newRace}
                    onChange={(e) => setNewRace(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-stone-900 border border-stone-700 text-stone-100"
                  />
                </div>
                <div>
                  <label className="text-stone-400 block mb-1">Класс и подкласс</label>
                  <input
                    type="text"
                    placeholder="Волшебник (Воплощение)..."
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-stone-900 border border-stone-700 text-stone-100"
                  />
                </div>
              </div>

              {/* Avatar selection for new character */}
              <div className="flex gap-4 items-center p-3 rounded-lg bg-stone-900 border border-stone-800">
                <img
                  src={newAvatar}
                  alt="New hero preview"
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-lg object-cover border border-amber-600/50"
                />
                <div className="flex-1">
                  <span className="text-xs font-semibold text-stone-300 block">Аватарка персонажа</span>
                  <button
                    type="button"
                    onClick={() => {
                      setImagePickerTarget('new');
                      setIsImagePickerOpen(true);
                    }}
                    className="mt-1 flex items-center gap-1.5 px-3 py-1 text-xs rounded bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700 transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Выбрать портрет из галереи</span>
                  </button>
                </div>

                <button
                  onClick={handleSaveCreatedCharacter}
                  disabled={!newName.trim()}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors disabled:opacity-40"
                >
                  Добавить героя в отряд
                </button>
              </div>
            </div>
          )}

          {/* Hero Banner: Identity & Health */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 rounded-xl bg-stone-950/60 border border-stone-800/80">
            {/* Portrait & Core Info */}
            <div className="flex gap-4 items-center md:col-span-2">
              <div className="relative group cursor-pointer shrink-0">
                <img
                  src={character.avatar}
                  alt={character.name}
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-xl object-cover border-2 border-amber-600/50 shadow-md"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImagePickerTarget('current');
                    setIsImagePickerOpen(true);
                  }}
                  className="absolute inset-0 bg-black/60 rounded-xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[10px] text-amber-300 transition-opacity"
                  title="Сменить аватарку"
                >
                  <ImageIcon className="w-5 h-5 mb-0.5" />
                  <span>Сменить</span>
                </button>
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-amber-100 font-fantasy truncate">
                    {character.name}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/50 font-mono shrink-0">
                    Ур. {character.level}
                  </span>
                </div>
                <p className="text-xs text-stone-300">
                  {character.race} ·{' '}
                  <span className="text-amber-400 font-medium">{character.class}</span>{' '}
                  ({character.subclass})
                </p>
                <p className="text-[11px] text-stone-400">Мировоззрение: {character.alignment}</p>
                <div className="text-[11px] text-stone-400">
                  Состояние:{' '}
                  <span className="text-emerald-400">{character.currentCondition || 'В норме'}</span>
                </div>
              </div>
            </div>

            {/* Combat Vitals */}
            <div className="grid grid-cols-3 gap-2">
              {/* HP */}
              <div className="p-3 bg-stone-900 rounded-lg border border-stone-800 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-1 text-rose-400 text-xs font-semibold mb-1">
                  <Heart className="w-3.5 h-3.5 fill-rose-500/20" />
                  <span>Хиты (HP)</span>
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-stone-100">
                  {character.hpCurrent} / {character.hpMax}
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                  <button
                    onClick={() => handleHpChange(-1)}
                    className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                    title="-1 урон"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleHpChange(1)}
                    className="p-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                    title="+1 лечение"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* AC */}
              <div className="p-3 bg-stone-900 rounded-lg border border-stone-800 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-1 text-cyan-400 text-xs font-semibold mb-1">
                  <Shield className="w-3.5 h-3.5" />
                  <span>КД (AC)</span>
                </div>
                <div className="text-2xl font-bold font-mono text-cyan-200">{character.ac}</div>
                <span className="text-[10px] text-stone-400 mt-1">Класс доспеха</span>
              </div>

              {/* Speed & Prof */}
              <div className="p-3 bg-stone-900 rounded-lg border border-stone-800 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-1 text-amber-400 text-xs font-semibold mb-1">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Бонус</span>
                </div>
                <div className="text-2xl font-bold font-mono text-amber-200">
                  +{character.profBonus}
                </div>
                <span className="text-[10px] text-stone-400 mt-1">
                  Скорость {character.speed} фт
                </span>
              </div>
            </div>
          </div>

          {/* Active Statuses and Conditions (D&D 5e Status Tracking) */}
          <div className="p-4 rounded-xl bg-stone-950/80 border border-stone-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-200">
                  Активные статусы & Состояния (D&D 5e)
                </h4>
                <span className="text-[11px] text-stone-400">
                  ({(character.activeConditions || []).length} акт.)
                </span>
              </div>

              {/* Quick Add Dropdown / Trigger */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-stone-400">Быстрое наложение:</span>
                <button
                  type="button"
                  onClick={() => handleAddCondition('poisoned')}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 transition-colors"
                  title="Отравлен: помеха на атаки и проверки характеристик"
                >
                  + Отравлен
                </button>
                <button
                  type="button"
                  onClick={() => handleExhaustionChange(1)}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-950/80 hover:bg-amber-900 border border-amber-700/60 text-amber-300 transition-colors"
                  title="Истощение (+1 уровень)"
                >
                  + Истощение
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCondition('frightened')}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-950/80 hover:bg-purple-900 border border-purple-700/60 text-purple-300 transition-colors"
                  title="Испуган: помеха на атаки/проверки в поле зрения источника"
                >
                  + Испуган
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCondition('prone')}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-orange-950/80 hover:bg-orange-900 border border-orange-700/60 text-orange-300 transition-colors"
                  title="Сбит с ног: ползком или встать за половину скорости"
                >
                  + Сбит с ног
                </button>

                {/* Dropdown for All Conditions */}
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddCondition(e.target.value as ConditionType);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  className="px-2 py-0.5 rounded text-[10px] bg-stone-900 border border-stone-700 text-stone-300 cursor-pointer"
                >
                  <option value="" disabled>+ Все состояния...</option>
                  {DND_CONDITIONS_CATALOG.map((item) => (
                    <option key={item.type} value={item.type}>
                      {item.nameRu}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Condition Badges */}
            {(character.activeConditions && character.activeConditions.length > 0) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {character.activeConditions.map((cond) => {
                  const catalogItem = DND_CONDITIONS_CATALOG.find((c) => c.type === cond.type);
                  const isExhaustion = cond.type === 'exhaustion';

                  return (
                    <div
                      key={cond.id}
                      className={`p-2.5 rounded-lg border flex flex-col justify-between gap-1 transition-all ${
                        catalogItem?.badgeColor || 'bg-stone-900 text-stone-200'
                      } ${catalogItem?.borderColor || 'border-stone-700'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-bold text-xs">
                            {cond.nameRu} {isExhaustion ? `(Уровень ${cond.level || 1}/6)` : ''}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {isExhaustion && (
                            <div className="flex items-center gap-0.5 mr-1">
                              <button
                                type="button"
                                onClick={() => handleExhaustionChange(-1)}
                                className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-black/60 text-[10px]"
                                title="Уменьшить уровень истощения"
                              >
                                -
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExhaustionChange(1)}
                                className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-black/60 text-[10px]"
                                title="Увеличить уровень истощения"
                              >
                                +
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveCondition(cond.id)}
                            className="p-1 rounded hover:bg-black/30 text-stone-300 hover:text-white"
                            title="Снять состояние"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-[10px] opacity-90 leading-tight">
                        <span className="font-semibold text-amber-200">Эффект:</span> {cond.mechanicalEffectRu}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-stone-900/40 border border-stone-800/60 text-[11px] text-stone-400 flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>У персонажа нет активных негативных состояний. Все проверки характеристик и броски атаки совершаются в штатном режиме.</span>
              </div>
            )}
          </div>

          {/* 6 Core Ability Scores */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3 flex items-center gap-2">
              <span>Основные характеристики и модификаторы</span>
              <span className="text-[10px] text-stone-400 normal-case">
                (Нажмите на кубик для быстрой проверки)
              </span>
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as StatName[]).map((stat) => {
                const val = character.stats[stat];
                const mod = getModifier(val);
                const info = STAT_DESCRIPTIONS[stat];
                return (
                  <div
                    key={stat}
                    className="group relative p-3 rounded-xl bg-stone-950 border border-stone-800 hover:border-amber-600/50 flex flex-col items-center justify-between text-center transition-all"
                  >
                    <div className="text-xs font-bold text-amber-300/90">
                      {info.nameRu} ({stat})
                    </div>
                    <div className="my-2">
                      <div className="text-2xl font-extrabold font-mono text-amber-400">
                        {formatModifier(mod)}
                      </div>
                      <div className="text-[11px] text-stone-400 font-mono">Значение: {val}</div>
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => handleStatChange(stat, -1)}
                          className="p-1 rounded bg-stone-800 hover:bg-stone-700"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleStatChange(stat, 1)}
                          className="p-1 rounded bg-stone-800 hover:bg-stone-700"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          onRollSkill({
                            stat,
                            dc: 13,
                            description: `Чистая проверка характеристики ${info.nameRu} (${stat})`,
                          });
                          onClose();
                        }}
                        className="w-full mt-1 py-1 px-2 text-[10px] rounded bg-stone-900 hover:bg-amber-600/20 text-stone-300 hover:text-amber-300 border border-stone-800 flex items-center justify-center gap-1 transition-colors"
                      >
                        <Dice6 className="w-3 h-3 text-amber-400" />
                        <span>Бросок</span>
                      </button>
                    )}

                    {/* Benchmark Tooltip on Hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-stone-800 border border-stone-700 rounded-lg text-[10px] text-stone-200 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-20">
                      <p className="font-semibold text-amber-300 mb-0.5">{info.description}</p>
                      <p className="text-stone-300">{info.benchmark(val)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Skills & Inventory 2-Column Split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Skills */}
            <div className="p-4 rounded-xl bg-stone-950/70 border border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                  Навыки персонажа (D&D 5e)
                </h4>
                <span className="text-[11px] text-stone-400">Клик по кости = бросок</span>
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {DND_SKILLS.map((skill) => {
                  const isProf = !!character.skills[skill.key];
                  const statMod = getModifier(character.stats[skill.stat]);
                  const totalSkillBonus = statMod + (isProf ? character.profBonus : 0);

                  return (
                    <div
                      key={skill.key}
                      className="flex items-center justify-between p-1.5 rounded-lg hover:bg-stone-900/80 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={isProf}
                            onChange={() => handleToggleSkill(skill.key)}
                            className="rounded border-stone-700 bg-stone-900 text-amber-500"
                          />
                        ) : (
                          <div
                            className={`w-2 h-2 rounded-full ${
                              isProf ? 'bg-amber-400' : 'bg-stone-700'
                            }`}
                          />
                        )}
                        <span className={isProf ? 'text-amber-200 font-medium' : 'text-stone-300'}>
                          {skill.nameRu}{' '}
                          <span className="text-stone-400 text-[10px]">({skill.stat})</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-stone-300 text-xs">
                          {formatModifier(totalSkillBonus)}
                        </span>
                        <button
                          onClick={() => {
                            onRollSkill({
                              stat: skill.stat,
                              skillName: skill.nameRu,
                              dc: 13,
                              description: `Проверка навыка: ${skill.nameRu} (${skill.stat})`,
                            });
                            onClose();
                          }}
                          className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-amber-300 transition-colors"
                          title={`Бросить ${skill.nameRu}`}
                        >
                          <Dice6 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inventory & Notes */}
            <div className="space-y-4">
              {/* Inventory */}
              <div className="p-4 rounded-xl bg-stone-950/70 border border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                    Инвентарь & Снаряжение
                  </h4>
                  <span className="text-xs font-mono text-amber-400">{character.gold} зм (золота)</span>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {character.inventory.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-1.5 rounded-lg bg-stone-900 text-xs border border-stone-800/80"
                    >
                      <span className="text-stone-200">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-stone-400 font-mono text-[11px]">x{item.quantity}</span>
                        {isEditing && (
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-0.5 text-rose-400 hover:text-rose-300"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {isEditing && (
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Добавить предмет..."
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                      className="flex-1 px-2.5 py-1 text-xs rounded bg-stone-900 border border-stone-700 text-stone-200 placeholder:text-stone-400"
                    />
                    <button
                      onClick={handleAddItem}
                      className="px-3 py-1 text-xs font-semibold rounded bg-amber-600 text-stone-950 hover:bg-amber-500"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>

              {/* Backstory & Personality */}
              <div className="p-4 rounded-xl bg-stone-950/70 border border-stone-800 text-xs space-y-2">
                <div className="flex items-center gap-1.5 text-stone-400 font-semibold uppercase tracking-wider text-[11px]">
                  <Book className="w-3.5 h-3.5 text-amber-400" />
                  <span>Предыстория и характер</span>
                </div>
                <p className="text-stone-300 text-[11px] leading-relaxed">{character.backstory}</p>
                <div className="pt-1 text-[11px] text-stone-400">
                  <span className="text-amber-300 font-medium">Особенности:</span>{' '}
                  {character.personalityTraits}
                </div>
              </div>

              {/* Delete Character Option */}
              {characters.length > 1 && onDeleteCharacter && (
                <div className="pt-1 flex justify-end">
                  <button
                    onClick={() => {
                      if (confirm(`Удалить персонажа ${character.name}?`)) {
                        onDeleteCharacter(character.id);
                      }
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 rounded bg-stone-950 border border-rose-950 hover:border-rose-800 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Удалить персонажа</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Art Gallery Picker for Characters */}
      <ImagePickerModal
        isOpen={isImagePickerOpen}
        onClose={() => setIsImagePickerOpen(false)}
        title="Выберите портрет персонажа"
        currentUrl={imagePickerTarget === 'current' ? character.avatar : newAvatar}
        onSelectImage={(url) => {
          if (imagePickerTarget === 'current') {
            onUpdateCharacter({ ...character, avatar: url });
          } else {
            setNewAvatar(url);
          }
        }}
      />
    </div>
  );
};
