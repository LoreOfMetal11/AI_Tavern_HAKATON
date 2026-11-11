import { Campaign, Character, LoreEntity, ChatMessage, ModelSettings, CheckRequest, StatName, ContextBreakdown, DmMood } from './dnd';
import { retrieveRelevantLoreEntities, estimateTokens, formatModifier, getModifier } from './rules';

export interface ParsedAiResponse {
  cleanContent: string;
  reasoning?: string;
  requestedCheck?: CheckRequest;
  dmMood?: DmMood;
  entityUpdates?: Array<{ id: string; notes: string }>;
}

export function buildSystemPrompt(
  campaign: Campaign, players: Character[], activeEntities: LoreEntity[], settings: ModelSettings,
  activeSlot: 'A' | 'B' | 'C' | 'D' | 'SIMULTANEOUS' = 'A', rollOutcomeContext?: string
): string {
  const playerDescriptions = players.map((p, idx) => {
    const statsStr = Object.entries(p.stats).map(([stat, val]) => `${stat} ${val} (${formatModifier(getModifier(val))})`).join(', ');
    const skillsProf = Object.keys(p.skills).filter((k) => p.skills[k]).join(', ');
    const conditionsStr = p.activeConditions && p.activeConditions.length > 0
      ? p.activeConditions.map((c) => `${c.nameRu} [${c.mechanicalEffectRu}]`).join('; ')
      : 'Нет активных штрафов/состояний';
    const isCurrentTurn = activeSlot === 'SIMULTANEOUS' || activeSlot === p.playerSlot;
    return `[ГЕРОЙ #${idx + 1}] Слот [${p.playerSlot}] — "${p.name}" (${p.race}, ${p.class} / ${p.subclass}, ур. ${p.level}):
  • Роль в этом ходе: ${isCurrentTurn ? 'АКТИВНО ДЕЙСТВУЕТ СЕЙЧАС' : 'НАХОДИТСЯ РЯДОМ (СОЮЗНИК/НАБЛЮДАТЕЛЬ)'}
  • КД: ${p.ac}, Хиты: ${p.hpCurrent}/${p.hpMax}, Скорость: ${p.speed} фт.
  • Характеристики: ${statsStr}.
  • Владение навыками: ${skillsProf || 'Базовые'}.
  • Снаряжение: ${p.inventory.map((i) => i.name).join(', ') || 'Базовое'}.
  • Характер и повадки: ${p.personalityTraits || 'Храбрый и осторожный'}.
  • Активные состояния (D&D 5e): ${conditionsStr}.`;
  }).join('\n\n');
  const loreBlock = activeEntities.length > 0
    ? activeEntities.map((e) => `[АКТИВНО В СЦЕНЕ: ${e.type.toUpperCase()}] "${e.name}":
• Суть: ${e.summary}
• Детали: ${e.details}
${e.lastUpdatedNotes ? `• Последние изменения: ${e.lastUpdatedNotes}` : ''}`).join('\n\n')
    : 'Текущая сцена опирается на окружение стартовой локации.';
  const pinnedFacts = campaign.pinnedFacts && campaign.pinnedFacts.length > 0
    ? `\nНЕПРЕЛОЖНЫЕ ЗАКОНЫ И ФАКТЫ МИРА:\n${campaign.pinnedFacts.map((f) => `• ${f}`).join('\n')}` : '';
  const chronicles = campaign.historyChronicles && campaign.historyChronicles.length > 0
    ? `\nХРОНИКИ ПРЕДЫДУЩИХ СОБЫТИЙ (Краткая выжимка):\n${campaign.historyChronicles.slice(-3).map((h) => `• [${h.title}]: ${h.summary}`).join('\n')}` : '';
  let reasoningGuidance = '';
  if (settings.reasoningEffort === 'concise') {
    reasoningGuidance = 'Краткие размышления (1-2 емких предложения в блоке <think>): тактическая суть и решение.';
  } else if (settings.reasoningEffort === 'deep') {
    reasoningGuidance = `ГЛУБОКИЙ СТРАТЕГИЧЕСКИЙ АНАЛИЗ (в блоке <think>...</think>):
1. Анализ намерений игрока, психологии присутствующих NPC и атмосферы локации "${campaign.currentLocation}".
2. Четкое разделение действий КАЖДОГО героя партии. Не путай их имена, навыки и мотивы!
3. Учет активных состояний (штрафы от яда, истощения, испуга) и физики мира.
4. Выявление скрытых опасностей, зацепок для базы знаний и возможных последствий на будущие ходы.`;
  } else {
    reasoningGuidance = `СТАНДАРТНЫЙ АНАЛИЗ D&D 5e (в блоке <think>...</think>):
Оцени намерение игрока, сверься с характеристиками и активными состояниями персонажа, реши драматические последствия для сцены.`;
  }
  const multiCharDirective = players.length > 1
    ? `\nКРИТИЧЕСКИ ВАЖНО: В партии ${players.length} разных персонажа: ${players.map((p) => `"${p.name}" (${p.class})`).join(', ')}.
• Если ход делает конкретный персонаж (слот ${activeSlot}): описывай реакцию именно его, а его спутников упоминай как соратников рядом.
• Если ход совместный ("Совместно"): ОБЯЗАТЕЛЬНО дай ответ на действия КАЖДОГО персонажа по отдельности, не объединяя их личности и не путая их имена!` : '';
  return `Ты — выдающийся Dungeon Master (Ведущий настольных ролевых игр) по системе D&D 5-й редакции.
Мир / Приключение: "${campaign.title}". Локация сцены: "${campaign.currentLocation}".
${campaign.description ? `Контекст мира: ${campaign.description}` : ''}

${multiCharDirective}

ПРАВИЛА МАСТЕРА (СТРОГО):
1. ЗАПРЕТ НА ДЕЙСТВИЯ ЗА ИГРОКА: Ты НИКОГДА не принимаешь решений, не говоришь и не двигаешь героев игроков. Ты описываешь только окружение, физику мира, реакции NPC и последствия заявленных игроком действий.
2. ВНИМАНИЕ К ДЕТАЛЯМ СЛОВ ИГРОКА: Внимательно слушай, ЧТО именно сказал или сделал игрок. Если игрок зажигает факел — опиши блики пламени и тени. Если он осматривает саркофаг — опиши резьбу и пыль. Если он обращается к NPC — NPC отвечает на ЕГО слова, а не говорит невпопад!
3. ДАННЫЕ О БРОСКАХ: Броски кубиков оцениваются ДО формирования повествования. Если результат броска уже указан игроком, кинематографично опиши исход этого броска без зацикливания и без требования повторных бросков!
4. СОСТОЯНИЯ ПЕРСОНАЖЕЙ: Если у персонажа есть активное состояние (например, "Отравлен" или "Истощение"), отрази это в телесных ощущениях (слабость, дрожь в руках, одышка).
5. ИЗМЕНЕНИЯ В МИРЕ: Если NPC ранен, предмет найден или локация повреждена, используй тег: [UPDATE_ENTITY: {"id": "ID_СУЩНОСТИ", "notes": "что изменилось"}]
6. НАСТРОЕНИЕ СЦЕНЫ: Можешь задать настроение сцены тегом: [DM_MOOD: neutral | combat | mystery | triumph | peril]
7. РАЗМЫШЛЕНИЯ МАСТЕРА:
${reasoningGuidance}
8. ЯЗЫК: ИСКЛЮЧИТЕЛЬНО богатый литературный русский язык.

ГЕРОИ ПАРТИИ В ТЕКУЩЕМ ПРИКЛЮЧЕНИИ:
${playerDescriptions}

АКТИВНАЯ ГОРЯЧАЯ ПАМЯТЬ СЦЕНЫ (Холодная база данных осталась в архиве и не забивает контекст):
${loreBlock}
${pinnedFacts}
${chronicles}
${rollOutcomeContext ? `\nТЕКУЩИЙ ИСХОД ПРОВЕРКИ:\n${rollOutcomeContext}` : ''}
`;
}

export function inspectContextWindow(
  campaign: Campaign, players: Character[], allLore: LoreEntity[], messages: ChatMessage[],
  settings: ModelSettings, userDraftText: string = ''
): ContextBreakdown {
  const { hotEntities, coldEntities } = retrieveRelevantLoreEntities(allLore, messages.slice(-4).map((m) => m.content).join(' '), userDraftText, campaign.currentLocation, 4);
  const systemRulesPrompt = buildSystemPrompt(campaign, players, hotEntities, settings, campaign.activePlayerSlot);
  const systemTokens = estimateTokens(systemRulesPrompt);
  const rulesTokens = 250;
  const loreTokens = estimateTokens(hotEntities.map((l) => `${l.name} ${l.summary} ${l.details}`).join('\n'));
  const summaryTokens = estimateTokens((campaign.historyChronicles || []).map((c) => c.summary).join('\n') + (campaign.pinnedFacts || []).join('\n'));
  const chatTokens = estimateTokens(messages.map((m) => `${m.speakerName}: ${m.content}`).join('\n\n'));
  return { systemTokens, rulesTokens, loreTokens, summaryTokens, chatTokens, totalTokens: systemTokens + chatTokens,
    maxBudget: settings.contextBudget, activeEntities: hotEntities, coldEntities, rawPromptPreview: systemRulesPrompt };
}

export function parseAiResponse(rawText: string): ParsedAiResponse {
  let text = rawText;
  let reasoning: string | undefined;
  let requestedCheck: CheckRequest | undefined;
  const entityUpdates: Array<{ id: string; notes: string }> = [];
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    reasoning = thinkMatch[1].trim();
    text = text.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
  }
  const checkMatch = text.match(/\[CHECK:\s*([A-Z]{3})(?:\((.*?)\))?\s*DC:\s*(\d+)\]/i);
  if (checkMatch) {
    const stat = checkMatch[1].toUpperCase() as StatName;
    const skillName = checkMatch[2] ? checkMatch[2].trim() : undefined;
    const dc = parseInt(checkMatch[3], 10) || 12;
    requestedCheck = { stat, skillName, dc, description: `Проверка ${skillName || stat} (Сложность DC ${dc})` };
    text = text.replace(/\[CHECK:\s*([A-Z]{3})(?:\((.*?)\))?\s*DC:\s*(\d+)\]/i, '').trim();
  }
  const moodMatch = text.match(/\[DM_MOOD:\s*(neutral|combat|mystery|triumph|peril)\]/i);
  let dmMood: DmMood | undefined;
  if (moodMatch) {
    dmMood = moodMatch[1].toLowerCase() as DmMood;
    text = text.replace(/\[DM_MOOD:\s*(neutral|combat|mystery|triumph|peril)\]/i, '').trim();
  }
  const entityRegex = /\[UPDATE_ENTITY:\s*(\{.*?\})\]/gi;
  let match;
  while ((match = entityRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.id || parsed.name) entityUpdates.push({ id: parsed.id || parsed.name, notes: parsed.notes || parsed.description || 'Обновлено мастером' });
    } catch { /* Invalid optional metadata is ignored. */ }
  }
  text = text.replace(/\[UPDATE_ENTITY:\s*\{.*?\}\]/gi, '').trim();
  return { cleanContent: text, reasoning, requestedCheck, dmMood, entityUpdates: entityUpdates.length > 0 ? entityUpdates : undefined };
}

export function generateSimulatedDmResponse(
  userMessage: string, campaign: Campaign, players: Character[], activeLore: LoreEntity[],
  recentMessages: ChatMessage[], settings: ModelSettings, activeSlot: 'A' | 'B' | 'C' | 'D' | 'SIMULTANEOUS' = 'A'
): ParsedAiResponse {
  const text = userMessage.trim();
  const lower = text.toLowerCase();
  const charA = players.find((p) => p.playerSlot === 'A') || players[0];
  const charB = players.find((p) => p.playerSlot === 'B') || players[1] || charA;
  const actingChar = activeSlot === 'B' ? charB : charA;
  const companion = actingChar.id === charA.id ? charB : charA;
  const loc = campaign.currentLocation || 'Неизведанные земли';
  const hasPoison = actingChar.activeConditions?.some((c) => c.type === 'poisoned');
  const hasExhaustion = actingChar.activeConditions?.some((c) => c.type === 'exhaustion');
  let reasoning = '';
  const effort = settings.reasoningEffort || 'standard';
  if (effort === 'concise') {
    reasoning = `Действие: "${text.slice(0, 50)}...". Локация: ${loc}. Персонаж: ${actingChar.name}. Проверяем логику и выдаем атмосферный ответ.`;
  } else if (effort === 'deep') {
    reasoning = `[ЭТАП 1: Анализ намерения игрока]
Игрок заявил: "${text}".
Действующий герой: ${actingChar.name} (${actingChar.race}, ${actingChar.class}, Ур. ${actingChar.level}).
Спутник рядом: ${companion.name} (${companion.class}).

[ЭТАП 2: Учет условий D&D 5e и модификаторов]
Локация: "${loc}". Активные состояния: ${hasPoison ? 'Отравлен (помеха на проверки)' : 'Норма'}${hasExhaustion ? ', Истощение' : ''}.
Анализ окружения и освещения: отслеживаем реакцию мира без захвата воли персонажа.

[ЭТАП 3: Анализ базы знаний]
Горячие сущности сцены: ${activeLore.map((e) => e.name).join(', ') || 'Стартовое окружение'}.
Холодная база данных сохранена в неизменности, лишние токены не расходуются.

[ЭТАП 4: Сюжетное продвижение]
Формируем кинематографичный ответ, реагирующий точно на слова игрока.`;
  } else {
    reasoning = `Анализ намерения: ${actingChar.name} предпринимает действие в локации "${loc}".
Проверка D&D 5e: учитываем параметры ${actingChar.name} и присутствие ${companion.name}.
Реакция мира: описываем непосредственные последствия для окружения и отряда.`;
  }
  let cleanContent = '';
  let dmMood: DmMood = 'neutral';
  if (lower.includes('результат броска') || lower.includes('vs dc') || lower.includes('успех') || lower.includes('провал')) {
    const isSuccess = lower.includes('успех') || lower.includes('натуральная 20') || lower.includes('20');
    if (isSuccess) {
      dmMood = 'triumph';
      cleanContent = `Кубики склоняют чашу весов в вашу пользу! Движения ${actingChar.name} точны, выверены и не оставляют сомнений в мастерстве.\n\nЗадуманное удается в совершенстве. Препятствие поддается с глухим щелчком, а скрытый механизм внутри каменной кладки локации *«${loc}»* открывает новый путь. ${companion.name !== actingChar.name ? `${companion.name} одобрительно кивает, прикрывая отход и держа оружие наготове.` : ''}\n\nПеред вами открывается потайная ниша, усыпанная вековой пылью. Внутри мерцает тусклый отблеск металла и старинного свитка.\n\n*Что ${actingChar.name} и спутники предпримут дальше?*`;
    } else {
      dmMood = 'peril';
      cleanContent = `Судьба бросает суровый вызов — бросок оборачивается неудачей! \n\nВ самый ответственный момент пальцы соскальзывают, а каменная осыпь под ногой ${actingChar.name} с резким сухим треском осыпается вниз. Эхо разносится по сводам локации *«${loc}»*.\n\nГде-то впереди раздается настороженный шорох и скрип ржавого металла. ${companion.name !== actingChar.name ? `${companion.name} инстинктивно перехватывает оружие, готовясь отразить возможную атаку.` : ''}\n\n*Тишина нарушена. Опасность приблизилась вплотную — как поступит отряд?*`;
    }
    return { cleanContent, reasoning, dmMood };
  }
  if (lower.includes('факел') || lower.includes('огонь') || lower.includes('зажига') || lower.includes('свет')) {
    dmMood = 'mystery';
    cleanContent = `Кремни высекают пучок ярких оранжевых искр. Сургуч и смола на факеле с тихим шипением занимаются ровным, гудящим пламенем.\n\nТьма в локации *«${loc}»* испуганно отступает, цепляясь за углы и выступы свода. Тени ${actingChar.name} и ${companion.name} пляшут на каменных стенах, выхватывая из полумрака застарелые царапины, выщербины от древних клинков и вырезанные в граните знаки.\n\nТам, куда падает теплый отсвет огня, на поверхности проступают древние клинописные символы. ${hasPoison ? `\n\n*Головокружение от яда на мгновение заставляет символы двоиться перед глазами ${actingChar.name}, но упорство берет верх.*` : ''}\n\n*Желаете подойти ближе и попробовать разобрать письмена, или осмотреть периметр?*`;
    return { cleanContent, reasoning, dmMood };
  }
  if (lower.includes('саркофаг') || lower.includes('гробниц') || lower.includes('сундук') || lower.includes('письмен') || lower.includes('надпис')) {
    dmMood = 'mystery';
    cleanContent = `${actingChar.name} осторожно приближается к массивному каменному монолиту. Вековая плита покрыта толстым слоем сизого налета и застывшей копоти.\n\nПроведя кончиками пальцев по шероховатому граниту, ты ощущаешь могильный холод, пробирающий сквозь перчатки. На сколе крышки отчетливо различим барельеф короны, обвитой шипами терновника, и полустертая предупреждающая эпитафия на древнем наречии.\n\n${companion.name !== actingChar.name ? `${companion.name} внимательно оглядывает пол вокруг саркофага, выискивая скрытые нажимные плиты или растяжки ловушек.` : ''}\n\n*Каково будет ваше решение: попытаться сдвинуть крышку, исследовать руны на предмет ловушек или позвать на помощь спутника?*`;
    return { cleanContent, reasoning, dmMood };
  }
  if (lower.includes('атак') || lower.includes('удар') || lower.includes('выстрел') || lower.includes('стреля') || lower.includes('клинок') || lower.includes('меч') || lower.includes('молот')) {
    dmMood = 'combat';
    cleanContent = `Воздух звенит от натянутого напряжения! ${actingChar.name} молниеносно занимает боевую стойку, вскидывая оружие. \n\nВ локации *«${loc}»* каждое эхо звучит угрожающе. ${companion.name !== actingChar.name ? `${companion.name} немедленно переходит на фланг, перекрывая линию возможного удара противника.` : ''}\n\nПеред вами обозначается цель: враждебное присутствие подает признаки движения в полумраке, готовое к немедленной схватке.\n\n*Бой начался! Сделайте заявку на атаку или тактический маневр.*`;
    return { cleanContent, reasoning, dmMood };
  }
  if (lower.includes('говор') || lower.includes('спрашива') || lower.includes('крич') || lower.includes('зовут') || lower.includes('"') || lower.includes('«')) {
    dmMood = 'neutral';
    cleanContent = `Слова ${actingChar.name} раздаются под каменными сводами локации *«${loc}»*, нарушая зловещую тишину.\n\n${companion.name !== actingChar.name ? `${companion.name} внимательно следит за реакцией теней вокруг, готовый вмешаться в разговор при малейшей угрозе.` : ''}\n\nВ ответ из темноты доносится низкий шорох. Некто затаившийся слушает каждую вашу фразу, взвешивая силу и уверенность в голосе отряда.\n\n*Как ${actingChar.name} намеревается продолжить беседу?*`;
    return { cleanContent, reasoning, dmMood };
  }
  cleanContent = `${actingChar.name} приступает к действию в локации *«${loc}»*.\n\nВаше решение («${text}») мгновенно меняет динамику происходящего. Окружение отзывается глухим гулом сквозняка, несущего запах древней магии и сырости.\n\n${companion.name !== actingChar.name ? `Рядом ${companion.name} страхует тыл отряда, наблюдая за каждым шагом соратника.` : ''}\n\n*Dungeon Master:* Обстановка накаляется. Что отряд намеревается сделать в следующее мгновение?`;
  return { cleanContent, reasoning, dmMood };
}

function errorMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const error = (data as { error?: unknown }).error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return undefined;
}

async function postJson(url: string, payload: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 130_000);
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
    const raw = await response.text();
    let data: unknown;
    try { data = JSON.parse(raw); } catch {
      throw new Error(`Сервер приложения вернул не JSON (HTTP ${response.status}). Запустите приложение через npm run dev и проверьте адрес API.`);
    }
    const reportedError = errorMessage(data);
    if (!response.ok || reportedError) throw new Error(reportedError || `Ошибка API: HTTP ${response.status}`);
    return data;
  } catch (error: unknown) {
    if (controller.signal.aborted) throw new Error('Превышено время ожидания ответа (130 секунд). Запрос отменён; автоматический повтор отключён.');
    if (error instanceof TypeError) throw new Error('Не удалось связаться с сервером приложения. Проверьте, что он запущен и доступен.');
    throw error;
  } finally { clearTimeout(timer); }
}

function requireNarrative(rawText: unknown): ParsedAiResponse {
  if (typeof rawText !== 'string' || !rawText.trim()) throw new Error('Модель вернула пустой ответ или неподдерживаемый формат сообщения.');
  const parsed = parseAiResponse(rawText);
  if (!parsed.cleanContent.trim()) throw new Error('Ответ модели содержит только служебные теги, без повествования. Увеличьте лимит ответа или повторите генерацию.');
  return parsed;
}

// messages contains preceding history only; userMessage is appended exactly once.
export async function generateDmTurn(
  campaign: Campaign, players: Character[], allLore: LoreEntity[], messages: ChatMessage[], settings: ModelSettings,
  userMessage: string, activeSlot: 'A' | 'B' | 'C' | 'D' | 'SIMULTANEOUS' = 'A', rollOutcomeContext?: string
): Promise<ParsedAiResponse> {
  const { hotEntities } = retrieveRelevantLoreEntities(allLore, messages.slice(-4).map((m) => m.content).join(' '), userMessage, campaign.currentLocation, 4);
  const systemInstruction = buildSystemPrompt(campaign, players, hotEntities, settings, activeSlot, rollOutcomeContext);
  if (settings.provider === 'simulator') {
    if (settings.simulatedDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, settings.simulatedDelayMs));
    return generateSimulatedDmResponse(userMessage, campaign, players, hotEntities, messages, settings, activeSlot);
  }
  const conversationHistory = messages.slice(-10).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user', content: m.speakerName ? `${m.speakerName}: ${m.content}` : m.content,
  }));
  conversationHistory.push({ role: 'user', content: userMessage });
  if (settings.provider === 'gemini') {
    const data = await postJson('/api/gemini/chat', {
      apiKey: settings.apiKey || undefined, model: settings.modelName || 'gemini-3.8-flash',
      systemInstruction, contents: conversationHistory, temperature: settings.temperature, maxOutputTokens: settings.maxTokens,
    });
    return requireNarrative(data && typeof data === 'object' && 'text' in data ? data.text : undefined);
  }
  if (settings.provider === 'lmstudio' || settings.provider === 'ollama' || settings.provider === 'openai' || settings.provider === 'openrouter' || settings.provider === 'custom') {
    const endpoint = (settings.endpointUrl || (settings.provider === 'lmstudio' ? 'http://localhost:1234/v1' : 'http://localhost:11434/v1')).trim().replace(/\/+$/, '');
    const targetChatUrl = endpoint.endsWith('/chat/completions') ? endpoint : `${endpoint}/chat/completions`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
    const data = await postJson('/api/proxy/llm', { targetUrl: targetChatUrl, headers, body: {
      model: settings.modelName || 'default', messages: [{ role: 'system', content: systemInstruction }, ...conversationHistory],
      temperature: settings.temperature, max_tokens: settings.maxTokens,
      frequency_penalty: settings.frequencyPenalty, presence_penalty: settings.presencePenalty,
    } });
    const completion = data as { choices?: Array<{ message?: { content?: unknown } }> } | null;
    return requireNarrative(completion?.choices?.[0]?.message?.content);
  }
  throw new Error(`Неподдерживаемый провайдер модели: ${settings.provider}. Выберите провайдер в настройках.`);
}
