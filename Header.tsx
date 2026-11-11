import React from 'react';
import { Dice6, BookOpen, User, Sparkles, Sliders, Database, History, Compass } from 'lucide-react';
import { ModelSettings, Campaign, DmMood } from './dnd';
import { DM_MOOD_CONFIG } from './galleryAssets';

interface HeaderProps {
  campaign: Campaign;
  settings: ModelSettings;
  onOpenCampaigns: () => void;
  onOpenDice: () => void;
  onOpenCharacters: () => void;
  onOpenLorebook: () => void;
  onOpenContext: () => void;
  onOpenNotebook: () => void;
  onOpenSettings: () => void;
  onChangeDmMood?: (mood: DmMood) => void;
}

export const Header: React.FC<HeaderProps> = ({
  campaign,
  settings,
  onOpenCampaigns,
  onOpenDice,
  onOpenCharacters,
  onOpenLorebook,
  onOpenContext,
  onOpenNotebook,
  onOpenSettings,
  onChangeDmMood,
}) => {
  const currentMood = campaign.dmMood || 'neutral';
  const moodCfg = DM_MOOD_CONFIG[currentMood] || DM_MOOD_CONFIG.neutral;

  const cycleMood = () => {
    if (!onChangeDmMood) return;
    const moods: DmMood[] = ['neutral', 'combat', 'mystery', 'triumph', 'peril'];
    const nextIdx = (moods.indexOf(currentMood) + 1) % moods.length;
    onChangeDmMood(moods[nextIdx]);
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-5 py-2.5 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 text-stone-200">
      {/* Zone 1: Brand title wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <a href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:bg-amber-600/30 transition-colors">
            <Dice6 className="w-5 h-5 text-amber-400" />
          </div>
          <span className="text-lg font-bold tracking-tight text-amber-100 font-fantasy whitespace-nowrap">
            MythicTavern
          </span>
        </a>

        {/* Dynamic DM Mood pill button */}
        <button
          onClick={cycleMood}
          title={`Настроение сцены: ${moodCfg.title} (${moodCfg.description}). Нажмите, чтобы переключить`}
          className={`hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium transition-all ${moodCfg.borderColor} ${moodCfg.badgeBg} ${moodCfg.badgeText} ${moodCfg.glowClass}`}
        >
          <Sparkles className="w-3 h-3" />
          <span className="whitespace-nowrap">{moodCfg.title}</span>
        </button>

        {/* Reasoning Effort indicator if thinking mode is on */}
        {settings.thinkingMode && (
          <button
            onClick={onOpenSettings}
            title={`Режим размышления активен (${settings.reasoningEffort === 'deep' ? 'Глубокий анализ' : settings.reasoningEffort === 'concise' ? 'Краткий фокус' : 'Стандарт D&D 5e'}). Нажмите для настройки`}
            className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-950/40 text-amber-300 text-[10px] font-mono hover:bg-amber-900/40 transition-colors"
          >
            <span>CoT:</span>
            <span className="font-bold uppercase">{settings.reasoningEffort || 'std'}</span>
          </button>
        )}
      </div>

      {/* Zone 2: Navigation links */}
      <nav className="hidden lg:flex items-center gap-5 text-xs font-medium text-stone-400">
        <button
          onClick={onOpenCampaigns}
          className="flex items-center gap-1.5 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
        >
          <Compass className="w-3.5 h-3.5 text-amber-500/70" />
          <span>Приключения</span>
        </button>

        <button
          onClick={onOpenCharacters}
          className="flex items-center gap-1.5 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
        >
          <User className="w-3.5 h-3.5 text-amber-500/70" />
          <span>Персонажи</span>
        </button>

        <button
          onClick={onOpenLorebook}
          className="flex items-center gap-1.5 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
        >
          <Database className="w-3.5 h-3.5 text-amber-500/70" />
          <span>База знаний</span>
        </button>

        <button
          onClick={onOpenNotebook}
          className="flex items-center gap-1.5 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
        >
          <BookOpen className="w-3.5 h-3.5 text-amber-500/70" />
          <span>Хроники</span>
        </button>

        <button
          onClick={onOpenContext}
          className="flex items-center gap-1.5 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
        >
          <History className="w-3.5 h-3.5 text-amber-500/70" />
          <span>Контекст ({settings.contextBudget / 1024}K)</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
        >
          <Sliders className="w-3.5 h-3.5 text-amber-500/70" />
          <span>Настройки ИИ</span>
        </button>
      </nav>

      {/* Zone 3: Primary Action & Status */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Compact buttons on mobile */}
        <div className="flex lg:hidden items-center gap-1">
          <button
            onClick={onOpenCampaigns}
            title="Приключения"
            className="p-1.5 rounded-md hover:bg-stone-800 text-stone-300"
          >
            <Compass className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenCharacters}
            title="Персонажи"
            className="p-1.5 rounded-md hover:bg-stone-800 text-stone-300"
          >
            <User className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenLorebook}
            title="База знаний"
            className="p-1.5 rounded-md hover:bg-stone-800 text-stone-300"
          >
            <Database className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenSettings}
            title="Настройки"
            className="p-1.5 rounded-md hover:bg-stone-800 text-stone-300"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={onOpenDice}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-stone-900 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 rounded-md transition-colors shadow-sm shadow-amber-950/40 whitespace-nowrap shrink-0"
        >
          <Dice6 className="w-4 h-4" />
          <span>Бросить кубик d20</span>
        </button>
      </div>
    </header>
  );
};
