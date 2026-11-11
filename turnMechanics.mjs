export function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function hasDamage(message) {
  return Array.isArray(message?.damageEvents) && message.damageEvents.length > 0;
}

export function extractDamage(raw) {
  const events = [];
  const cleanContent = raw.replace(/<damage_event>([\s\S]*?)<\/damage_event>/gi, (_, json) => {
    let value;
    try { value = JSON.parse(json); } catch { throw new Error('Модель вернула некорректный JSON события урона. HP не изменены.'); }
    events.push(value);
    return '';
  });
  if (/<\/?damage_event\b/i.test(cleanContent)) throw new Error('Модель оборвала событие урона. HP не изменены.');
  return { events, cleanContent: cleanContent.trim() };
}

export function prepareDamage(events, party, sources, action, turnId) {
  if (!Array.isArray(events) || events.length > party.length) throw new Error('Некорректное число событий урона.');
  if (!events.length) return [];
  if (/[?？]|что\s+будет|если\s+(?:я|мы)|\bif\b|не\s+(?:касаюсь|опускаю|прыгаю|вхожу|трогаю)/iu.test(action)) {
    throw new Error('Урон предложен для вопроса, отрицания или условного действия. Требуется уточнение; HP не изменены.');
  }
  const seen = new Set();
  return events.map((event) => {
    if (!event || typeof event !== 'object') throw new Error('Неверный формат события урона.');
    const character = party.find((p) => p.id === event.characterId);
    if (!character || !character.isPlayer) throw new Error('Урон направлен на персонажа вне текущей партии.');
    if (seen.has(character.id)) throw new Error('Повторное событие урона одному персонажу в одном ходе.');
    seen.add(character.id);
    if (!Number.isSafeInteger(event.amount) || event.amount < 1 || event.amount > 1000) throw new Error('Некорректная величина урона.');
    if (typeof event.reason !== 'string' || !event.reason.trim() || event.reason.length > 600) throw new Error('Для урона не указана корректная причина.');
    const source = sources.find((s) => s.id === event.sourceId);
    if (!source || typeof event.sourceQuote !== 'string' || event.sourceQuote.trim().length < 8 || !source.text.includes(event.sourceQuote)) {
      throw new Error('Источник урона не подтверждён текущей сценой. HP не изменены.');
    }
    if (typeof event.actionQuote !== 'string' || event.actionQuote.trim().length < 8 || !action.includes(event.actionQuote)) {
      throw new Error('Урон не связан с текущим действием. HP не изменены.');
    }
    const lava = /(?<!\p{L})лав(?:а|у|ы|е|ой)(?!\p{L})/iu;
    if (lava.test(action) && (!lava.test(event.sourceQuote) || /нет\s+лав|лав\p{L}*\s+(?:нет|отсутств)|без\s+лав/iu.test(event.sourceQuote))) {
      throw new Error('Контакт с лавой заявлен, но лава не подтверждена источником сцены. HP не изменены.');
    }
    if (!Number.isFinite(character.hpCurrent) || !Number.isFinite(character.hpMax) || character.hpMax < 1) throw new Error('Некорректные HP персонажа.');
    return { id: `${turnId}:${character.id}`, characterId: character.id, amount: event.amount,
      reason: event.reason.trim(), sourceId: event.sourceId, sourceQuote: event.sourceQuote, actionQuote: event.actionQuote };
  });
}

export function applyDamage(character, event) {
  if (character.id !== event.characterId) return character;
  const hpCurrent = Math.max(0, Math.min(character.hpMax, character.hpCurrent - event.amount));
  return { ...character, hpCurrent };
}

export function damageSources(campaign, lore, history) {
  return [
    { id: 'scene', text: [campaign.currentLocation, campaign.description, ...(campaign.pinnedFacts || [])].join('\n') },
    ...lore.filter((e) => e.activationMode !== 'disabled').map((e) => ({ id: e.id, text: [e.name, e.summary, e.details, e.lastUpdatedNotes || ''].join('\n') })),
    ...history.filter((m) => m.role === 'assistant').slice(-4).map((m) => ({ id: m.id, text: m.content })),
  ];
}

export const DAMAGE_PROTOCOL = `
ПРИОРИТЕТ ТЕКУЩЕГО ДЕЙСТВИЯ:
Отвечай на последнее сообщение, не заменяй его старым планом. Прикасание к опасности не является скрытностью.
Отличай действие от отрицания, цитаты, вопроса и гипотезы. Не добавляй героям действий и не объявляй им автоматический успех.
Не выдумывай лаву, кислоту, врагов или ловушки ради наказания. Если заявленного объекта нет в установленной сцене — уточни несоответствие; урона пока нет.
Если контакт с существующей опасностью уже произошёл, опиши последствия. Ненужная проверка скрытности не отменяет контакт.
МЕХАНИЧЕСКИЙ УРОН:
При реально разрешённом в этом ходе уроне добавь для каждого пострадавшего героя один тег:
<damage_event>{"characterId":"точный ID героя","amount":5,"reason":"конкретная причина и расчёт урона","sourceId":"ID источника из списка","sourceQuote":"дословная цитата источника","actionQuote":"дословная цитата последнего действия"}</damage_event>
5 — пример формата, не фиксированное правило. amount — итоговый положительный целый урон после применимых защит; не текущее HP.
Используй только переданные ID, установленные факты и разрешённые результаты проверок. Если исход атаки/спасброска ещё неизвестен, сначала запроси проверку, не применяй предполагаемый урон.
Не дублируй урон из прошлых сообщений. Одно событие на героя в ходе; несколько воздействий суммируй с объяснением.
Для вопросов, предположений, невозможных действий и отсутствующих опасностей тег не выдавай.
Не описывай числовой урон без соответствующего тега. При нуле HP не объявляй автоматическую смерть: полные правила смерти здесь ещё не реализованы.
`;
