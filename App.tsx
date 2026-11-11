import React, { useState, useEffect } from 'react';
import {
  INITIAL_CAMPAIGNS,
  INITIAL_CHARACTERS,
  INITIAL_LORE_ENTITIES,
  INITIAL_MESSAGES,
  DEFAULT_MODEL_SETTINGS,
} from './data/defaultCampaigns';
import {
  Campaign,
  Character,
  LoreEntity,
  ChatMessage,
  ModelSettings,
  CheckRequest,
  CampaignHistoryEntry,
  DmMood,
  PendingActionCheck,
} from './types/dnd';
import { generateDmTurn, inspectContextWindow } from './services/llmService';
import { assessActionForCheck } from './utils/rules';
import { Header } from './components/Header';
import { PartySidebar } from './components/PartySidebar';
import { ChatArea } from './components/ChatArea';
import { DiceModal } from './components/DiceModal';
import { CharacterSheetModal } from './components/CharacterSheetModal';
import { LorebookModal } from './components/LorebookModal';
import { ContextInspectorModal } from './components/ContextInspectorModal';
import { SummaryNotebookModal } from './components/SummaryNotebookModal';
import { SettingsModal } from './components/SettingsModal';
import { CampaignManagerModal } from './components/CampaignManagerModal';

export default function App() {
  // State with LocalStorage Persistence & Default Merging
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    const saved = localStorage.getItem('mythictavern_campaigns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(parsed.map((c: any) => c.id));
          const missingDefaults = INITIAL_CAMPAIGNS.filter((c) => !existingIds.has(c.id));
          return [
            ...parsed.map((c: any) => ({ ...c, dmMood: c.dmMood || 'neutral' })),
            ...missingDefaults,
          ];
        }
      } catch (e) {
        console.error('Failed to parse saved campaigns:', e);
      }
    }
    return INITIAL_CAMPAIGNS;
  });

  const [activeCampaignId, setActiveCampaignId] = useState<string>(() => {
    return campaigns[0]?.id || 'camp-1';
  });

  const [characters, setCharacters] = useState<Character[]>(() => {
    const saved = localStorage.getItem('mythictavern_characters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(parsed.map((c: any) => c.id));
          const missingDefaults = INITIAL_CHARACTERS.filter((c) => !existingIds.has(c.id));
          return [...parsed, ...missingDefaults];
        }
      } catch (e) {}
    }
    return INITIAL_CHARACTERS;
  });

  const [loreEntities, setLoreEntities] = useState<LoreEntity[]>(() => {
    const saved = localStorage.getItem('mythictavern_lore');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(parsed.map((e: any) => e.id));
          const missingDefaults = INITIAL_LORE_ENTITIES.filter((e) => !existingIds.has(e.id));
          return [...parsed, ...missingDefaults];
        }
      } catch (e) {}
    }
    return INITIAL_LORE_ENTITIES;
  });

  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>(() => {
    const saved = localStorage.getItem('mythictavern_messages');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...INITIAL_MESSAGES, ...parsed };
      } catch (e) {}
    }
    return INITIAL_MESSAGES;
  });

  const [settings, setSettings] = useState<ModelSettings>(() => {
    const saved = localStorage.getItem('mythictavern_settings');
    return saved ? JSON.parse(saved) : DEFAULT_MODEL_SETTINGS;
  });

  const [activeSlot, setActiveSlot] = useState<'A' | 'B' | 'SIMULTANEOUS'>('A');
  const [activeCheck, setActiveCheck] = useState<CheckRequest | null>(null);
  const [pendingActionCheck, setPendingActionCheck] = useState<PendingActionCheck | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Modals state
  const [isDiceOpen, setIsDiceOpen] = useState(false);
  const [isCharSheetOpen, setIsCharSheetOpen] = useState(false);
  const [isLorebookOpen, setIsLorebookOpen] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isNotebookOpen, setIsNotebookOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCampaignManagerOpen, setIsCampaignManagerOpen] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('mythictavern_campaigns', JSON.stringify(campaigns));
  }, [campaigns]);

  useEffect(() => {
    localStorage.setItem('mythictavern_characters', JSON.stringify(characters));
  }, [characters]);

  useEffect(() => {
    localStorage.setItem('mythictavern_lore', JSON.stringify(loreEntities));
  }, [loreEntities]);

  useEffect(() => {
    localStorage.setItem('mythictavern_messages', JSON.stringify(messagesMap));
  }, [messagesMap]);

  useEffect(() => {
    localStorage.setItem('mythictavern_settings', JSON.stringify(settings));
  }, [settings]);

  const DEFAULT_FALLBACK_HERO: Character = {
    id: 'temp-hero',
    name: 'Безымянный герой',
    title: 'Искатель приключений',
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
    backstory: 'Начинающий искатель приключений.',
    personalityTraits: 'Решительный и осторожный.',
    notes: '',
  };

  const currentCampaign =
    campaigns.find((c) => c.id === activeCampaignId) || campaigns[0];
  const currentMessages = messagesMap[activeCampaignId] || [];
  const currentLore = loreEntities.filter(
    (e) => e.campaignId === activeCampaignId
  );
  const campaignCharacters = characters.filter((c) =>
    currentCampaign.isCleanSession
      ? c.campaignId === activeCampaignId
      : (!c.campaignId || c.campaignId === activeCampaignId)
  );
  const currentCharacters = campaignCharacters;
  const activeChar =
    currentCharacters.find((c) => c.playerSlot === (activeSlot === 'SIMULTANEOUS' ? 'A' : activeSlot)) ||
    currentCharacters[0] ||
    DEFAULT_FALLBACK_HERO;

  const handleChangeDmMood = (mood: DmMood) => {
    setCampaigns((prev) =>
      prev.map((c) => (c.id === activeCampaignId ? { ...c, dmMood: mood } : c))
    );
  };

  const handleCreateCampaign = (
    newCamp: Campaign,
    starterChars?: Character[],
    starterLore?: LoreEntity[],
    starterMsg?: ChatMessage
  ) => {
    setCampaigns((prev) => [newCamp, ...prev]);
    setActiveCampaignId(newCamp.id);
    if (starterLore && starterLore.length > 0) {
      setLoreEntities((prev) => [...starterLore, ...prev]);
    }
    if (starterChars && starterChars.length > 0) {
      setCharacters((prev) => [...starterChars, ...prev]);
    }
    if (starterMsg) {
      setMessagesMap((prev) => ({ ...prev, [newCamp.id]: [starterMsg] }));
    }
  };

  const handleDeleteCampaign = (id: string) => {
    if (campaigns.length <= 1) return;
    const remaining = campaigns.filter((c) => c.id !== id);
    setCampaigns(remaining);
    if (activeCampaignId === id) {
      setActiveCampaignId(remaining[0].id);
    }
    setLoreEntities((prev) => prev.filter((e) => e.campaignId !== id));
    setCharacters((prev) => prev.filter((c) => c.campaignId !== id));
  };

  const handleCreateCharacter = (newChar: Character) => {
    const scopedChar = { ...newChar, campaignId: activeCampaignId };
    setCharacters((prev) => [...prev, scopedChar]);
  };

  const handleDeleteCharacter = (id: string) => {
    setCharacters((prev) => prev.filter((c) => c.id !== id));
  };

  // Token breakdown for context inspector
  const contextBreakdown = inspectContextWindow(
    currentCampaign,
    currentCharacters,
    currentLore,
    currentMessages,
    settings
  );

  // Internal Turn Execution Pipeline
  const executeDmTurn = async (
    text: string,
    speakerSlot: 'A' | 'B' = 'A'
  ) => {
    const speakerChar =
      currentCharacters.find((c) => c.playerSlot === speakerSlot) || activeChar;
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      campaignId: activeCampaignId,
      role: 'user',
      speakerName: activeSlot === 'SIMULTANEOUS' ? 'Группа игроков' : speakerChar.name,
      speakerPlayerSlot: activeSlot === 'SIMULTANEOUS' ? undefined : speakerSlot,
      content: text,
      timestamp: Date.now(),
    };

    const newMessages = [...currentMessages, userMsg];
    setMessagesMap((prev) => ({
      ...prev,
      [activeCampaignId]: newMessages,
    }));

    setIsLoading(true);

    try {
      const response = await generateDmTurn(
        currentCampaign,
        currentCharacters,
        currentLore,
        newMessages,
        settings,
        text
      );

      // Handle Auto-mutation of lore entities if suggested by AI
      if (response.entityUpdates && response.entityUpdates.length > 0) {
        setLoreEntities((prev) =>
          prev.map((entity) => {
            const update = response.entityUpdates?.find(
              (u) =>
                u.id.toLowerCase() === entity.id.toLowerCase() ||
                u.id.toLowerCase() === entity.name.toLowerCase()
            );
            if (update && entity.isAutoMutable) {
              return {
                ...entity,
                lastUpdatedNotes: `${update.notes} (Ход #${newMessages.length})`,
              };
            }
            return entity;
          })
        );
      }

      const dmMsg: ChatMessage = {
        id: `msg-dm-${Date.now()}`,
        campaignId: activeCampaignId,
        role: 'assistant',
        speakerName: 'Dungeon Master',
        speakerPlayerSlot: 'DM',
        dmMood: currentCampaign.dmMood,
        content: response.cleanContent,
        reasoning: response.reasoning,
        requestedCheck: response.requestedCheck,
        timestamp: Date.now(),
      };

      setMessagesMap((prev) => ({
        ...prev,
        [activeCampaignId]: [...newMessages, dmMsg],
      }));

      // If AI still requested an emergency ability check (rare encounter twist):
      if (response.requestedCheck) {
        setActiveCheck(response.requestedCheck);
        setIsDiceOpen(true);
      }
    } catch (error) {
      console.error('Failed to generate turn:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Two-Phase Pre-Check Action Evaluator:
  // Decides whether an action strictly requires a roll BEFORE generating prose!
  const handleSendMessage = async (
    text: string,
    speakerSlot: 'A' | 'B' = 'A'
  ) => {
    // If the input already contains a resolved dice roll or explicit narrative resolution:
    const isAlreadyRollResult =
      text.includes('[БРОСОК КУБИКА:') ||
      text.includes('Результат проверки:') ||
      text.includes('[Результат броска') ||
      text.includes('[Игрок решает отыграть действие без броска');

    if (!isAlreadyRollResult) {
      const speakerChar =
        currentCharacters.find((c) => c.playerSlot === speakerSlot) || activeChar;

      const assessment = assessActionForCheck(
        text,
        speakerChar,
        currentCampaign
      );

      if (assessment.requiresCheck) {
        setPendingActionCheck({
          actionText: text,
          speakerSlot,
          characterName: activeSlot === 'SIMULTANEOUS' ? 'Группа игроков' : speakerChar.name,
          assessment,
        });
        return; // Halt turn generation until dice roll is decided!
      }
    }

    // Direct action without risk -> generate narrative immediately
    await executeDmTurn(text, speakerSlot);
  };

  // Pending Check Roll Trigger
  const handleRollPendingCheck = () => {
    if (!pendingActionCheck) return;
    const chk: CheckRequest = {
      stat: pendingActionCheck.assessment.stat || 'DEX',
      skillName: pendingActionCheck.assessment.skillName,
      dc: pendingActionCheck.assessment.dc || 13,
      description: pendingActionCheck.assessment.description || 'Проверка характеристики',
      sourceSpeaker: pendingActionCheck.characterName,
    };
    setActiveCheck(chk);
    setIsDiceOpen(true);
  };

  // Skip pending check narratively
  const handleSkipPendingCheck = () => {
    if (!pendingActionCheck) return;
    const combined = `${pendingActionCheck.actionText}\n\n[Игрок решает отыграть действие нарративно, без броска кости]`;
    const slot = pendingActionCheck.speakerSlot;
    setPendingActionCheck(null);
    executeDmTurn(combined, slot);
  };

  // Cancel pending check
  const handleCancelPendingCheck = () => {
    setPendingActionCheck(null);
  };

  // Dice roll applied back to chat (with pending action merging)
  const handleApplyDiceResult = (resultText: string, checkData?: CheckRequest) => {
    setActiveCheck(null);
    if (pendingActionCheck) {
      const combined = `${pendingActionCheck.actionText}\n\n${resultText}`;
      const slot = pendingActionCheck.speakerSlot;
      setPendingActionCheck(null);
      executeDmTurn(combined, slot);
    } else {
      executeDmTurn(resultText, activeSlot === 'SIMULTANEOUS' ? 'A' : activeSlot);
    }
  };

  // Manual roll request from character sheet or chat card
  const handleTriggerSkillRoll = (check: CheckRequest) => {
    setActiveCheck(check);
    setIsDiceOpen(true);
  };

  // Message edits
  const handleEditMessage = async (id: string, newText: string) => {
    const targetIdx = currentMessages.findIndex((m) => m.id === id);
    if (targetIdx === -1) return;

    const targetMsg = currentMessages[targetIdx];

    if (targetMsg.role === 'assistant') {
      // Direct edit of DM message
      const updated = currentMessages.map((m) =>
        m.id === id ? { ...m, content: newText } : m
      );
      setMessagesMap((prev) => ({ ...prev, [activeCampaignId]: updated }));
    } else {
      // User message edit: truncate subsequent responses and regenerate!
      const truncated = currentMessages.slice(0, targetIdx);
      const editedUserMsg: ChatMessage = { ...targetMsg, content: newText };
      const updatedHistory = [...truncated, editedUserMsg];

      setMessagesMap((prev) => ({ ...prev, [activeCampaignId]: updatedHistory }));
      setIsLoading(true);

      try {
        const response = await generateDmTurn(
          currentCampaign,
          currentCharacters,
          currentLore,
          updatedHistory,
          settings,
          newText
        );

        const dmMsg: ChatMessage = {
          id: `msg-dm-${Date.now()}`,
          campaignId: activeCampaignId,
          role: 'assistant',
          speakerName: 'Dungeon Master',
          speakerPlayerSlot: 'DM',
          dmMood: currentCampaign.dmMood,
          content: response.cleanContent,
          reasoning: response.reasoning,
          requestedCheck: response.requestedCheck,
          timestamp: Date.now(),
        };

        setMessagesMap((prev) => ({
          ...prev,
          [activeCampaignId]: [...updatedHistory, dmMsg],
        }));

        if (response.requestedCheck) {
          setActiveCheck(response.requestedCheck);
          setIsDiceOpen(true);
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Delete message
  const handleDeleteMessage = (id: string) => {
    const updated = currentMessages.filter((m) => m.id !== id);
    setMessagesMap((prev) => ({ ...prev, [activeCampaignId]: updated }));
  };

  // Regenerate last DM message
  const handleRegenerateMessage = async (id: string) => {
    const targetIdx = currentMessages.findIndex((m) => m.id === id);
    if (targetIdx <= 0) return;

    // Previous message should be user action
    const previousHistory = currentMessages.slice(0, targetIdx);
    const lastUserMsg = previousHistory[previousHistory.length - 1];

    setMessagesMap((prev) => ({ ...prev, [activeCampaignId]: previousHistory }));
    setIsLoading(true);

    try {
      const response = await generateDmTurn(
        currentCampaign,
        currentCharacters,
        currentLore,
        previousHistory,
        settings,
        lastUserMsg.content
      );

      const dmMsg: ChatMessage = {
        id: `msg-dm-${Date.now()}`,
        campaignId: activeCampaignId,
        role: 'assistant',
        speakerName: 'Dungeon Master',
        speakerPlayerSlot: 'DM',
        dmMood: currentCampaign.dmMood,
        content: response.cleanContent,
        reasoning: response.reasoning,
        requestedCheck: response.requestedCheck,
        timestamp: Date.now(),
      };

      setMessagesMap((prev) => ({
        ...prev,
        [activeCampaignId]: [...previousHistory, dmMsg],
      }));

      if (response.requestedCheck) {
        setActiveCheck(response.requestedCheck);
        setIsDiceOpen(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Manual or automatic compression
  const handleManualSummarize = () => {
    if (currentMessages.length <= 2) return;

    // Compress older messages into history chronicles
    const messagesToCompress = currentMessages.slice(1, -2);
    if (messagesToCompress.length === 0) return;

    const summaryText = messagesToCompress
      .map((m) => `${m.speakerName}: ${m.content.slice(0, 100)}...`)
      .join('; ');

    const newChronicle: CampaignHistoryEntry = {
      id: `hist-${Date.now()}`,
      title: `Эпизод: ${currentCampaign.currentLocation}`,
      summary: `Ключевые события: ${summaryText}`,
      timestamp: Date.now(),
      keyEvents: ['Продвижение отряда', 'Разрешение проверок'],
      charactersInvolved: characters.map((c) => c.name),
    };

    const remainingMessages = [currentMessages[0], ...currentMessages.slice(-2)];

    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === activeCampaignId
          ? { ...c, historyChronicles: [...c.historyChronicles, newChronicle] }
          : c
      )
    );

    setMessagesMap((prev) => ({
      ...prev,
      [activeCampaignId]: remainingMessages,
    }));
  };

  // Export Campaign JSON
  const handleExportCampaign = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      campaign: currentCampaign,
      characters,
      lore: currentLore,
      messages: currentMessages,
      settings,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `mythictavern_${currentCampaign.title.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import Campaign JSON
  const handleImportCampaign = (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      if (data.campaign) {
        setCampaigns((prev) => [data.campaign, ...prev.filter((c) => c.id !== data.campaign.id)]);
        setActiveCampaignId(data.campaign.id);
      }
      if (data.characters) setCharacters(data.characters);
      if (data.lore) setLoreEntities((prev) => [...data.lore, ...prev]);
      if (data.messages && data.campaign?.id) {
        setMessagesMap((prev) => ({ ...prev, [data.campaign.id]: data.messages }));
      }
      if (data.settings) setSettings(data.settings);
    } catch (e) {
      console.error('Failed to import campaign:', e);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-stone-950 font-sans text-stone-100">
      {/* Top Bar Navigation */}
      <Header
        campaign={currentCampaign}
        settings={settings}
        onOpenCampaigns={() => setIsCampaignManagerOpen(true)}
        onOpenDice={() => {
          setActiveCheck(null);
          setIsDiceOpen(true);
        }}
        onOpenCharacters={() => setIsCharSheetOpen(true)}
        onOpenLorebook={() => setIsLorebookOpen(true)}
        onOpenContext={() => setIsContextOpen(true)}
        onOpenNotebook={() => setIsNotebookOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onChangeDmMood={handleChangeDmMood}
      />

      {/* Main Workspace Split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Party & Adventure Sidebar */}
        <PartySidebar
          campaigns={campaigns}
          activeCampaignId={activeCampaignId}
          characters={currentCharacters}
          activeSlot={activeSlot}
          activeLocation={currentCampaign.currentLocation}
          loreEntities={currentLore}
          onSelectCampaign={(id) => setActiveCampaignId(id)}
          onSelectSlot={(slot) => setActiveSlot(slot)}
          onOpenCampaigns={() => setIsCampaignManagerOpen(true)}
          onOpenCharacters={() => setIsCharSheetOpen(true)}
          onOpenDice={() => {
            setActiveCheck(null);
            setIsDiceOpen(true);
          }}
          onOpenLorebook={() => setIsLorebookOpen(true)}
          onChangeDmMood={handleChangeDmMood}
        />

        {/* Central Narrative Chat Timeline */}
        <ChatArea
          messages={currentMessages}
          characters={currentCharacters}
          activeSlot={activeSlot}
          onSelectSlot={(slot) => setActiveSlot(slot)}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onRegenerateMessage={handleRegenerateMessage}
          onRequestCheckRoll={handleTriggerSkillRoll}
          pendingActionCheck={pendingActionCheck}
          onRollPendingCheck={handleRollPendingCheck}
          onSkipPendingCheck={handleSkipPendingCheck}
          onCancelPendingCheck={handleCancelPendingCheck}
        />
      </div>

      {/* Interactive Modals */}
      <CampaignManagerModal
        isOpen={isCampaignManagerOpen}
        onClose={() => setIsCampaignManagerOpen(false)}
        campaigns={campaigns}
        activeCampaignId={activeCampaignId}
        onSelectCampaign={(id) => setActiveCampaignId(id)}
        onCreateCampaign={handleCreateCampaign}
        onUpdateCampaign={(updated) =>
          setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        }
        onDeleteCampaign={handleDeleteCampaign}
      />

      <DiceModal
        isOpen={isDiceOpen}
        onClose={() => {
          setIsDiceOpen(false);
          setActiveCheck(null);
        }}
        activeCheck={activeCheck}
        activeCharacter={activeChar}
        onApplyResult={handleApplyDiceResult}
      />

      <CharacterSheetModal
        isOpen={isCharSheetOpen}
        onClose={() => setIsCharSheetOpen(false)}
        characters={currentCharacters}
        activeSlot={activeSlot === 'SIMULTANEOUS' ? 'A' : (activeSlot as 'A' | 'B' | 'C' | 'D')}
        onSelectSlot={(slot) => setActiveSlot(slot as 'A' | 'B' | 'SIMULTANEOUS')}
        onUpdateCharacter={(updated) =>
          setCharacters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        }
        onCreateCharacter={handleCreateCharacter}
        onDeleteCharacter={handleDeleteCharacter}
        onRollSkill={handleTriggerSkillRoll}
      />

      <LorebookModal
        isOpen={isLorebookOpen}
        onClose={() => setIsLorebookOpen(false)}
        campaignId={activeCampaignId}
        entities={currentLore}
        onUpdateEntity={(updated) =>
          setLoreEntities((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
        }
        onAddEntity={(created) => setLoreEntities((prev) => [created, ...prev])}
        onDeleteEntity={(id) => setLoreEntities((prev) => prev.filter((e) => e.id !== id))}
      />

      <ContextInspectorModal
        isOpen={isContextOpen}
        onClose={() => setIsContextOpen(false)}
        campaign={currentCampaign}
        contextBreakdown={contextBreakdown}
        onUpdatePinnedFacts={(facts) =>
          setCampaigns((prev) =>
            prev.map((c) => (c.id === activeCampaignId ? { ...c, pinnedFacts: facts } : c))
          )
        }
      />

      <SummaryNotebookModal
        isOpen={isNotebookOpen}
        onClose={() => setIsNotebookOpen(false)}
        campaign={currentCampaign}
        settings={settings}
        onUpdateChronicles={(chronicles) =>
          setCampaigns((prev) =>
            prev.map((c) => (c.id === activeCampaignId ? { ...c, historyChronicles: chronicles } : c))
          )
        }
        onUpdateSettings={setSettings}
        onTriggerManualSummarize={handleManualSummarize}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        campaign={currentCampaign}
        onUpdateSettings={setSettings}
        onUpdateCampaign={(updated) =>
          setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        }
        onExportCampaign={handleExportCampaign}
        onImportCampaign={handleImportCampaign}
      />
    </div>
  );
}
