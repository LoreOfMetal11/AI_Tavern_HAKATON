import React from 'react';
import { Shield, Heart, MapPin, Compass, Plus, Dice6, Users, BookOpen, Sparkles, FolderKanban, Activity, AlertCircle } from 'lucide-react';
import { Campaign, Character, LoreEntity, DmMood } from '../types/dnd';
import { DM_MOOD_CONFIG } from '../data/galleryAssets';
import { DND_CONDITIONS_CATALOG } from '../utils/rules';

interface PartySidebarProps {
  campaigns: Campaign[];
  activeCampaignId: string;
  characters: Character[];
  activeSlot: 'A' | 'B' | 'SIMULTANEOUS';
  activeLocation?: string;
  loreEntities: LoreEntity[];
  onSelectCampaign: (id: string) => void;
  onSelectSlot: (slot: 'A' | 'B' | 'SIMULTANEOUS') => void;
  onOpenCampaigns: () => void;
  onOpenCharacters: () => void;
  onOpenDice: () => void;
  onOpenLorebook: () => void;
  onChangeDmMood?: (mood: DmMood) => void;
}

export const PartySidebar: React.FC<PartySidebarProps> = ({
  campaigns,
  activeCampaignId,
  characters,
  activeSlot,
  activeLocation,
  loreEntities,
  onSelectCampaign,
  onSelectSlot,
  onOpenCampaigns,
  onOpenCharacters,
  onOpenDice,
  onOpenLorebook,
  onChangeDmMood,
}) => {
  const currentCampaign = campaigns.find((c) => c.id === activeCampaignId) || campaigns[0];
  const dmMood = currentCampaign.dmMood || 'neutral';
  const moodCfg = DM_MOOD_CONFIG[dmMood] || DM_MOOD_CONFIG.neutral;

  const activeQuest = loreEntities.find((e) => e.type === 'quest' && e.activationMode !== 'disabled');

  const cycleMood = () => {
    if (!onChangeDmMood) return;
    const moods: DmMood[] = ['neutral', 'combat', 'mystery', 'triumph', 'peril'];
    const nextIdx = (moods.indexOf(dmMood) + 1) % moods.length;
    onChangeDmMood(moods[nextIdx]);
  };

  return (
    <aside className="w-80 shrink-0 hidden md:flex flex-col h-full bg-stone-900 border-r border-stone-800 text-stone-200 overflow-y-auto">
      {/* Campaign Banner Header */}
      <div className="relative h-32 overflow-hidden border-b border-stone-800 shrink-0">
        <img
          src={currentCampaign.coverImage}
          alt={currentCampaign.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover brightness-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent p-4 flex flex-col justify-end">
          <span className="text-[10px] uppercase font-mono tracking-widest text-amber-400 font-bold">
            {currentCampaign.edition === '5e-srd' ? 'D&D 5e SRD' : currentCampaign.edition}
          </span>
          <h2 className="text-sm font-bold text-amber-100 font-fantasy truncate">
            {currentCampaign.title}
          </h2>
          <div className="flex items-center gap-1 text-[11px] text-stone-300 mt-0.5">
            <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate">{activeLocation || currentCampaign.currentLocation}</span>
          </div>
        </div>
      </div>

      {/* Campaign Switcher dropdown & Manager Button */}
      <div className="p-3 border-b border-stone-800/80 bg-stone-950/40 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-stone-400 uppercase tracking-wider block">
            Выбор приключения
          </label>
          <button
            onClick={onOpenCampaigns}
            className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium"
            title="Открыть менеджер миров и приключений"
          >
            <FolderKanban className="w-3 h-3" />
            <span>Управление</span>
          </button>
        </div>
        <select
          value={activeCampaignId}
          onChange={(e) => onSelectCampaign(e.target.value)}
          className="w-full bg-stone-900 border border-stone-700/80 rounded px-2.5 py-1 text-xs text-stone-200"
        >
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {/* Dynamic Dungeon Master Card */}
      <div className="p-3 border-b border-stone-800/80 bg-stone-950/60 text-xs">
        <div className="flex gap-3 items-center">
          <div className="relative group shrink-0">
            <img
              src="/src/assets/images/avatar_dm_master_mystic_1793979259583.jpg"
              alt="Dungeon Master"
              referrerPolicy="no-referrer"
              className={`w-11 h-11 rounded-xl object-cover border-2 transition-all ${moodCfg.borderColor} ${moodCfg.glowClass}`}
            />
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-stone-900 flex items-center justify-center">
              <Sparkles className="w-2 h-2 text-stone-950" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-amber-200 font-fantasy truncate">
                Dungeon Master
              </span>
              <button
                onClick={cycleMood}
                title="Нажмите для смены настроения мастера"
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-all ${moodCfg.borderColor} ${moodCfg.badgeBg} ${moodCfg.badgeText}`}
              >
                {moodCfg.title}
              </button>
            </div>
            <p className="text-[10px] text-stone-400 truncate mt-0.5">
              {moodCfg.description}
            </p>
          </div>
        </div>
      </div>

      {/* Active Quest Preview */}
      {activeQuest && (
        <div className="p-3.5 border-b border-stone-800/80 bg-amber-950/20 text-xs space-y-1">
          <div className="flex items-center gap-1.5 text-amber-300 font-bold text-[11px]">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>Текущая цель отряда</span>
          </div>
          <p className="font-semibold text-stone-200 text-xs">{activeQuest.name}</p>
          <p className="text-stone-300 text-[11px] leading-snug line-clamp-2">{activeQuest.summary}</p>
        </div>
      )}

      {/* Party Members (Illuminated Turn Tracking) */}
      <div className="p-4 space-y-3 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>Герои партии ({characters.length})</span>
          </span>
          <button
            onClick={onOpenCharacters}
            className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
          >
            <Plus className="w-3 h-3" />
            <span>Герои / Листы</span>
          </button>
        </div>

        <div className="space-y-3">
          {characters.length === 0 ? (
            <div className="p-4 rounded-xl bg-stone-950/80 border border-dashed border-stone-800 text-center space-y-2.5">
              <div className="w-9 h-9 rounded-full bg-amber-950/60 border border-amber-600/40 mx-auto flex items-center justify-center text-amber-400">
                <Users className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-stone-200">Партия еще не создана</div>
                <p className="text-[11px] text-stone-400 leading-snug">
                  В этой сессии пока нет героев. Создайте первого персонажа для начала игры!
                </p>
              </div>
              <button
                onClick={onOpenCharacters}
                className="w-full py-1.5 text-xs font-semibold rounded bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Создать первого героя</span>
              </button>
            </div>
          ) : (
            characters.map((char) => {
              const isTurn = activeSlot === char.playerSlot || activeSlot === 'SIMULTANEOUS';
              const hpPercent = Math.round((char.hpCurrent / char.hpMax) * 100);
              const conditions = char.activeConditions || [];

              return (
                <div
                  key={char.id}
                  onClick={() => onSelectSlot(char.playerSlot as 'A' | 'B')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    isTurn
                      ? 'bg-stone-950 border-amber-500 shadow-md shadow-amber-950/50'
                      : 'bg-stone-950/60 border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <div className="flex gap-3 items-center">
                    <div className="relative">
                      <img
                        src={char.avatar}
                        alt={char.name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-lg object-cover border border-stone-700"
                      />
                      {isTurn && (
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-stone-900" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-stone-200 truncate font-fantasy">
                          {char.name}
                        </span>
                        <span className="text-[10px] font-mono text-amber-400 font-semibold">
                          Ур. {char.level}
                        </span>
                      </div>

                      <div className="text-[11px] text-stone-400 truncate">
                        {char.race} · {char.class.split(' ')[0]}
                      </div>

                      {/* Vitals summary */}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                        <div className="flex items-center gap-1 text-rose-400 font-mono">
                          <Heart className="w-3 h-3 fill-rose-500/20" />
                          <span>{char.hpCurrent}/{char.hpMax}</span>
                        </div>
                        <div className="flex items-center gap-1 text-cyan-400 font-mono">
                          <Shield className="w-3 h-3" />
                          <span>КД {char.ac}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mini HP Bar */}
                  <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden mt-2">
                    <div
                      style={{ width: `${hpPercent}%` }}
                      className={`h-full ${
                        hpPercent > 50
                          ? 'bg-emerald-500'
                          : hpPercent > 25
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                    />
                  </div>

                  {/* Active Status Condition Badges */}
                  {conditions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-1.5 border-t border-stone-800/60">
                      {conditions.map((cond) => {
                        const catalog = DND_CONDITIONS_CATALOG.find((c) => c.type === cond.type);
                        return (
                          <span
                            key={cond.id}
                            className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${
                              catalog?.badgeColor || 'bg-stone-800 text-stone-300'
                            } ${catalog?.borderColor || 'border-stone-700'}`}
                            title={`${cond.nameRu}: ${cond.mechanicalEffectRu}`}
                          >
                            {cond.nameRu.split(' ')[0]}
                            {cond.level ? ` ${cond.level}` : ''}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Quick Utility footer buttons */}
      <div className="p-3 border-t border-stone-800 bg-stone-950/60 grid grid-cols-2 gap-2 text-xs">
        <button
          onClick={onOpenDice}
          className="py-2 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 flex items-center justify-center gap-1.5 transition-colors"
        >
          <Dice6 className="w-3.5 h-3.5 text-amber-400" />
          <span>Бросок кубика</span>
        </button>

        <button
          onClick={onOpenLorebook}
          className="py-2 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 flex items-center justify-center gap-1.5 transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>База знаний</span>
        </button>
      </div>
    </aside>
  );
};
