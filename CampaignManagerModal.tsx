import React, { useState } from 'react';
import {
  X,
  Plus,
  Compass,
  Edit2,
  Trash2,
  Check,
  MapPin,
  Image as ImageIcon,
  BookOpen,
  Sparkles,
  Shield,
  Layers,
} from 'lucide-react';
import { Campaign, RuleEdition, Character, LoreEntity, ChatMessage } from '../types/dnd';
import { GALLERY_ASSETS } from '../data/galleryAssets';
import { ImagePickerModal } from './ImagePickerModal';

interface CampaignManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: Campaign[];
  activeCampaignId: string;
  onSelectCampaign: (id: string) => void;
  onCreateCampaign: (newCampaign: Campaign, starterChars?: Character[], starterLore?: LoreEntity[], starterMsg?: ChatMessage) => void;
  onUpdateCampaign: (updated: Campaign) => void;
  onDeleteCampaign: (id: string) => void;
}

export const CampaignManagerModal: React.FC<CampaignManagerModalProps> = ({
  isOpen,
  onClose,
  campaigns,
  activeCampaignId,
  onSelectCampaign,
  onCreateCampaign,
  onUpdateCampaign,
  onDeleteCampaign,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] = useState<'create' | 'edit'>('create');

  // Create Form State
  const [creationMode, setCreationMode] = useState<'clean' | 'preset'>('clean');
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newEdition, setNewEdition] = useState<RuleEdition>('5e-srd');
  const [newCoverImage, setNewCoverImage] = useState(
    '/src/assets/images/dnd_crypt_dungeon_cover_1793979259913.jpg'
  );
  const [includeStarterLore, setIncludeStarterLore] = useState(false);

  // Edit Form State
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editCoverImage, setEditCoverImage] = useState('');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isImagePickerOpen) onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isImagePickerOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (presetKey: string) => {
    if (presetKey === 'crypt') {
      setCreationMode('preset');
      setNewTitle('Гробница Короля-Лича');
      setNewSubtitle('Смертоносное погружение в катакомбы нежити');
      setNewDescription('В воздухе звенит могильный холод, на цепях покачиваются жаровни с призрачным зеленым огнем. Где-то в глубине лабиринта покоится печать Короля-Лича.');
      setNewLocation('Зал Саркофагов');
      setNewCoverImage('/src/assets/images/dnd_crypt_dungeon_cover_1793979259913.jpg');
      setIncludeStarterLore(true);
    } else if (presetKey === 'feywild') {
      setCreationMode('preset');
      setNewTitle('Шепчущий Лес Фей');
      setNewSubtitle('Загадочное путешествие сквозь иллюзии и чары Фейвайлда');
      setNewDescription('Гигантские светящиеся грибы, мерцающие мотыльки и древние дубы, шепчущие на забытых наречиях. Здесь любое неосторожное слово может стать клятвой.');
      setNewLocation('Поляна Светящихся Грибов');
      setNewCoverImage('/src/assets/images/dnd_feywild_forest_cover_1793979260394.jpg');
      setIncludeStarterLore(true);
    } else if (presetKey === 'citadel') {
      setCreationMode('preset');
      setNewTitle('Врата Теней: Цитадель Штормов');
      setNewSubtitle('Мрачное расследование на границе забытого королевства');
      setNewDescription('Перед вами высятся неприступные бастионы Цитадели Штормов. Чтобы раскрыть тайну реликвий, вам предстоит преодолеть караул ворот.');
      setNewLocation('Врата Цитадели');
      setNewCoverImage('/src/assets/images/dnd_campaign_cover_1793967562693.jpg');
      setIncludeStarterLore(true);
    } else {
      setCreationMode('clean');
      setNewTitle('');
      setNewSubtitle('');
      setNewDescription('');
      setNewLocation('');
      setNewCoverImage('/src/assets/images/dnd_tavern_interior_1793967564891.jpg');
      setIncludeStarterLore(false);
    }
  };

  const handleStartCleanCreation = () => {
    setIsCreating(true);
    setCreationMode('clean');
    setNewTitle('');
    setNewSubtitle('');
    setNewDescription('');
    setNewLocation('');
    setNewCoverImage('/src/assets/images/dnd_tavern_interior_1793967564891.jpg');
    setIncludeStarterLore(false);
  };

  const handleSaveNewCampaign = () => {
    if (!newTitle.trim()) return;

    const newCampId = `camp-${Date.now()}`;
    const isClean = creationMode === 'clean';

    const newCamp: Campaign = {
      id: newCampId,
      title: newTitle.trim(),
      subtitle: newSubtitle.trim() || (isClean ? 'Чистая сессия: авторский мир' : 'Новое сказание искателей приключений'),
      description: newDescription.trim() || (isClean ? 'Абсолютно чистая сессия. Мир, персонажи и правила настраиваются игроком.' : 'Герои вступают на неизведанные земли, готовые к опасностям и славе.'),
      coverImage: newCoverImage,
      edition: newEdition,
      currentLocation: newLocation.trim() || 'Начальная точка пути',
      activePlayerSlot: 'A',
      dmMood: 'neutral',
      characterIds: [],
      historyChronicles: [],
      pinnedFacts: isClean ? [] : ['Мир полон забытых руин и древних заклинаний.'],
      lastPlayed: Date.now(),
      isCleanSession: isClean,
    };

    let starterLore: LoreEntity[] = [];
    if (includeStarterLore && !isClean) {
      starterLore = [
        {
          id: `lore-${Date.now()}-loc`,
          campaignId: newCampId,
          type: 'location',
          name: newLocation.trim() || 'Главная локация',
          summary: 'Первая точка назначения отряда.',
          details: 'Место наполнено следами недавних событий и скрытыми тайнами.',
          triggerKeywords: [newLocation.trim().toLowerCase(), 'окружение', 'местность'],
          activationMode: 'always',
          isAutoMutable: true,
        },
        {
          id: `lore-${Date.now()}-qst`,
          campaignId: newCampId,
          type: 'quest',
          name: 'Первый шаг в неизвестность',
          summary: 'Осмотреться, разведать обстановку и найти проводника или улику.',
          details: 'Героям предстоит сделать первый выбор пути.',
          triggerKeywords: ['задание', 'цель', 'квест'],
          activationMode: 'always',
          isAutoMutable: true,
        },
      ];
    }

    const starterMsg: ChatMessage = {
      id: `msg-start-${Date.now()}`,
      campaignId: newCampId,
      role: 'assistant',
      speakerName: 'Dungeon Master',
      speakerPlayerSlot: 'DM',
      dmMood: 'neutral',
      reasoning: isClean
        ? 'Старт абсолютно чистой сессии. Мастер приветствует игрока, ожидая создания первых персонажей и наполнения базы мира.'
        : 'Старт нового приключения. Задаем тон, описываем окружение и предлагаем игрокам действовать.',
      content: isClean
        ? `Вы создали совершенно чистую сессию: **«${newCamp.title}»**.\n\nТекущая стартовая локация: *${newCamp.currentLocation}*.\n${newCamp.description ? `\n*${newCamp.description}*\n` : ''}\n**Dungeon Master:** Сессия полностью свободна от шаблонов и заготовок. Откройте панель персонажей слева («+ Персонажи»), чтобы создать героев вашей партии, и наполните Базу знаний мира своими локациями, предметами и слухами.\n\n*Мастер ожидает: опишите первого персонажа или начните вступительное действие.*`
        : `Вы ступаете на земли приключения **«${newCamp.title}»**.\n\nТекущая локация: *${newCamp.currentLocation}*. ${newCamp.description}\n\n**Dungeon Master:** Ветер доносит шелест неизвестности. Ваши спутники проверяют оружие и снаряжение.\n\n*Что вы намерены предпринять в первую очередь?*`,
      timestamp: Date.now(),
    };

    onCreateCampaign(newCamp, undefined, starterLore, starterMsg);
    onSelectCampaign(newCampId);
    setIsCreating(false);
    onClose();
  };

  const handleStartEdit = (camp: Campaign) => {
    setEditingId(camp.id);
    setEditTitle(camp.title);
    setEditSubtitle(camp.subtitle);
    setEditDescription(camp.description);
    setEditLocation(camp.currentLocation);
    setEditCoverImage(camp.coverImage);
  };

  const handleSaveEdit = (camp: Campaign) => {
    onUpdateCampaign({
      ...camp,
      title: editTitle.trim() || camp.title,
      subtitle: editSubtitle.trim() || camp.subtitle,
      description: editDescription.trim() || camp.description,
      currentLocation: editLocation.trim() || camp.currentLocation,
      coverImage: editCoverImage || camp.coverImage,
    });
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-stone-900 border border-stone-800 rounded-xl shadow-2xl flex flex-col text-stone-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/80">
          <div className="flex items-center gap-3">
            <Compass className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold font-fantasy text-amber-200">
                Управление приключениями & Мирами
              </h2>
              <p className="text-xs text-stone-400">
                Создавайте свои собственные миры, редактируйте сюжеты, выбирайте обложки и персонажей
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartCleanCreation}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-500/40 transition-colors shadow-sm"
              title="Создать полностью чистую сессию с нуля без шаблонов"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Чистая сессия (с нуля)</span>
            </button>
            <button
              onClick={() => {
                setIsCreating(true);
                handleApplyPreset('crypt');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-600 hover:bg-amber-500 text-stone-950 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>По шаблону мира</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-stone-400 hover:text-stone-200 rounded-lg hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Create New Campaign Drawer */}
          {isCreating && (
            <div className="p-5 rounded-xl bg-stone-950 border border-amber-600/50 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{creationMode === 'clean' ? 'Создание чистой сессии (с нуля)' : 'Создание приключения по шаблону'}</span>
                  </span>
                  {creationMode === 'clean' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-mono font-bold">
                      0 заготовок · Полная свобода
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setIsCreating(false)}
                  className="text-stone-400 hover:text-stone-200 text-xs"
                >
                  Отмена
                </button>
              </div>

              {/* Mode switch tabs */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset('custom')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    creationMode === 'clean'
                      ? 'bg-amber-950/60 border-amber-500 text-amber-200 font-bold'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  ✨ Абсолютно чистая сессия (с нуля)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('crypt')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    creationMode === 'preset'
                      ? 'bg-amber-950/60 border-amber-500 text-amber-200 font-bold'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  🏰 Выбрать готовый шаблон мира
                </button>
              </div>

              {/* Template Presets Strip (shown in preset mode) */}
              {creationMode === 'preset' && (
                <div>
                  <span className="text-[11px] text-stone-400 block mb-1.5 font-medium">
                    Выбрать готовый шаблон мира:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => handleApplyPreset('crypt')}
                      className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-left text-xs"
                    >
                      <div className="font-bold text-emerald-300">Гробница Лича</div>
                      <div className="text-[10px] text-stone-400">Мрачные катакомбы</div>
                    </button>
                    <button
                      onClick={() => handleApplyPreset('feywild')}
                      className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-left text-xs"
                    >
                      <div className="font-bold text-purple-300">Лес Фей</div>
                      <div className="text-[10px] text-stone-400">Магия и иллюзии</div>
                    </button>
                    <button
                      onClick={() => handleApplyPreset('citadel')}
                      className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-left text-xs"
                    >
                      <div className="font-bold text-amber-300">Цитадель Штормов</div>
                      <div className="text-[10px] text-stone-400">Горный бастион</div>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-stone-400 block mb-1">Название приключения</label>
                  <input
                    type="text"
                    placeholder="Например: Проклятие Черной Башни"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-stone-900 border border-stone-700 text-stone-100"
                  />
                </div>

                <div>
                  <label className="text-xs text-stone-400 block mb-1">Стартовая локация</label>
                  <input
                    type="text"
                    placeholder="Например: Врата Древнего Склепа"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-stone-900 border border-stone-700 text-stone-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-stone-400 block mb-1">Краткий синопсис / Подзаголовок</label>
                <input
                  type="text"
                  placeholder="Мрачное расследование в заброшенных шахтах..."
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-stone-900 border border-stone-700 text-stone-100"
                />
              </div>

              <div>
                <label className="text-xs text-stone-400 block mb-1">
                  Вводное описание мира и сцены (для атмосферы мастера)
                </label>
                <textarea
                  rows={3}
                  placeholder="Опишите, что окружает героев, звуки, запахи, надвигающуюся угрозу..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-stone-900 border border-stone-700 text-stone-100"
                />
              </div>

              {/* Cover preview & Image selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="flex gap-3 items-center">
                  <img
                    src={newCoverImage}
                    alt="Cover preview"
                    referrerPolicy="no-referrer"
                    className="w-24 h-16 rounded-lg object-cover border border-stone-700 shadow-md shrink-0"
                  />
                  <div>
                    <span className="text-xs font-semibold text-stone-300 block">Обложка приключения</span>
                    <button
                      type="button"
                      onClick={() => {
                        setImagePickerTarget('create');
                        setIsImagePickerOpen(true);
                      }}
                      className="mt-1 flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-stone-900 hover:bg-stone-800 text-amber-300 border border-stone-700 transition-colors"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Выбрать из галереи</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-stone-400 block mb-1">Редакция правил</label>
                  <select
                    value={newEdition}
                    onChange={(e) => setNewEdition(e.target.value as RuleEdition)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-stone-900 border border-stone-700 text-stone-100"
                  >
                    <option value="5e-srd">D&D 5-я редакция (SRD)</option>
                    <option value="2024-revised">D&D 2024 (5.5e)</option>
                    <option value="3.5e-classic">D&D 3.5e Классика</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-800">
                <label className="flex items-center gap-2 text-xs text-stone-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeStarterLore}
                    onChange={(e) => setIncludeStarterLore(e.target.checked)}
                    className="rounded border-stone-700 bg-stone-900 text-amber-500"
                  />
                  <span>Создать базовые карточки локации и квеста для этого мира</span>
                </label>

                <button
                  onClick={handleSaveNewCampaign}
                  disabled={!newTitle.trim()}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors disabled:opacity-50"
                >
                  Создать и начать игру
                </button>
              </div>
            </div>
          )}

          {/* List of existing campaigns */}
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400 block">
              Все доступные приключения ({campaigns.length})
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.map((camp) => {
                const isActive = camp.id === activeCampaignId;
                const isEditing = editingId === camp.id;

                return (
                  <div
                    key={camp.id}
                    className={`rounded-xl overflow-hidden border transition-all flex flex-col justify-between ${
                      isActive
                        ? 'bg-stone-950 border-amber-500 shadow-xl shadow-amber-950/40 ring-1 ring-amber-500/50'
                        : 'bg-stone-950/70 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    {/* Cover Banner */}
                    <div className="relative h-28 overflow-hidden">
                      <img
                        src={camp.coverImage}
                        alt={camp.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover brightness-75"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent p-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-stone-900/90 border border-stone-700 text-amber-300 font-mono">
                              {camp.edition}
                            </span>
                            {camp.isCleanSession && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 font-mono font-bold">
                                ЧИСТАЯ
                              </span>
                            )}
                          </div>
                          {isActive && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500 font-bold text-stone-950 shadow-sm">
                              ТЕКУЩЕЕ
                            </span>
                          )}
                        </div>

                        <div>
                          <h3 className="text-base font-bold text-amber-100 font-fantasy truncate">
                            {camp.title}
                          </h3>
                          <div className="flex items-center gap-1 text-[11px] text-stone-300">
                            <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">{camp.currentLocation}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Content or Edit Form */}
                    <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded bg-stone-900 border border-stone-700 text-stone-100"
                            placeholder="Название"
                          />
                          <input
                            type="text"
                            value={editLocation}
                            onChange={(e) => setEditLocation(e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded bg-stone-900 border border-stone-700 text-stone-100"
                            placeholder="Локация"
                          />
                          <textarea
                            rows={2}
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded bg-stone-900 border border-stone-700 text-stone-100"
                            placeholder="Описание"
                          />
                          <div className="flex items-center justify-between pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setImagePickerTarget('edit');
                                setIsImagePickerOpen(true);
                              }}
                              className="text-[11px] text-amber-300 flex items-center gap-1 hover:underline"
                            >
                              <ImageIcon className="w-3 h-3" />
                              <span>Сменить обложку</span>
                            </button>

                            <div className="flex gap-1.5">
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-2 py-1 text-xs rounded bg-stone-800 text-stone-300"
                              >
                                Отмена
                              </button>
                              <button
                                onClick={() => handleSaveEdit(camp)}
                                className="px-3 py-1 text-xs font-semibold rounded bg-amber-600 text-stone-950 flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                <span>Сохранить</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <p className="text-xs text-amber-300/90 font-medium">{camp.subtitle}</p>
                          <p className="text-[11px] text-stone-300 line-clamp-2 leading-relaxed">
                            {camp.description}
                          </p>
                        </div>
                      )}

                      {/* Actions footer */}
                      {!isEditing && (
                        <div className="flex items-center justify-between pt-3 mt-2 border-t border-stone-800/60 text-xs">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleStartEdit(camp)}
                              className="p-1 text-stone-400 hover:text-amber-300 transition-colors"
                              title="Редактировать приключение"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {campaigns.length > 1 && (
                              <button
                                onClick={() => {
                                  if (confirm(`Вы уверены, что хотите удалить приключение «${camp.title}»?`)) {
                                    onDeleteCampaign(camp.id);
                                  }
                                }}
                                className="p-1 text-stone-400 hover:text-rose-400 transition-colors"
                                title="Удалить приключение"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {!isActive && (
                            <button
                              onClick={() => {
                                onSelectCampaign(camp.id);
                                onClose();
                              }}
                              className="px-3 py-1 rounded-md bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition-colors"
                            >
                              Переключиться сюда
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Art Gallery Picker for Covers */}
      <ImagePickerModal
        isOpen={isImagePickerOpen}
        onClose={() => setIsImagePickerOpen(false)}
        title="Выберите обложку приключения"
        currentUrl={imagePickerTarget === 'create' ? newCoverImage : editCoverImage}
        onSelectImage={(url) => {
          if (imagePickerTarget === 'create') setNewCoverImage(url);
          else setEditCoverImage(url);
        }}
      />
    </div>
  );
};
