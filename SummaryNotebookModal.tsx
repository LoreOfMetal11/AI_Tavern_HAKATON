import React, { useState } from 'react';
import { X, BookOpen, Plus, Trash2, Edit2, Check, Sparkles, Sliders } from 'lucide-react';
import { Campaign, CampaignHistoryEntry, ModelSettings } from './dnd';

interface SummaryNotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign;
  settings: ModelSettings;
  onUpdateChronicles: (chronicles: CampaignHistoryEntry[]) => void;
  onUpdateSettings: (settings: ModelSettings) => void;
  onTriggerManualSummarize: () => void;
}

export const SummaryNotebookModal: React.FC<SummaryNotebookModalProps> = ({
  isOpen,
  onClose,
  campaign,
  settings,
  onUpdateChronicles,
  onUpdateSettings,
  onTriggerManualSummarize,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleStartEdit = (entry: CampaignHistoryEntry) => {
    setEditingId(entry.id);
    setEditTitle(entry.title);
    setEditSummary(entry.summary);
  };

  const handleSaveEdit = (id: string) => {
    const updated = campaign.historyChronicles.map((c) =>
      c.id === id ? { ...c, title: editTitle, summary: editSummary } : c
    );
    onUpdateChronicles(updated);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    onUpdateChronicles(campaign.historyChronicles.filter((c) => c.id !== id));
  };

  const handleAddNew = () => {
    if (!newTitle.trim() || !newSummary.trim()) return;
    const entry: CampaignHistoryEntry = {
      id: `hist-${Date.now()}`,
      title: newTitle.trim(),
      summary: newSummary.trim(),
      timestamp: Date.now(),
      keyEvents: [],
      charactersInvolved: [],
    };
    onUpdateChronicles([...campaign.historyChronicles, entry]);
    setIsAddingNew(false);
    setNewTitle('');
    setNewSummary('');
  };

  const togglePreserveDirective = (directive: string) => {
    const exists = settings.compressionPreserveDirectives.includes(directive);
    const updated = exists
      ? settings.compressionPreserveDirectives.filter((d) => d !== directive)
      : [...settings.compressionPreserveDirectives, directive];
    onUpdateSettings({ ...settings, compressionPreserveDirectives: updated });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-stone-900 border border-stone-800 rounded-xl shadow-2xl flex flex-col text-stone-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/80">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold font-fantasy text-amber-200">
                Хроники кампании & Блокнот истории
              </h2>
              <p className="text-xs text-stone-400">
                Сжатый сюжетный архив: позволяет ИИ помнить недели походов даже в окне 4К токенов
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onTriggerManualSummarize}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-600/40 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Сжать последние ходы</span>
            </button>
            <button
              onClick={() => setIsAddingNew(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-amber-600 hover:bg-amber-500 text-stone-950 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Новая глава</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-stone-400 hover:text-stone-200 rounded-lg hover:bg-stone-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Settings Bar for Compression */}
        <div className="p-4 border-b border-stone-800 bg-stone-950/40 text-xs space-y-3">
          <div className="flex items-center gap-2 text-stone-300 font-semibold">
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>Настройки системы сокращения истории (Summarization Engine)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-stone-400 block mb-1">
                Порог авто-сжатия: каждые {settings.summarizeThresholdTurns} ходов диалога
              </label>
              <input
                type="range"
                min={4}
                max={16}
                step={2}
                value={settings.summarizeThresholdTurns}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    summarizeThresholdTurns: parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-amber-500 bg-stone-800"
              />
            </div>

            <div>
              <span className="text-stone-400 block mb-1.5">Что обязательно сохранять при сжатии:</span>
              <div className="flex flex-wrap gap-2">
                {[
                  'Травмы и ранения',
                  'Полученные предметы',
                  'Отношения с NPC',
                  'Статус квестов',
                  'Погибшие враги',
                ].map((crit) => {
                  const active = settings.compressionPreserveDirectives.includes(crit);
                  return (
                    <button
                      key={crit}
                      onClick={() => togglePreserveDirective(crit)}
                      className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                        active
                          ? 'bg-amber-950/60 border-amber-600/60 text-amber-300'
                          : 'bg-stone-900 border-stone-800 text-stone-400'
                      }`}
                    >
                      {crit}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Add form */}
          {isAddingNew && (
            <div className="p-4 rounded-xl bg-stone-950 border border-amber-600/40 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Новая сюжетная запись в хронику
                </span>
                <button
                  onClick={() => setIsAddingNew(false)}
                  className="text-stone-400 hover:text-stone-200 text-xs"
                >
                  Отмена
                </button>
              </div>

              <div>
                <label className="text-[11px] text-stone-400 block mb-1">Название главы / события</label>
                <input
                  type="text"
                  placeholder="Например: Битва на перевале Штормов"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs rounded bg-stone-900 border border-stone-700 text-stone-200"
                />
              </div>

              <div>
                <label className="text-[11px] text-stone-400 block mb-1">
                  Сжатое содержание (факты, итоги, решения отряда)
                </label>
                <textarea
                  rows={3}
                  placeholder="Опишите, к чему привели действия отряда..."
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs rounded bg-stone-900 border border-stone-700 text-stone-200"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleAddNew}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950"
                >
                  Добавить в хронику
                </button>
              </div>
            </div>
          )}

          {/* List of Chronicles */}
          {campaign.historyChronicles.length === 0 ? (
            <div className="p-12 text-center text-stone-400 text-xs">
              Хроники пока пусты. По мере диалога с Мастером старые сообщения будут аккуратно сжиматься сюда, либо вы можете добавить запись вручную.
            </div>
          ) : (
            campaign.historyChronicles.map((entry) => {
              const isEditing = editingId === entry.id;

              return (
                <div
                  key={entry.id}
                  className="p-4 rounded-xl bg-stone-950/70 border border-stone-800 space-y-2 hover:border-stone-700 transition-colors"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-2 py-1 text-xs font-bold rounded bg-stone-900 border border-stone-700 text-amber-200"
                      />
                      <textarea
                        rows={3}
                        value={editSummary}
                        onChange={(e) => setEditSummary(e.target.value)}
                        className="w-full px-2 py-1 text-xs rounded bg-stone-900 border border-stone-700 text-stone-200"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 text-xs rounded bg-stone-800 text-stone-300"
                        >
                          Отмена
                        </button>
                        <button
                          onClick={() => handleSaveEdit(entry.id)}
                          className="px-3 py-1 text-xs font-semibold rounded bg-amber-600 text-stone-950 flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Сохранить</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between pb-1 border-b border-stone-800/60">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-amber-100 font-fantasy">{entry.title}</h3>
                          <span className="text-[10px] text-stone-400 font-mono">
                            {new Date(entry.timestamp).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(entry)}
                            className="p-1 text-stone-400 hover:text-amber-300"
                            title="Редактировать"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="p-1 text-stone-400 hover:text-rose-400"
                            title="Удалить"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-stone-300 leading-relaxed pt-2">{entry.summary}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
