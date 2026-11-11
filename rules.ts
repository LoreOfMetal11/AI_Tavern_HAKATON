import {
  AbilityScores,
  StatName,
  LoreEntity,
  ChatMessage,
  ModelSettings,
  CampaignHistoryEntry,
  ConditionType,
  ActiveCondition,
  Character,
  Campaign,
  PreCheckAssessment,
} from '../types/dnd';

export const DND_SKILLS: Array<{ key: string; nameRu: string; nameEn: string; stat: StatName }> = [
  { key: 'athletics', nameRu: 'Атлетика', nameEn: 'Athletics', stat: 'STR' },
  { key: 'acrobatics', nameRu: 'Акробатика', nameEn: 'Acrobatics', stat: 'DEX' },
  { key: 'sleightOfHand', nameRu: 'Ловкость рук', nameEn: 'Sleight of Hand', stat: 'DEX' },
  { key: 'stealth', nameRu: 'Скрытность', nameEn: 'Stealth', stat: 'DEX' },
  { key: 'arcana', nameRu: 'Магия', nameEn: 'Arcana', stat: 'INT' },
  { key: 'history', nameRu: 'История', nameEn: 'History', stat: 'INT' },
  { key: 'investigation', nameRu: 'Анализ', nameEn: 'Investigation', stat: 'INT' },
  { key: 'nature', nameRu: 'Природа', nameEn: 'Nature', stat: 'INT' },
  { key: 'religion', nameRu: 'Религия', nameEn: 'Religion', stat: 'INT' },
  { key: 'animalHandling', nameRu: 'Уход за животными', nameEn: 'Animal Handling', stat: 'WIS' },
  { key: 'insight', nameRu: 'Проницательность', nameEn: 'Insight', stat: 'WIS' },
  { key: 'medicine', nameRu: 'Медицина', nameEn: 'Medicine', stat: 'WIS' },
  { key: 'perception', nameRu: 'Внимательность', nameEn: 'Perception', stat: 'WIS' },
  { key: 'survival', nameRu: 'Выживание', nameEn: 'Survival', stat: 'WIS' },
  { key: 'deception', nameRu: 'Обман', nameEn: 'Deception', stat: 'CHA' },
  { key: 'intimidation', nameRu: 'Запугивание', nameEn: 'Intimidation', stat: 'CHA' },
  { key: 'performance', nameRu: 'Выступление', nameEn: 'Performance', stat: 'CHA' },
  { key: 'persuasion', nameRu: 'Убеждение', nameEn: 'Persuasion', stat: 'CHA' },
];

/**
 * Calculates standard D&D 5e attribute modifier: floor((score - 10) / 2)
 */
export function getModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/**
 * Rolls random number between 1 and sides
 */
export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export interface RollResult {
  natural: number;
  modifier: number;
  total: number;
  isCritSuccess: boolean;
  isCritFail: boolean;
}

export function rollD20(modifier: number = 0): RollResult {
  const natural = rollDie(20);
  return {
    natural,
    modifier,
    total: natural + modifier,
    isCritSuccess: natural === 20,
    isCritFail: natural === 1,
  };
}

/**
 * Evaluates whether an ability check succeeded against a DC
 */
export function evaluateCheck(roll: RollResult, dc: number): { passed: boolean; margin: number } {
  if (roll.isCritSuccess) return { passed: true, margin: 99 };
  if (roll.isCritFail) return { passed: false, margin: -99 };
  const passed = roll.total >= dc;
  return { passed, margin: roll.total - dc };
}

/**
 * Approximate token count (1 token ~= 3.5 chars for Russian/Cyrillic or 4 chars for English)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Cyrillic letters often take ~1 token per 2-3 characters in UTF-8 BPE tokenizers
  const cyrillicMatch = text.match(/[\u0400-\u04FF]/g);
  const cyrillicRatio = cyrillicMatch ? cyrillicMatch.length / text.length : 0;
  const charsPerToken = cyrillicRatio > 0.4 ? 2.5 : 3.8;
  return Math.ceil(text.length / charsPerToken);
}



export interface ConditionCatalogItem {
  type: ConditionType;
  nameRu: string;
  badgeColor: string;
  borderColor: string;
  descriptionRu: string;
  mechanicalEffectRu: string;
}

export const DND_CONDITIONS_CATALOG: ConditionCatalogItem[] = [
  {
    type: 'poisoned',
    nameRu: 'Отравлен (Poisoned)',
    badgeColor: 'bg-emerald-950/80 text-emerald-300',
    borderColor: 'border-emerald-600/60',
    descriptionRu: 'Яд или токсин циркулирует в крови, вызывая боль, тошноту и слабость.',
    mechanicalEffectRu: 'Помеха на броски атаки и проверки любых характеристик.',
  },
  {
    type: 'exhaustion',
    nameRu: 'Истощение (Exhaustion)',
    badgeColor: 'bg-amber-950/80 text-amber-300',
    borderColor: 'border-amber-600/60',
    descriptionRu: 'Критическая физическая усталость от голода, холода или бессонницы.',
    mechanicalEffectRu: 'Ур. 1: Помеха на проверки; Ур. 2: Скорость вдвое; Ур. 3: Помеха на атаки/спасы; Ур. 4: Макс. хиты вдвое; Ур. 5: Скорость 0; Ур. 6: Смерть.',
  },
  {
    type: 'frightened',
    nameRu: 'Испуган (Frightened)',
    badgeColor: 'bg-purple-950/80 text-purple-300',
    borderColor: 'border-purple-600/60',
    descriptionRu: 'Панический ужас сковывает волю перед лицом неодолимого кошмара.',
    mechanicalEffectRu: 'Помеха на проверки и атаки, пока источник страха в поле зрения. Не может добровольно приближаться к источнику страха.',
  },
  {
    type: 'blinded',
    nameRu: 'Ослеплен (Blinded)',
    badgeColor: 'bg-stone-900 text-stone-300',
    borderColor: 'border-stone-600/60',
    descriptionRu: 'Существо ничего не видит и автоматически проваливает проверки зрения.',
    mechanicalEffectRu: 'Броски атаки против существа с преимуществом; атаки существа — с помехой.',
  },
  {
    type: 'charmed',
    nameRu: 'Очарован (Charmed)',
    badgeColor: 'bg-pink-950/80 text-pink-300',
    borderColor: 'border-pink-600/60',
    descriptionRu: 'Магическое подчинение или глубокая симпатия к источнику чар.',
    mechanicalEffectRu: 'Не может атаковать пленителя; пленитель совершает проверки общения с преимуществом.',
  },
  {
    type: 'paralyzed',
    nameRu: 'Парализован (Paralyzed)',
    badgeColor: 'bg-rose-950/80 text-rose-300',
    borderColor: 'border-rose-600/60',
    descriptionRu: 'Мышцы окаменели, тело неподвижно и беспомощно.',
    mechanicalEffectRu: 'Недееспособен, не может двигаться/говорить. Проваливает спасброски Силы/Ловкости. Атаки по существу с преимуществом, удары в упор — криты.',
  },
  {
    type: 'prone',
    nameRu: 'Сбит с ног (Prone)',
    badgeColor: 'bg-orange-950/80 text-orange-300',
    borderColor: 'border-orange-600/60',
    descriptionRu: 'Персонаж лежит на земле после падения, удара или подсечки.',
    mechanicalEffectRu: 'Может только ползти (вдвое медленнее) или встать за половину скорости. Помеха на атаки; атаки в упор по существу с преимуществом.',
  },
  {
    type: 'restrained',
    nameRu: 'Опутан (Restrained)',
    badgeColor: 'bg-yellow-950/80 text-yellow-300',
    borderColor: 'border-yellow-600/60',
    descriptionRu: 'Связан веревками, опутан паутиной или захвачен щупальцами.',
    mechanicalEffectRu: 'Скорость равна 0. Помеха на атаки и спасброски Ловкости. Атаки по существу с преимуществом.',
  },
  {
    type: 'stunned',
    nameRu: 'Ошеломлен (Stunned)',
    badgeColor: 'bg-cyan-950/80 text-cyan-300',
    borderColor: 'border-cyan-600/60',
    descriptionRu: 'Оглушающий удар по голове или шоковое ментальное воздействие.',
    mechanicalEffectRu: 'Недееспособен, говорит сбивчиво, проваливает спасброски Силы/Ловкости. Атаки по существу с преимуществом.',
  },
  {
    type: 'unconscious',
    nameRu: 'Без сознания (Unconscious)',
    badgeColor: 'bg-red-950/90 text-red-200',
    borderColor: 'border-red-600/70',
    descriptionRu: 'Глубокий нокаут или потеря сознания при падении хитов до 0.',
    mechanicalEffectRu: 'Недееспособен, роняет все предметы, падает ничком. Автоматический провал спасов Силы/Ловкости. Криты при ударах в упор.',
  },
  {
    type: 'invisible',
    nameRu: 'Невидим (Invisible)',
    badgeColor: 'bg-indigo-950/80 text-indigo-300',
    borderColor: 'border-indigo-600/60',
    descriptionRu: 'Полная оптическая или арканная невидимость.',
    mechanicalEffectRu: 'Невозможно обнаружить зрением без магии. Атаки персонажа с преимуществом; атаки по персонажу с помехой.',
  },
];

/**
 * Separate cold database from hot active memory (Smart RAG / Trigger Filter)
 * Cold memory remains archived in DB, never cluttering prompt tokens!
 */
export function retrieveRelevantLoreEntities(
  allEntities: LoreEntity[],
  recentText: string,
  userMessage: string,
  campaignLocation?: string,
  maxHotEntities: number = 4
): { hotEntities: LoreEntity[]; coldEntities: LoreEntity[] } {
  const combinedText = `${recentText} ${userMessage}`.toLowerCase();
  const locationNormalized = (campaignLocation || '').toLowerCase().trim();

  const scored = allEntities
    .filter((e) => e.activationMode !== 'disabled')
    .map((entity) => {
      let score = 0;
      const entityName = entity.name.toLowerCase();

      // Always active mode
      if (entity.activationMode === 'always') score += 100;

      // Direct location match
      if (entity.type === 'location' && locationNormalized && (entityName.includes(locationNormalized) || locationNormalized.includes(entityName))) {
        score += 80;
      }

      // Direct name match in user or recent text
      if (combinedText.includes(entityName)) {
        score += 70;
      }

      // Trigger keywords match
      const kwMatches = entity.triggerKeywords.filter((kw) => {
        if (!kw || kw.trim().length === 0) return false;
        return combinedText.includes(kw.trim().toLowerCase());
      });
      score += kwMatches.length * 35;

      // Quests currently in progress
      if (entity.type === 'quest' && combinedText.includes('квест') || combinedText.includes('задани') || combinedText.includes('цель')) {
        score += 40;
      }

      // Logic semantic overlap
      if (entity.activationMode === 'logic') {
        const words = entity.summary.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
        const matchCount = words.filter((w) => combinedText.includes(w)).length;
        score += matchCount * 15;
      }

      return { entity, score };
    });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  const hotEntities: LoreEntity[] = [];
  const coldEntities: LoreEntity[] = [];

  for (const item of scored) {
    if (item.score >= 35 && hotEntities.length < maxHotEntities) {
      hotEntities.push(item.entity);
    } else {
      coldEntities.push(item.entity);
    }
  }

  // Also put any remaining disabled or un-scored entities into cold
  allEntities.forEach((e) => {
    if (!hotEntities.includes(e) && !coldEntities.includes(e)) {
      coldEntities.push(e);
    }
  });

  return { hotEntities, coldEntities };
}

/**
 * Backward-compatible helper that delegates to smart retriever
 */
export function getActiveLoreEntities(
  entities: LoreEntity[],
  recentText: string,
  userMessage: string
): LoreEntity[] {
  const { hotEntities } = retrieveRelevantLoreEntities(entities, recentText, userMessage);
  return hotEntities;
}

/**
 * Evaluates whether an action requires a D&D 5e ability check BEFORE generating narrative prose!
 * If action is safe or just dialogue -> false (no rolling needed, writes directly).
 * If action has meaningful risk / opposition -> returns check parameters.
 */
export function assessActionForCheck(
  userText: string,
  actingChar?: Character | null,
  campaign?: Campaign | null,
  hotLore?: LoreEntity[]
): PreCheckAssessment {
  const text = (userText || '').toLowerCase();

  // If already submitting a dice roll result or explicit narrative skip, NEVER trigger another check!
  if (
    text.includes('[бросок кубика') ||
    text.includes('результат проверки') ||
    text.includes('результат броска') ||
    text.includes('итог кости') ||
    text.includes('против dc') ||
    text.includes('vs dc') ||
    text.includes('пропуск броска') ||
    text.includes('без броска кости')
  ) {
    return {
      requiresCheck: false,
      reason: 'Действие содержит результат завершенной проверки или пропуск.',
    };
  }

  // Check for Lockpicking / Sleight of Hand
  if (
    text.includes('взлом') ||
    text.includes('отмычк') ||
    text.includes('вскры') ||
    text.includes('шпильк') ||
    (text.includes('замок') && (text.includes('открыть') || text.includes('подобрать') || text.includes('сундук')))
  ) {
    const isProf = !!actingChar?.skills?.['sleightOfHand'];
    return {
      requiresCheck: true,
      stat: 'DEX',
      skillName: 'Ловкость рук',
      dc: 14,
      description: `Взлом механизма замка [Ловкость рук (DEX)] · Сл 14`,
      reason: 'Действие связано со вскрытием сложного чугунного механизма с риском поломки отмычки или шума.',
    };
  }

  // Check for Stealth / Sneaking
  if (
    text.includes('крад') ||
    text.includes('скрыт') ||
    text.includes('бесшумн') ||
    text.includes('пряч') ||
    text.includes('в тени') ||
    text.includes('прокрасться')
  ) {
    return {
      requiresCheck: true,
      stat: 'DEX',
      skillName: 'Скрытность',
      dc: 13,
      description: `Скрытное перемещение мимо дозора [Скрытность (DEX)] · Сл 13`,
      reason: 'Попытка преодолеть охраняемый сектор без поднятия тревоги.',
    };
  }

  // Check for Athletics / Brute Force / Climb / Jump
  if (
    text.includes('выби') && text.includes('двер') ||
    text.includes('таран') ||
    text.includes('лома') ||
    text.includes('карабка') ||
    text.includes('перепрыг') ||
    text.includes('поднима') && text.includes('тяжест')
  ) {
    return {
      requiresCheck: true,
      stat: 'STR',
      skillName: 'Атлетика',
      dc: 14,
      description: `Силовое преодоление препятствия [Атлетика (STR)] · Сл 14`,
      reason: 'Физическое усилие на пределе возможностей с риском сорваться или нанести шум.',
    };
  }

  // Check for Arcana / Deciphering Magic Runes
  if (
    text.includes('рун') ||
    text.includes('магическ') ||
    text.includes('заклинател') ||
    text.includes('аур') ||
    text.includes('символ') && text.includes('древн')
  ) {
    return {
      requiresCheck: true,
      stat: 'INT',
      skillName: 'Магия',
      dc: 14,
      description: `Расшифровка арканных знаков [Магия (INT)] · Сл 14`,
      reason: 'Понимание забытой магии или древней рунной печати.',
    };
  }

  // Check for Deception / Persuasion / Intimidation in tense dialogue
  if (
    (text.includes('лгу') || text.includes('обманыва') || text.includes('притворя'))
  ) {
    return {
      requiresCheck: true,
      stat: 'CHA',
      skillName: 'Обман',
      dc: 13,
      description: `Попытка дезинформации [Обман (CHA)] · Сл 13`,
      reason: 'Ложь подозрительному собеседнику или стражнику.',
    };
  }

  if (
    text.includes('угрожа') ||
    text.includes('запугива') ||
    text.includes('прижимаю к стенке')
  ) {
    return {
      requiresCheck: true,
      stat: 'CHA',
      skillName: 'Запугивание',
      dc: 14,
      description: `Давление авторитетом и страхом [Запугивание (CHA)] · Сл 14`,
      reason: 'Попытка подавить волю противника.',
    };
  }

  if (
    (text.includes('убеждаю') || text.includes('уговарива') || text.includes('прошу пропустить')) &&
    (text.includes('страж') || text.includes('сержант') || text.includes('враг') || text.includes('трактирщик'))
  ) {
    return {
      requiresCheck: true,
      stat: 'CHA',
      skillName: 'Убеждение',
      dc: 13,
      description: `Дипломатическое убеждение [Убеждение (CHA)] · Сл 13`,
      reason: 'Попытка склонить настороженного собеседника на свою сторону.',
    };
  }

  // Default: Pure dialogue, observation, resting, walking -> NO ROLL REQUIRED!
  return {
    requiresCheck: false,
    reason: 'Обычное действие без критического риска провала. Разрешается мастером напрямую.',
  };
}

/**
 * Synthesizes dynamic Web Audio sound effects (dice rolls, crits, button clacks)
 * Uses browser Web Audio API oscillator - zero external files or CDN dependencies!
 */
export function playSoundEffect(type: 'dice' | 'crit' | 'fail' | 'click') {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'dice') {
      // Rattle sound of rolling dice
      const count = 4;
      for (let i = 0; i < count; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140 + Math.random() * 180, ctx.currentTime + i * 0.06);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.06);
        osc.stop(ctx.currentTime + i * 0.06 + 0.06);
      }
    } else if (type === 'crit') {
      // Fanfare chord for critical success
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.05);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.05 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.05);
        osc.stop(ctx.currentTime + idx * 0.05 + 0.55);
      });
    } else if (type === 'fail') {
      // Low ominous thud for critical fail
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else {
      // Subtle click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.03);
    }
  } catch {
    // Ignore audio context errors if browser blocks autoplay
  }
}
