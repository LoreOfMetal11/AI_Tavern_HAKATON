import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_CAMPAIGNS, INITIAL_CHARACTERS, INITIAL_LORE_ENTITIES, INITIAL_MESSAGES, DEFAULT_MODEL_SETTINGS } from './defaultCampaigns';
import { Campaign, Character, LoreEntity, ChatMessage, ModelSettings, CheckRequest, CampaignHistoryEntry, DmMood, PendingActionCheck } from './dnd';
import { generateDmTurn, inspectContextWindow } from './dmTurnService';
import { applyDamage, prepareDamage, hasDamage, makeId } from './turnMechanics.mjs';
import { Header } from './Header';
import { PartySidebar } from './PartySidebar';
import { ChatArea } from './ChatArea';
import { DiceModal } from './DiceModal';
import { CharacterSheetModal } from './CharacterSheetModal';
import { LorebookModal } from './LorebookModal';
import { ContextInspectorModal } from './ContextInspectorModal';
import { SummaryNotebookModal } from './SummaryNotebookModal';
import { SettingsModal } from './SettingsModal';
import { CampaignManagerModal } from './CampaignManagerModal';

type TurnSlot = Campaign['activePlayerSlot'];
type StoredMessage = ChatMessage & { damageEvents?: ReturnType<typeof prepareDamage> };
function readSaved<T>(key: string, fallback: T): T {
  try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) ?? fallback : fallback; } catch { return fallback; }
}
function readDefaultList<T extends { id: string }>(key: string, defaults: T[]): T[] {
  const parsed = readSaved<T[]>(key, defaults);
  if (!Array.isArray(parsed) || parsed.length === 0) return defaults;
  const ids = new Set(parsed.map((item) => item.id));
  return [...parsed, ...defaults.filter((item) => !ids.has(item.id))];
}

export default function App() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => readDefaultList('mythictavern_campaigns', INITIAL_CAMPAIGNS).map((c) => ({ ...c, dmMood: c.dmMood || 'neutral' })));
  const [activeCampaignId, setActiveCampaignId] = useState(() => campaigns[0]?.id || 'camp-1');
  const [characters, setCharacters] = useState<Character[]>(() => readDefaultList('mythictavern_characters', INITIAL_CHARACTERS));
  const [loreEntities, setLoreEntities] = useState<LoreEntity[]>(() => readDefaultList('mythictavern_lore', INITIAL_LORE_ENTITIES));
  const [messagesMap, setMessagesMap] = useState<Record<string, StoredMessage[]>>(() => ({ ...INITIAL_MESSAGES, ...readSaved<Record<string, StoredMessage[]>>('mythictavern_messages', {}) }));
  const [settings, setSettings] = useState<ModelSettings>(() => ({ ...DEFAULT_MODEL_SETTINGS, ...readSaved<Partial<ModelSettings>>('mythictavern_settings', {}) }));
  const [activeSlot, setActiveSlot] = useState<'A' | 'B' | 'SIMULTANEOUS'>('A');
  const [activeCheck, setActiveCheck] = useState<CheckRequest | null>(null);
  const [pendingActionCheck, setPendingActionCheck] = useState<PendingActionCheck | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [turnError, setTurnError] = useState<string | null>(null);
  const turnInFlight = useRef(false);
  const visibleCampaign = useRef(activeCampaignId);
  visibleCampaign.current = activeCampaignId;
  const appliedThisSession = useRef(new Set<string>());
  const [isDiceOpen, setIsDiceOpen] = useState(false);
  const [isCharSheetOpen, setIsCharSheetOpen] = useState(false);
  const [isLorebookOpen, setIsLorebookOpen] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCampaignManagerOpen, setIsCampaignManagerOpen] = useState(false);

  useEffect(() => { localStorage.setItem('mythictavern_campaigns', JSON.stringify(campaigns)); }, [campaigns]);
  useEffect(() => { localStorage.setItem('mythictavern_characters', JSON.stringify(characters)); }, [characters]);
  useEffect(() => { localStorage.setItem('mythictavern_lore', JSON.stringify(loreEntities)); }, [loreEntities]);
  useEffect(() => { localStorage.setItem('mythictavern_messages', JSON.stringify(messagesMap)); }, [messagesMap]);
  useEffect(() => { localStorage.setItem('mythictavern_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { setPendingActionCheck(null); setActiveCheck(null); setIsDiceOpen(false); setTurnError(null); }, [activeCampaignId]);

  const fallbackHero: Character = {
    id: 'temp-hero', name: 'Безымянный герой', title: 'Искатель приключений', isPlayer: true, playerSlot: 'A',
    race: 'Человек', class: 'Воин', subclass: 'Защитник', level: 1, hpCurrent: 10, hpMax: 10, ac: 10, speed: 30,
    stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }, profBonus: 2, skills: {},
    savingThrows: { STR: true, DEX: false, CON: true, INT: false, WIS: false, CHA: false },
    avatar: new URL('./hero_dwarf_paladin_1793967564468.jpg', import.meta.url).href, inventory: [], gold: 10,
    alignment: 'Нейтральный', backstory: 'Начинающий искатель приключений.', personalityTraits: 'Решительный и осторожный.', notes: '',
  };
  const currentCampaign = campaigns.find((c) => c.id === activeCampaignId) || campaigns[0];
  const currentMessages = messagesMap[activeCampaignId] || [];
  const currentLore = loreEntities.filter((e) => e.campaignId === activeCampaignId);
  const currentCharacters = characters.filter((c) => currentCampaign.isCleanSession ? c.campaignId === activeCampaignId
    : (c.campaignId === activeCampaignId || currentCampaign.characterIds?.includes(c.id) || (!currentCampaign.characterIds?.length && !c.campaignId)));
  const activeChar = currentCharacters.find((c) => c.playerSlot === (activeSlot === 'SIMULTANEOUS' ? 'A' : activeSlot)) || currentCharacters[0] || fallbackHero;
  const contextBreakdown = inspectContextWindow({ ...currentCampaign, activePlayerSlot: activeSlot }, currentCharacters, currentLore, currentMessages, settings);
  const handleChangeDmMood = (mood: DmMood) => setCampaigns((prev) => prev.map((c) => c.id === activeCampaignId ? { ...c, dmMood: mood } : c));
  const protectHistory = (index: number) => {
    if (index >= 0 && currentMessages.slice(index).some(hasDamage)) {
      setTurnError('Этот участок истории изменил HP. Редактирование, удаление и перегенерация временно заблокированы до реализации отката механики.');
      return true;
    }
    return false;
  };
  const handleCreateCampaign = (newCamp: Campaign, starterChars?: Character[], starterLore?: LoreEntity[], starterMsg?: ChatMessage) => {
    setCampaigns((prev) => [newCamp, ...prev]); setActiveCampaignId(newCamp.id);
    if (starterChars?.length) setCharacters((prev) => [...starterChars, ...prev]);
    if (starterLore?.length) setLoreEntities((prev) => [...starterLore, ...prev]);
    if (starterMsg) setMessagesMap((prev) => ({ ...prev, [newCamp.id]: [starterMsg] }));
  };
  const handleDeleteCampaign = (id: string) => {
    if (turnInFlight.current || campaigns.length <= 1) return;
    const remaining = campaigns.filter((c) => c.id !== id);
    setCampaigns(remaining);
    if (activeCampaignId === id) setActiveCampaignId(remaining[0].id);
    setLoreEntities((prev) => prev.filter((e) => e.campaignId !== id));
    setCharacters((prev) => prev.filter((c) => c.campaignId !== id));
  };

  const requestTurn = async (history: StoredMessage[], slot: TurnSlot, showUserImmediately: boolean, roll?: string) => {
    if (turnInFlight.current) return;
    const lastUser = history[history.length - 1];
    if (!lastUser || lastUser.role !== 'user' || !lastUser.content.trim()) return;
    if (!currentCharacters.length) { setTurnError('Сначала создайте персонажа.'); return; }
    if (!showUserImmediately && protectHistory(history.length - 1)) return;
    turnInFlight.current = true;
    const campaignId = activeCampaignId;
    setIsLoading(true); setTurnError(null);
    if (showUserImmediately) setMessagesMap((prev) => ({ ...prev, [campaignId]: history }));
    try {
      const response = await generateDmTurn(currentCampaign, currentCharacters, currentLore, history.slice(0, -1), settings, lastUser.content, slot, roll);
      const damageEvents = prepareDamage(response.damageEvents, currentCharacters, response.sources, lastUser.content, lastUser.id);
      const persisted = new Set(Object.values(messagesMap).flatMap((list) => list.flatMap((m) => (m.damageEvents || []).map((e) => e.id))));
      if (damageEvents.some((e) => persisted.has(e.id) || appliedThisSession.current.has(e.id))) throw new Error('Повторное применение урона заблокировано.');
      const mechanicsText = damageEvents.map((e) => `${currentCharacters.find((c) => c.id === e.characterId)?.name}: −${e.amount} HP. ${e.reason}`).join('\n');
      const dmMsg: StoredMessage = {
        id: `msg-dm-${makeId()}`, campaignId, role: 'assistant', speakerName: 'Dungeon Master', speakerPlayerSlot: 'DM',
        dmMood: response.dmMood || currentCampaign.dmMood, content: response.cleanContent + (mechanicsText ? '\n\n[Механика]\n' + mechanicsText : ''),
        reasoning: response.reasoning, requestedCheck: response.requestedCheck, timestamp: Date.now(), damageEvents,
      };
      damageEvents.forEach((e) => appliedThisSession.current.add(e.id));
      if (damageEvents.length) setCharacters((prev) => prev.map((character) => {
        const event = damageEvents.find((e) => e.characterId === character.id);
        return event ? applyDamage(character, event) : character;
      }));
      if (response.entityUpdates?.length) setLoreEntities((prev) => prev.map((entity) => {
        if (entity.campaignId !== campaignId || !entity.isAutoMutable) return entity;
        const update = response.entityUpdates?.find((u) => typeof u.id === 'string' && (u.id.toLowerCase() === entity.id.toLowerCase() || u.id.toLowerCase() === entity.name.toLowerCase()));
        return update && typeof update.notes === 'string' ? { ...entity, lastUpdatedNotes: `${update.notes} (Ход #${history.length})` } : entity;
      }));
      setMessagesMap((prev) => ({ ...prev, [campaignId]: [...history, dmMsg] }));
      if (response.dmMood) setCampaigns((prev) => prev.map((c) => c.id === campaignId ? { ...c, dmMood: response.dmMood! } : c));
      if (visibleCampaign.current === campaignId && response.requestedCheck) {
        setActiveCheck(response.requestedCheck);
        if (slot === 'A' || slot === 'B') { setActiveSlot(slot); setIsDiceOpen(true); }
        else setTurnError('Для проверки совместного хода выберите конкретного героя и используйте карточку броска.');
      }
    } catch (error) {
      console.error('Failed to generate turn:', error);
      if (visibleCampaign.current === campaignId) setTurnError(error instanceof Error ? error.message : 'Не удалось получить ответ модели.');
    } finally { turnInFlight.current = false; setIsLoading(false); }
  };
  const executeDmTurn = async (text: string, speakerSlot: 'A' | 'B' = 'A', roll?: string) => {
    if (turnInFlight.current || !text.trim()) return;
    const speaker = currentCharacters.find((c) => c.playerSlot === speakerSlot) || activeChar;
    const slot: TurnSlot = activeSlot === 'SIMULTANEOUS' ? 'SIMULTANEOUS' : speakerSlot;
    const userMsg: StoredMessage = { id: `msg-${makeId()}`, campaignId: activeCampaignId, role: 'user',
      speakerName: slot === 'SIMULTANEOUS' ? 'Группа игроков' : speaker.name, speakerPlayerSlot: slot === 'SIMULTANEOUS' ? undefined : speakerSlot,
      content: text.trim(), timestamp: Date.now() };
    await requestTurn([...currentMessages, userMsg], slot, true, roll);
  };
  const handleSendMessage = async (text: string, speakerSlot: 'A' | 'B' = 'A') => {
    if (turnInFlight.current || pendingActionCheck || !text.trim()) return;
    await executeDmTurn(text, speakerSlot);
  };
  const handleRollPendingCheck = () => {
    if (turnInFlight.current || !pendingActionCheck) return;
    setActiveCheck({ stat: pendingActionCheck.assessment.stat || 'DEX', skillName: pendingActionCheck.assessment.skillName,
      dc: pendingActionCheck.assessment.dc || 13, description: pendingActionCheck.assessment.description || 'Проверка характеристики', sourceSpeaker: pendingActionCheck.characterName });
    setIsDiceOpen(true);
  };
  const handleSkipPendingCheck = () => {
    if (turnInFlight.current || !pendingActionCheck) return;
    const pending = pendingActionCheck; setPendingActionCheck(null);
    void executeDmTurn(`${pending.actionText}\n\n[Игрок решает отыграть действие нарративно, без броска кости]`, pending.speakerSlot);
  };
  const handleApplyDiceResult = (resultText: string, checkData?: CheckRequest) => {
    if (turnInFlight.current) return;
    setActiveCheck(null); setIsDiceOpen(false);
    const pending = pendingActionCheck; setPendingActionCheck(null);
    const roll = checkData ? JSON.stringify({ stat: checkData.stat, skillName: checkData.skillName, dc: checkData.dc,
      natural: checkData.rollResult, modifier: checkData.modifierApplied, total: checkData.totalScore, passed: checkData.passed }) : resultText;
    void executeDmTurn(pending ? `${pending.actionText}\n\n${resultText}` : resultText, pending?.speakerSlot || (activeSlot === 'SIMULTANEOUS' ? 'A' : activeSlot), roll);
  };
  const handleTriggerSkillRoll = (check: CheckRequest) => { if (!turnInFlight.current) { setActiveCheck(check); setIsDiceOpen(true); } };
  const messageSlot = (message: ChatMessage): TurnSlot => { const slot = message.speakerPlayerSlot; return slot === 'A' || slot === 'B' || slot === 'C' || slot === 'D' ? slot : 'SIMULTANEOUS'; };
  const handleEditMessage = async (id: string, newText: string) => {
    if (turnInFlight.current || pendingActionCheck || !newText.trim()) return;
    const index = currentMessages.findIndex((m) => m.id === id);
    if (index < 0 || protectHistory(index)) return;
    const target = currentMessages[index];
    if (target.role === 'assistant') {
      setMessagesMap((prev) => ({ ...prev, [activeCampaignId]: (prev[activeCampaignId] || []).map((m) => m.id === id ? { ...m, content: newText } : m) })); return;
    }
    await requestTurn([...currentMessages.slice(0, index), { ...target, content: newText.trim() }], messageSlot(target), false);
  };
  const handleDeleteMessage = (id: string) => {
    if (turnInFlight.current || pendingActionCheck) return;
    const index = currentMessages.findIndex((m) => m.id === id);
    if (index < 0 || protectHistory(index)) return;
    setMessagesMap((prev) => ({ ...prev, [activeCampaignId]: (prev[activeCampaignId] || []).filter((m) => m.id !== id) }));
  };
  const handleRegenerateMessage = async (id: string) => {
    if (turnInFlight.current || pendingActionCheck) return;
    const index = currentMessages.findIndex((m) => m.id === id);
    if (index <= 0 || currentMessages[index].role !== 'assistant' || protectHistory(index)) return;
    const history = currentMessages.slice(0, index);
    const lastUser = history[history.length - 1];
    if (lastUser?.role === 'user') await requestTurn(history, messageSlot(lastUser), false);
  };
  const handleManualSummarize = () => {
    if (turnInFlight.current || pendingActionCheck || currentMessages.length <= 2) return;
    const older = currentMessages.slice(1, -2);
    if (!older.length) return;
    if (older.some(hasDamage)) { setTurnError('Сжатие сообщений с журналом урона пока заблокировано: механические события должны сохраняться полностью.'); return; }
    const chronicle: CampaignHistoryEntry = { id: `hist-${makeId()}`, title: `Эпизод: ${currentCampaign.currentLocation}`,
      summary: `Ключевые события: ${older.map((m) => `${m.speakerName}: ${m.content.slice(0, 100)}...`).join('; ')}`,
      timestamp: Date.now(), keyEvents: ['Продвижение отряда', 'Разрешение проверок'], charactersInvolved: currentCharacters.map((c) => c.name) };
    setCampaigns((prev) => prev.map((c) => c.id === activeCampaignId ? { ...c, historyChronicles: [...(c.historyChronicles || []), chronicle] } : c));
    setMessagesMap((prev) => ({ ...prev, [activeCampaignId]: [currentMessages[0], ...currentMessages.slice(-2)] }));
  };
  const handleExportCampaign = () => {
    const data = { version: '1.0', exportedAt: new Date().toISOString(), campaign: currentCampaign, characters: currentCharacters, lore: currentLore, messages: currentMessages, settings: { ...settings, apiKey: '' } };
    const anchor = document.createElement('a');
    anchor.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    anchor.download = `mythictavern_${currentCampaign.title.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
  };
  const handleImportCampaign = (jsonString: string) => {
    if (turnInFlight.current) return;
    try {
      const data = JSON.parse(jsonString);
      if (!data.campaign || typeof data.campaign.id !== 'string' || !Array.isArray(data.characters) || !Array.isArray(data.lore) || !Array.isArray(data.messages)) throw new Error('Некорректный архив кампании.');
      const id = data.campaign.id;
      setCampaigns((prev) => [data.campaign, ...prev.filter((c) => c.id !== id)]);
      setActiveCampaignId(id);
      setCharacters((prev) => { const map = new Map(prev.map((c) => [c.id, c])); for (const c of data.characters) map.set(c.id, c); return [...map.values()]; });
      setLoreEntities((prev) => { const map = new Map(prev.map((e) => [e.id, e])); for (const e of data.lore) map.set(e.id, e); return [...map.values()]; });
      setMessagesMap((prev) => ({ ...prev, [id]: data.messages }));
      if (data.settings) setSettings((prev) => ({ ...prev, ...data.settings, apiKey: prev.apiKey }));
    } catch (error) { setTurnError(error instanceof Error ? error.message : 'Не удалось импортировать кампанию.'); }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-stone-950 font-sans text-stone-100">
      <Header campaign={currentCampaign} settings={settings} onOpenCampaigns={() => setIsCampaignManagerOpen(true)}
        onOpenDice={() => { if (!turnInFlight.current) { setActiveCheck(null); setIsDiceOpen(true); } }}
        onOpenCharacters={() => setIsCharSheetOpen(true)} onOpenLorebook={() => setIsLorebookOpen(true)} onOpenContext={() => setIsContextOpen(true)}
        onOpenNotebook={() => setIsNotebookOpen(true)} onOpenSettings={() => setIsSettingsOpen(true)} onChangeDmMood={handleChangeDmMood} />
      {turnError && <div role="alert" className="px-4 py-2 bg-rose-950 text-rose-200 text-sm">{turnError}</div>}
      <div className="flex flex-1 overflow-hidden">
        <PartySidebar campaigns={campaigns} activeCampaignId={activeCampaignId} characters={currentCharacters} activeSlot={activeSlot}
          activeLocation={currentCampaign.currentLocation} loreEntities={currentLore} onSelectCampaign={setActiveCampaignId} onSelectSlot={setActiveSlot}
          onOpenCampaigns={() => setIsCampaignManagerOpen(true)} onOpenCharacters={() => setIsCharSheetOpen(true)}
          onOpenDice={() => { if (!turnInFlight.current) { setActiveCheck(null); setIsDiceOpen(true); } }} onOpenLorebook={() => setIsLorebookOpen(true)} onChangeDmMood={handleChangeDmMood} />
        <ChatArea messages={currentMessages} characters={currentCharacters} activeSlot={activeSlot} onSelectSlot={setActiveSlot} isLoading={isLoading}
          onSendMessage={handleSendMessage} onEditMessage={handleEditMessage} onDeleteMessage={handleDeleteMessage} onRegenerateMessage={handleRegenerateMessage}
          onRequestCheckRoll={handleTriggerSkillRoll} pendingActionCheck={pendingActionCheck} onRollPendingCheck={handleRollPendingCheck}
          onSkipPendingCheck={handleSkipPendingCheck} onCancelPendingCheck={() => setPendingActionCheck(null)} />
      </div>
      <CampaignManagerModal isOpen={isCampaignManagerOpen} onClose={() => setIsCampaignManagerOpen(false)} campaigns={campaigns}
        activeCampaignId={activeCampaignId} onSelectCampaign={setActiveCampaignId} onCreateCampaign={handleCreateCampaign}
        onUpdateCampaign={(updated) => setCampaigns((prev) => prev.map((c) => c.id === updated.id ? updated : c))} onDeleteCampaign={handleDeleteCampaign} />
      <DiceModal isOpen={isDiceOpen} onClose={() => { setIsDiceOpen(false); setActiveCheck(null); }} activeCheck={activeCheck} activeCharacter={activeChar} onApplyResult={handleApplyDiceResult} />
      <CharacterSheetModal isOpen={isCharSheetOpen} onClose={() => setIsCharSheetOpen(false)} characters={currentCharacters}
        activeSlot={activeSlot === 'SIMULTANEOUS' ? 'A' : activeSlot} onSelectSlot={(slot) => setActiveSlot(slot as 'A' | 'B' | 'SIMULTANEOUS')}
        onUpdateCharacter={(updated) => { if (!turnInFlight.current) setCharacters((prev) => prev.map((c) => c.id === updated.id ? updated : c)); }}
        onCreateCharacter={(created) => { if (!turnInFlight.current) setCharacters((prev) => [...prev, { ...created, campaignId: activeCampaignId }]); }}
        onDeleteCharacter={(id) => { if (!turnInFlight.current) setCharacters((prev) => prev.filter((c) => c.id !== id)); }} onRollSkill={handleTriggerSkillRoll} />
      <LorebookModal isOpen={isLorebookOpen} onClose={() => setIsLorebookOpen(false)} campaignId={activeCampaignId} entities={currentLore}
        onUpdateEntity={(updated) => setLoreEntities((prev) => prev.map((e) => e.id === updated.id ? updated : e))}
        onAddEntity={(created) => setLoreEntities((prev) => [created, ...prev])} onDeleteEntity={(id) => setLoreEntities((prev) => prev.filter((e) => e.id !== id))} />
      <ContextInspectorModal isOpen={isContextOpen} onClose={() => setIsContextOpen(false)} campaign={currentCampaign} contextBreakdown={contextBreakdown}
        onUpdatePinnedFacts={(facts) => setCampaigns((prev) => prev.map((c) => c.id === activeCampaignId ? { ...c, pinnedFacts: facts } : c))} />
      <SummaryNotebookModal isOpen={isNotebookOpen} onClose={() => setIsNotebookOpen(false)} campaign={currentCampaign} settings={settings}
        onUpdateChronicles={(chronicles) => setCampaigns((prev) => prev.map((c) => c.id === activeCampaignId ? { ...c, historyChronicles: chronicles } : c))}
        onUpdateSettings={setSettings} onTriggerManualSummarize={handleManualSummarize} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} campaign={currentCampaign}
        onUpdateSettings={setSettings} onUpdateCampaign={(updated) => setCampaigns((prev) => prev.map((c) => c.id === updated.id ? updated : c))}
        onExportCampaign={handleExportCampaign} onImportCampaign={handleImportCampaign} />
    </div>
  );
}
