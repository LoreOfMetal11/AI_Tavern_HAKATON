import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getModifier,
  formatModifier,
  evaluateCheck,
  assessActionForCheck,
  retrieveRelevantLoreEntities,
  DND_CONDITIONS_CATALOG,
} from './rules.ts';
import { LoreEntity } from '../types/dnd.ts';

describe('D&D 5e Core Rules & Math', () => {
  it('correctly calculates ability modifiers for standard ability scores', () => {
    assert.equal(getModifier(10), 0);
    assert.equal(getModifier(11), 0);
    assert.equal(getModifier(12), 1);
    assert.equal(getModifier(14), 2);
    assert.equal(getModifier(16), 3);
    assert.equal(getModifier(18), 4);
    assert.equal(getModifier(20), 5);
    assert.equal(getModifier(8), -1);
    assert.equal(getModifier(6), -2);
    assert.equal(getModifier(1), -5);
  });

  it('formats modifiers with proper +/- sign', () => {
    assert.equal(formatModifier(3), '+3');
    assert.equal(formatModifier(0), '+0');
    assert.equal(formatModifier(-2), '-2');
  });

  it('correctly evaluates check vs DC and handles critical successes and fails', () => {
    // Normal pass
    assert.equal(evaluateCheck({ natural: 14, modifier: 2, total: 16, isCritSuccess: false, isCritFail: false }, 15).passed, true);
    // Normal fail
    assert.equal(evaluateCheck({ natural: 9, modifier: 2, total: 11, isCritSuccess: false, isCritFail: false }, 15).passed, false);
    // Crit success override
    assert.equal(evaluateCheck({ natural: 20, modifier: -2, total: 18, isCritSuccess: true, isCritFail: false }, 25).passed, true);
    // Crit fail override
    assert.equal(evaluateCheck({ natural: 1, modifier: 15, total: 16, isCritSuccess: false, isCritFail: true }, 10).passed, false);
  });
});

describe('Action Assessment for Pre-Check Flow', () => {
  it('identifies risky physical actions requiring Athletics check', () => {
    const res = assessActionForCheck('Я пытаюсь выбить тяжелую дубовую дверь плечом', null, null);
    assert.equal(res.requiresCheck, true);
    assert.equal(res.stat, 'STR');
    assert.equal(res.skillName, 'Атлетика');
    assert.ok(res.dc && res.dc >= 10);
  });

  it('identifies lockpicking actions requiring Sleight of Hand check', () => {
    const res = assessActionForCheck('Достаю воровские инструменты и тихо взламываю замок сундука', null, null);
    assert.equal(res.requiresCheck, true);
    assert.equal(res.stat, 'DEX');
    assert.equal(res.skillName, 'Ловкость рук');
    assert.ok(res.dc && res.dc >= 12);
  });

  it('identifies stealth actions requiring Stealth check', () => {
    const res = assessActionForCheck('Крадусь по теням мимо дремлющих стражников', null, null);
    assert.equal(res.requiresCheck, true);
    assert.equal(res.stat, 'DEX');
    assert.equal(res.skillName, 'Скрытность');
  });

  it('does NOT require checks for standard conversations, observations, or peaceful actions', () => {
    const dialogueRes = assessActionForCheck('Здравствуйте, почтенный трактирщик, налейте кружку темного эля', null, null);
    assert.equal(dialogueRes.requiresCheck, false);

    const lookRes = assessActionForCheck('Оглядываю зал таверны и сажусь за свободный столик у камина', null, null);
    assert.equal(lookRes.requiresCheck, false);

    const drinkRes = assessActionForCheck('Допиваю свой напиток и жду спутника', null, null);
    assert.equal(drinkRes.requiresCheck, false);
  });
});

describe('Cold Database vs Hot Memory Separation', () => {
  const mockLore: LoreEntity[] = [
    {
      id: 'lore-1',
      campaignId: 'camp-1',
      type: 'location',
      name: 'Зал Саркофагов',
      summary: 'Древний зал со склепами',
      details: 'Детали зала...',
      triggerKeywords: ['саркофаг', 'зал саркофагов', 'склеп'],
      activationMode: 'always',
      isAutoMutable: false,
    },
    {
      id: 'lore-2',
      campaignId: 'camp-1',
      type: 'item',
      name: 'Клинок Вечного Льда',
      summary: 'Магический меч с морозным свечением',
      details: 'Наносит 1d8 рубящего + 1d6 холода',
      triggerKeywords: ['клинок', 'лед', 'вечный лед'],
      activationMode: 'trigger',
      isAutoMutable: false,
    },
    {
      id: 'lore-3',
      campaignId: 'camp-1',
      type: 'npc',
      name: 'Верховный Лич Малакор',
      summary: 'Повелитель катакомб',
      details: 'Древний владыка нежити',
      triggerKeywords: ['малакор', 'лич'],
      activationMode: 'trigger',
      isAutoMutable: false,
    },
  ];

  it('correctly keeps non-triggered entities in cold database storage', () => {
    // When text mentions only the sword, Malakor should remain cold!
    const { hotEntities, coldEntities } = retrieveRelevantLoreEntities(
      mockLore,
      '',
      'Я обнажаю свой клинок и готовлюсь к битве',
      'Зал Саркофагов'
    );

    const hotNames = hotEntities.map((e) => e.name);
    const coldNames = coldEntities.map((e) => e.name);

    assert.ok(hotNames.includes('Зал Саркофагов')); // always
    assert.ok(hotNames.includes('Клинок Вечного Льда')); // triggered by 'клинок'
    assert.ok(coldNames.includes('Верховный Лич Малакор')); // NOT mentioned -> stays cold in DB!
  });
});

describe('D&D Conditions Catalog', () => {
  it('contains core D&D 5e conditions with Russian names and mechanical effects', () => {
    assert.ok(DND_CONDITIONS_CATALOG.length >= 10);
    const poison = DND_CONDITIONS_CATALOG.find((c) => c.type === 'poisoned');
    assert.ok(poison);
    assert.ok(poison.nameRu.includes('Отравлен'));
    assert.ok(poison.mechanicalEffectRu.includes('Помеха'));

    const exhaustion = DND_CONDITIONS_CATALOG.find((c) => c.type === 'exhaustion');
    assert.ok(exhaustion);
    assert.ok(exhaustion.nameRu.includes('Истощение'));
    assert.ok(exhaustion.mechanicalEffectRu.includes('Ур. 1'));
  });
});
