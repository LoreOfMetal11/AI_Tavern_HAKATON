import React, { useState } from 'react';
import { X, Sliders, Server, Cpu, Sparkles, Shield, Download, Upload, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { ModelSettings, LLMProvider, RuleEdition, Campaign } from './dnd';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ModelSettings;
  campaign: Campaign;
  onUpdateSettings: (settings: ModelSettings) => void;
  onUpdateCampaign: (campaign: Campaign) => void;
  onExportCampaign: () => void;
  onImportCampaign: (jsonString: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  campaign,
  onUpdateSettings,
  onUpdateCampaign,
  onExportCampaign,
  onImportCampaign,
}) => {
  const [activeTab, setActiveTab] = useState<'connection' | 'generation' | 'rules' | 'backup'>('connection');
  const [testStatus, setTestStatus] = useState<{ status: 'idle' | 'testing' | 'success' | 'error'; message?: string }>({
    status: 'idle',
  });

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleApplyPreset = (provider: LLMProvider) => {
    if (provider === 'lmstudio') {
      onUpdateSettings({
        ...settings,
        provider: 'lmstudio',
        endpointUrl: 'http://localhost:1234/v1',
        modelName: 'local-model',
        contextBudget: 4096,
        optimizeEnglishTokens: false,
      });
    } else if (provider === 'ollama') {
      onUpdateSettings({
        ...settings,
        provider: 'ollama',
        endpointUrl: 'http://localhost:11434/v1',
        modelName: 'llama3:8b',
        contextBudget: 4096,
        optimizeEnglishTokens: false,
      });
    } else if (provider === 'gemini') {
      onUpdateSettings({
        ...settings,
        provider: 'gemini',
        endpointUrl: '/api/gemini/chat',
        modelName: 'gemini-3.8-flash',
        contextBudget: 8192,
      });
    } else if (provider === 'simulator') {
      onUpdateSettings({
        ...settings,
        provider: 'simulator',
        endpointUrl: '',
        modelName: 'dnd-master-simulator',
      });
    }
    setTestStatus({ status: 'idle' });
  };

  const handleTestConnection = async () => {
    setTestStatus({ status: 'testing', message: 'Проверка связи с нейросетью...' });

    if (settings.provider === 'simulator') {
      setTimeout(() => {
        setTestStatus({ status: 'success', message: 'Встроенный D&D 5e ИИ-симулятор активен и готов к игре.' });
      }, 300);
      return;
    }

    try {
      if (settings.provider === 'gemini') {
        const res = await fetch('/api/gemini/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: settings.apiKey || undefined,
            model: settings.modelName || 'gemini-2.5-flash',
            systemInstruction: 'Ответь словом ГОТОВ',
            contents: [{ role: 'user', content: 'Тест связи' }],
            maxOutputTokens: 20,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        setTestStatus({ status: 'success', message: 'Успешное подключение к Gemini Cloud API!' });
      } else {
        // Test local or custom OpenAI endpoint via backend proxy
        const targetUrl = settings.endpointUrl || 'http://localhost:1234/v1';
        const pingUrl = targetUrl.endsWith('/models')
          ? targetUrl
          : `${targetUrl.replace(/\/+$/, '')}/models`;

        const res = await fetch('/api/proxy/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUrl: pingUrl,
            headers: settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {},
            body: {},
          }),
        });

        if (!res.ok) {
          throw new Error(`Сервер ответил HTTP ${res.status}`);
        }
        setTestStatus({ status: 'success', message: `Связь с ${settings.provider.toUpperCase()} успешно установлена!` });
      }
    } catch (e: any) {
      setTestStatus({
        status: 'error',
        message: `Не удалось связаться: ${e?.message || 'Сервер не запущен'}. (Вы можете переключиться на режим «ИИ-Симулятор DM» для игры без настроек)`,
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onImportCampaign(content);
        onClose();
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-stone-900 border border-stone-800 rounded-xl shadow-2xl flex flex-col text-stone-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/80">
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold font-fantasy text-amber-200">
                Настройки нейросети & Мастерской D&D
              </h2>
              <p className="text-xs text-stone-400">
                Конфигурация LM Studio, Ollama, облачных моделей, токенов и правил игры
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

        {/* Tab Strip */}
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-stone-800 bg-stone-950/40 text-xs">
          <button
            onClick={() => setActiveTab('connection')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'connection'
                ? 'bg-stone-800 text-amber-300 border border-amber-600/40'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Подключение и провайдер</span>
          </button>

          <button
            onClick={() => setActiveTab('generation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'generation'
                ? 'bg-stone-800 text-amber-300 border border-amber-600/40'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Параметры & Контекст 4K</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'rules'
                ? 'bg-stone-800 text-amber-300 border border-amber-600/40'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Редакция правил D&D 5e</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'backup'
                ? 'bg-stone-800 text-amber-300 border border-amber-600/40'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Экспорт & Импорт кампании</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'connection' && (
            <div className="space-y-6">
              {/* Quick Presets */}
              <div className="p-4 rounded-xl bg-stone-950/80 border border-stone-800 space-y-2">
                <span className="text-xs font-semibold text-stone-300 uppercase tracking-wider block">
                  Быстрые пресеты в 1 клик:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => handleApplyPreset('lmstudio')}
                    className={`p-2.5 rounded-lg border text-xs text-left transition-all ${
                      settings.provider === 'lmstudio'
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                        : 'bg-stone-900 border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <div className="font-bold">LM Studio</div>
                    <div className="text-[10px] text-stone-400 font-mono mt-0.5">localhost:1234</div>
                  </button>

                  <button
                    onClick={() => handleApplyPreset('ollama')}
                    className={`p-2.5 rounded-lg border text-xs text-left transition-all ${
                      settings.provider === 'ollama'
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                        : 'bg-stone-900 border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <div className="font-bold">Ollama</div>
                    <div className="text-[10px] text-stone-400 font-mono mt-0.5">localhost:11434</div>
                  </button>

                  <button
                    onClick={() => handleApplyPreset('gemini')}
                    className={`p-2.5 rounded-lg border text-xs text-left transition-all ${
                      settings.provider === 'gemini'
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                        : 'bg-stone-900 border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <div className="font-bold">Gemini Cloud</div>
                    <div className="text-[10px] text-stone-400 mt-0.5">Встроенный сервер</div>
                  </button>

                  <button
                    onClick={() => handleApplyPreset('simulator')}
                    className={`p-2.5 rounded-lg border text-xs text-left transition-all ${
                      settings.provider === 'simulator'
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                        : 'bg-stone-900 border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <div className="font-bold">ИИ-Симулятор DM</div>
                    <div className="text-[10px] text-stone-400 mt-0.5">Офлайн без API</div>
                  </button>
                </div>
              </div>

              {/* Connection Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-stone-400 block mb-1">Провайдер модели</label>
                  <select
                    value={settings.provider}
                    onChange={(e) => onUpdateSettings({ ...settings, provider: e.target.value as LLMProvider })}
                    className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100"
                  >
                    <option value="gemini">Google Gemini (Встроенный прокси / Ключ)</option>
                    <option value="lmstudio">LM Studio (Локальный сервер OpenAI-совместимый)</option>
                    <option value="ollama">Ollama (Локальный API)</option>
                    <option value="openai">OpenAI (ChatGPT API)</option>
                    <option value="openrouter">OpenRouter API</option>
                    <option value="custom">Пользовательский URL / Прокси</option>
                    <option value="simulator">Встроенный ИИ-симулятор (Без ключей и серверов)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-stone-400 block mb-1">Имя модели (Model Identifier)</label>
                  <input
                    type="text"
                    value={settings.modelName}
                    onChange={(e) => onUpdateSettings({ ...settings, modelName: e.target.value })}
                    placeholder="gemini-2.5-flash / llama3 / mistral"
                    className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 font-mono"
                  />
                </div>
              </div>

              {settings.provider !== 'simulator' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-stone-400 block mb-1">
                      Адрес сервера (Endpoint URL)
                    </label>
                    <input
                      type="text"
                      value={settings.endpointUrl}
                      onChange={(e) => onUpdateSettings({ ...settings, endpointUrl: e.target.value })}
                      placeholder="http://localhost:1234/v1"
                      className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-stone-400 block mb-1">
                      API-ключ (Опционально для LM Studio/Ollama)
                    </label>
                    <input
                      type="password"
                      value={settings.apiKey}
                      onChange={(e) => onUpdateSettings({ ...settings, apiKey: e.target.value })}
                      placeholder="По умолчанию используется серверный ключ"
                      className="w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Multi-Model Task Assignment */}
              <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800 space-y-3">
                <span className="text-xs font-semibold text-stone-300 uppercase tracking-wider block">
                  Разделение моделей по ролям (Опционально):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-stone-400 block mb-1">Мастер повествования (DM):</label>
                    <input
                      type="text"
                      value={settings.auxModels.gm}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          auxModels: { ...settings.auxModels, gm: e.target.value },
                        })
                      }
                      className="w-full bg-stone-900 border border-stone-800 rounded px-2.5 py-1 text-stone-200 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-stone-400 block mb-1">Анализатор логики & триггеров:</label>
                    <input
                      type="text"
                      value={settings.auxModels.entityAnalyzer}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          auxModels: { ...settings.auxModels, entityAnalyzer: e.target.value },
                        })
                      }
                      className="w-full bg-stone-900 border border-stone-800 rounded px-2.5 py-1 text-stone-200 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-stone-400 block mb-1">Сжатие памяти (Summarizer):</label>
                    <input
                      type="text"
                      value={settings.auxModels.summarizer}
                      onChange={(e) =>
                        onUpdateSettings({
                          ...settings,
                          auxModels: { ...settings.auxModels, summarizer: e.target.value },
                        })
                      }
                      className="w-full bg-stone-900 border border-stone-800 rounded px-2.5 py-1 text-stone-200 font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* Test Button & Status */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleTestConnection}
                  disabled={testStatus.status === 'testing'}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {testStatus.status === 'testing' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>Проверить соединение</span>
                </button>

                {testStatus.status === 'success' && (
                  <div className="text-xs text-emerald-400 flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    <span>{testStatus.message}</span>
                  </div>
                )}

                {testStatus.status === 'error' && (
                  <div className="text-xs text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{testStatus.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'generation' && (
            <div className="space-y-6">
              {/* Context Budget Selector */}
              <div className="p-4 rounded-xl bg-stone-950/80 border border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-200 uppercase tracking-wider">
                    Размер контекстного окна (Context Window)
                  </label>
                  <span className="font-mono text-amber-300 text-sm font-bold">
                    {settings.contextBudget} токенов ({settings.contextBudget / 1024}K)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {[4096, 8192, 16384, 32768].map((budget) => (
                    <button
                      key={budget}
                      onClick={() => onUpdateSettings({ ...settings, contextBudget: budget })}
                      className={`flex-1 py-2 text-xs font-mono font-bold rounded-lg border transition-all ${
                        settings.contextBudget === budget
                          ? 'bg-amber-600 text-stone-950 border-amber-500'
                          : 'bg-stone-900 text-stone-300 border-stone-800 hover:border-stone-700'
                      }`}
                    >
                      {budget / 1024}K {budget === 4096 ? '(Для слабых GPU)' : ''}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-stone-400">
                  Режим 4K оптимизирует промпты, сжимает диалог и подключает сущности базы знаний только по строгим триггерам, предотвращая переполнение памяти на легких локальных видеокартах.
                </p>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between text-xs text-stone-300 mb-1">
                    <span>Температура (Креативность):</span>
                    <span className="font-mono text-amber-300">{settings.temperature}</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1.5}
                    step={0.05}
                    value={settings.temperature}
                    onChange={(e) => onUpdateSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 bg-stone-800"
                  />
                  <span className="text-[10px] text-stone-400">0.7 - канон и правила, 1.1 - высокое воображение</span>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-stone-300 mb-1">
                    <span>Максимум токенов ответа:</span>
                    <span className="font-mono text-amber-300">{settings.maxTokens}</span>
                  </div>
                  <input
                    type="range"
                    min={256}
                    max={2048}
                    step={64}
                    value={settings.maxTokens}
                    onChange={(e) => onUpdateSettings({ ...settings, maxTokens: parseInt(e.target.value, 10) })}
                    className="w-full accent-amber-500 bg-stone-800"
                  />
                  <span className="text-[10px] text-stone-400">Длина реплики мастера (рекомендуется 768 - 1024)</span>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-stone-300 mb-1">
                    <span>Штраф за повторы (Repetition Penalty):</span>
                    <span className="font-mono text-amber-300">{settings.repetitionPenalty}</span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={1.5}
                    step={0.02}
                    value={settings.repetitionPenalty}
                    onChange={(e) => onUpdateSettings({ ...settings, repetitionPenalty: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 bg-stone-800"
                  />
                  <span className="text-[10px] text-stone-400">Предотвращает зацикливание фраз</span>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-stone-300 mb-1">
                    <span>Симулируемая задержка ответов (мс):</span>
                    <span className="font-mono text-amber-300">{settings.simulatedDelayMs} мс</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2000}
                    step={100}
                    value={settings.simulatedDelayMs}
                    onChange={(e) => onUpdateSettings({ ...settings, simulatedDelayMs: parseInt(e.target.value, 10) })}
                    className="w-full accent-amber-500 bg-stone-800"
                  />
                  <span className="text-[10px] text-stone-400">Для естественного темпа настольной игры</span>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2.5 text-xs text-stone-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.thinkingMode}
                    onChange={(e) => onUpdateSettings({ ...settings, thinkingMode: e.target.checked })}
                    className="rounded border-stone-700 bg-stone-900 text-amber-500"
                  />
                  <span>
                    <strong>Режим размышления (Thinking / CoT):</strong> ИИ обдумывает драматизм, скрытые триггеры и спасброски в блоке &lt;think&gt;
                  </span>
                </label>

                {settings.thinkingMode && (
                  <div className="p-3 rounded-lg bg-stone-950/80 border border-amber-950/80 space-y-2 ml-6 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-300">
                        Глубина размышлений мастера (&lt;think&gt; Reasoning Effort):
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        {settings.reasoningEffort === 'concise' ? 'Кратко' : settings.reasoningEffort === 'deep' ? 'Глубокий анализ' : 'Стандарт D&D 5e'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, reasoningEffort: 'concise' })}
                        className={`p-2 rounded-lg border text-left text-xs transition-all ${
                          settings.reasoningEffort === 'concise'
                            ? 'bg-amber-950/50 border-amber-500 text-amber-200 font-bold'
                            : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        <div className="font-bold">Краткий</div>
                        <div className="text-[10px] text-stone-400 mt-0.5">1-2 тактических вывода</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, reasoningEffort: 'standard' })}
                        className={`p-2 rounded-lg border text-left text-xs transition-all ${
                          settings.reasoningEffort === 'standard' || !settings.reasoningEffort
                            ? 'bg-amber-950/50 border-amber-500 text-amber-200 font-bold'
                            : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        <div className="font-bold">Стандарт 5e</div>
                        <div className="text-[10px] text-stone-400 mt-0.5">Правила, DC и мотивы</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, reasoningEffort: 'deep' })}
                        className={`p-2 rounded-lg border text-left text-xs transition-all ${
                          settings.reasoningEffort === 'deep'
                            ? 'bg-amber-950/50 border-amber-500 text-amber-200 font-bold'
                            : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        <div className="font-bold text-amber-300">Глубокий</div>
                        <div className="text-[10px] text-stone-400 mt-0.5">Детальная проработка & БД</div>
                      </button>
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2.5 text-xs text-stone-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.strictNoPlayerImpersonation}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, strictNoPlayerImpersonation: e.target.checked })
                    }
                    className="rounded border-stone-700 bg-stone-900 text-amber-500"
                  />
                  <span>
                    <strong>Строгий запрет отыгрыша за игроков:</strong> ИИ не имеет права говорить, решать или действовать за персонажей игроков
                  </span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-stone-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.optimizeEnglishTokens}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, optimizeEnglishTokens: e.target.checked })
                    }
                    className="rounded border-stone-700 bg-stone-900 text-amber-500"
                  />
                  <span>
                    <strong>Dual-language токенизация:</strong> Внутренние системные инструкции сжимаются латинскими маркерами (экономит ~40% токенов для 4K), при этом весь нарратив выводится на чистом русском
                  </span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-stone-950/80 border border-stone-800 space-y-3">
                <span className="text-xs font-bold text-stone-200 uppercase tracking-wider block">
                  Редакция правил Dungeons & Dragons
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: '5e-srd', label: 'D&D 5-я редакция (SRD)', desc: 'Классические правила 2014 г. с проверками характеристик и DC' },
                    { id: '2024-revised', label: 'D&D 2024 (5.5e)', desc: 'Обновленная редакция с новыми оружейными свойствами' },
                    { id: '3.5e-classic', label: 'D&D 3.5e Классика', desc: 'Углубленная математическая система модификаторов' },
                  ].map((ed) => (
                    <button
                      key={ed.id}
                      onClick={() => onUpdateCampaign({ ...campaign, edition: ed.id as RuleEdition })}
                      className={`p-3 rounded-lg border text-left text-xs transition-all ${
                        campaign.edition === ed.id
                          ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                          : 'bg-stone-900 border-stone-800 text-stone-300 hover:border-stone-700'
                      }`}
                    >
                      <div className="font-bold">{ed.label}</div>
                      <div className="text-[11px] text-stone-400 mt-1">{ed.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-stone-300 block mb-1">
                  Пользовательские домашние правила (House Rules / Особенности мира):
                </label>
                <textarea
                  rows={4}
                  value={campaign.customRulesText || ''}
                  onChange={(e) => onUpdateCampaign({ ...campaign, customRulesText: e.target.value })}
                  placeholder="Например: Правило жестокого реализма: короткий отдых длится 8 часов, длинный — 7 дней..."
                  className="w-full bg-stone-950 border border-stone-700 rounded-lg p-3 text-xs text-stone-200"
                />
              </div>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-stone-950/80 border border-stone-800 space-y-3">
                <span className="text-xs font-bold text-stone-200 uppercase tracking-wider block">
                  Резервное копирование и перенос кампании
                </span>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Вы можете сохранить всю вселенную (персонажей, хроники, базу знаний и историю диалогов) в один JSON-файл и перенести на другой компьютер или загрузить в любой момент.
                </p>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={onExportCampaign}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Скачать кампанию (JSON)</span>
                  </button>

                  <label className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 text-amber-400" />
                    <span>Загрузить из файла JSON</span>
                    <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
