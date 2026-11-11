import React, { useState } from 'react';
import { X, Cpu, Layers, Pin, Eye, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { ContextBreakdown, Campaign } from './dnd';

interface ContextInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign;
  contextBreakdown: ContextBreakdown;
  onUpdatePinnedFacts: (facts: string[]) => void;
}

export const ContextInspectorModal: React.FC<ContextInspectorModalProps> = ({
  isOpen,
  onClose,
  campaign,
  contextBreakdown,
  onUpdatePinnedFacts,
}) => {
  const [activeTab, setActiveTab] = useState<'gauge' | 'raw' | 'pinned'>('gauge');
  const [newPinnedFact, setNewPinnedFact] = useState('');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const {
    systemTokens,
    loreTokens,
    summaryTokens,
    chatTokens,
    totalTokens,
    maxBudget,
    activeEntities,
    rawPromptPreview,
  } = contextBreakdown;

  const usagePercent = Math.min(100, Math.round((totalTokens / maxBudget) * 100));

  const handleAddPinned = () => {
    if (!newPinnedFact.trim()) return;
    onUpdatePinnedFacts([...campaign.pinnedFacts, newPinnedFact.trim()]);
    setNewPinnedFact('');
  };

  const handleRemovePinned = (index: number) => {
    onUpdatePinnedFacts(campaign.pinnedFacts.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-stone-900 border border-stone-800 rounded-xl shadow-2xl flex flex-col text-stone-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/80">
          <div className="flex items-center gap-3">
            <Cpu className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold font-fantasy text-amber-200">
                Инспектор контекста & Управление памятью
              </h2>
              <p className="text-xs text-stone-400">
                Бюджет токенов: {totalTokens} / {maxBudget} ({usagePercent}%)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-200 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-stone-800 bg-stone-950/40 text-xs">
          <button
            onClick={() => setActiveTab('gauge')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'gauge'
                ? 'bg-stone-800 text-amber-300 border border-amber-600/40'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Распределение токенов</span>
          </button>

          <button
            onClick={() => setActiveTab('pinned')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'pinned'
                ? 'bg-stone-800 text-amber-300 border border-amber-600/40'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
            <span>Неприкосновенная память ({campaign.pinnedFacts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'raw'
                ? 'bg-stone-800 text-amber-300 border border-amber-600/40'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Сырой системный промпт</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'gauge' && (
            <div className="space-y-6">
              {/* Progress Bar Gauge */}
              <div className="p-4 rounded-xl bg-stone-950/80 border border-stone-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-stone-300 font-sans font-semibold">Использование контекстного окна:</span>
                  <span className="text-amber-300 font-bold">{totalTokens} / {maxBudget} токенов ({usagePercent}%)</span>
                </div>

                {/* Multi-segment Progress Bar */}
                <div className="w-full h-4 rounded-full bg-stone-900 overflow-hidden flex border border-stone-800">
                  <div
                    style={{ width: `${Math.min(100, (systemTokens / maxBudget) * 100)}%` }}
                    className="bg-amber-600 h-full"
                    title={`Системный промпт и правила D&D: ${systemTokens} токенов`}
                  />
                  <div
                    style={{ width: `${Math.min(100, (loreTokens / maxBudget) * 100)}%` }}
                    className="bg-cyan-600 h-full"
                    title={`Активные карточки Базы знаний: ${loreTokens} токенов`}
                  />
                  <div
                    style={{ width: `${Math.min(100, (summaryTokens / maxBudget) * 100)}%` }}
                    className="bg-purple-600 h-full"
                    title={`Хроники и закрепленные факты: ${summaryTokens} токенов`}
                  />
                  <div
                    style={{ width: `${Math.min(100, (chatTokens / maxBudget) * 100)}%` }}
                    className="bg-emerald-600 h-full"
                    title={`История диалога чата: ${chatTokens} токенов`}
                  />
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-amber-600" />
                    <span className="text-stone-300">Правила & Роль ({systemTokens})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-cyan-600" />
                    <span className="text-stone-300">База знаний ({loreTokens})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-purple-600" />
                    <span className="text-stone-300">Хроники ({summaryTokens})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-emerald-600" />
                    <span className="text-stone-300">Диалог чата ({chatTokens})</span>
                  </div>
                </div>

                {usagePercent >= 80 && (
                  <div className="p-2.5 rounded bg-amber-950/40 border border-amber-600/40 text-xs text-amber-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Контекст близок к лимиту! Рекомендуется выполнить сжатие истории (Хроники) для сохранения памяти слабых GPU.
                    </span>
                  </div>
                )}
              </div>

              {/* Two-tier Memory Architecture: Hot Prompt vs Cold Database */}
              <div className="space-y-4">
                {/* Hot Entities */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                        Горячая память сцены (Загружено в ИИ: {activeEntities.length})
                      </h3>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-600/40 text-emerald-300 font-mono">
                      Подтянуто триггерами / локацией
                    </span>
                  </div>

                  {activeEntities.length === 0 ? (
                    <div className="p-3 rounded-lg bg-stone-950/60 border border-stone-800 text-xs text-stone-400 text-center">
                      Нет активных сущностей лора в текущий момент. Они подключаются автоматически при упоминании ключевых слов.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {activeEntities.map((entity) => (
                        <div
                          key={entity.id}
                          className="p-2.5 rounded-lg bg-stone-950 border border-emerald-900/50 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-300">{entity.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-300 font-mono">
                              {entity.type} · {entity.activationMode}
                            </span>
                          </div>
                          <p className="text-stone-300 text-[11px] line-clamp-2">{entity.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cold Database Archive */}
                <div className="space-y-2 pt-2 border-t border-stone-800/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                        Холодная база данных (Архив мира в БД: {contextBreakdown.coldEntities?.length || 0})
                      </h3>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-600/40 text-cyan-300 font-mono">
                      НЕ загружается в промпт · Экономия токенов
                    </span>
                  </div>

                  {(!contextBreakdown.coldEntities || contextBreakdown.coldEntities.length === 0) ? (
                    <div className="p-3 rounded-lg bg-stone-950/40 border border-stone-800 text-xs text-stone-500 text-center">
                      Все сущности мира в данный момент либо активны, либо база пуста.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {contextBreakdown.coldEntities.map((entity) => (
                        <div
                          key={entity.id}
                          className="p-2 rounded-lg bg-stone-950/60 border border-stone-800/80 text-xs opacity-80"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-stone-300">{entity.name}</span>
                            <span className="text-[9px] text-stone-400 font-mono">[{entity.type}]</span>
                          </div>
                          <p className="text-stone-400 text-[10px] truncate mt-0.5">{entity.summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pinned' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 text-xs text-stone-300 leading-relaxed">
                <div className="font-bold text-purple-300 mb-1 flex items-center gap-1.5">
                  <Pin className="w-4 h-4 text-purple-400" />
                  <span>Неприкосновенная память (Permanent World Truths)</span>
                </div>
                Факты из этого списка никогда не будут стерты или сокращены алгоритмом сжатия истории. Используйте этот блок для ключевых клятв, проклятий, непреложных законов и тайн сюжета.
              </div>

              {/* Add pinned fact */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Добавить непреложный факт мира или персонажей..."
                  value={newPinnedFact}
                  onChange={(e) => setNewPinnedFact(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPinned()}
                  className="flex-1 px-3 py-2 text-xs rounded-lg bg-stone-950 border border-stone-700 text-stone-100 placeholder:text-stone-400"
                />
                <button
                  onClick={handleAddPinned}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Закрепить</span>
                </button>
              </div>

              {/* Pinned facts list */}
              <div className="space-y-2">
                {campaign.pinnedFacts.map((fact, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-stone-950 border border-stone-800 text-xs text-stone-200"
                  >
                    <div className="flex items-center gap-2">
                      <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{fact}</span>
                    </div>
                    <button
                      onClick={() => handleRemovePinned(index)}
                      className="p-1 text-stone-400 hover:text-rose-400 transition-colors"
                      title="Удалить из закрепленных"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'raw' && (
            <div className="space-y-2">
              <div className="text-xs text-stone-400">
                Полный системный текст, передаваемый нейросети перед сообщениями чата:
              </div>
              <pre className="p-4 rounded-xl bg-stone-950 border border-stone-800 font-mono text-[11px] text-stone-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {rawPromptPreview}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
