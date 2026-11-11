import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareDamage, applyDamage, extractDamage, hasDamage, makeId } from './turnMechanics.mjs';
const hero = { id: 'hero-a', isPlayer: true, hpCurrent: 20, hpMax: 20 };
const action = 'Опускаю руку в лаву';
const sources = [{ id: 'lava-room', text: 'В центре зала находится бассейн раскалённой лавы.' }];
const event = { characterId: hero.id, amount: 7, reason: 'Контакт с лавой', sourceId: 'lava-room', sourceQuote: sources[0].text, actionQuote: action };
test('confirmed event changes HP, does not mutate original', () => {
  const [resolved] = prepareDamage([event], [hero], sources, action, 'turn-1');
  assert.equal(applyDamage(hero, resolved).hpCurrent, 13);
  assert.equal(hero.hpCurrent, 20);
  assert.equal(resolved.id, 'turn-1:hero-a');
});
test('missing lava in citadel cannot validate a lava-room source', () => {
  assert.throws(() => prepareDamage([event], [hero], [{ id: 'scene', text: 'Врата цитадели охраняет караул.' }], action, 'turn-2'));
});
test('questions and negated contact do not apply damage', () => {
  for (const text of ['Что будет, если я опущу руку в лаву?', 'Я не опускаю руку в лаву']) {
    assert.throws(() => prepareDamage([{ ...event, actionQuote: text }], [hero], sources, text, 'turn-3'));
  }
});
test('wrong target, duplicate target, fabricated quote, invalid amount rejected', () => {
  const variants = [{ ...event, characterId: 'another-party' }, { ...event, amount: -1 }, { ...event, amount: 2.5 }, { ...event, amount: Infinity }, { ...event, sourceQuote: 'Несуществующий источник лавы' }];
  for (const value of variants) assert.throws(() => prepareDamage([value], [hero], sources, action, 'turn-4'));
  assert.throws(() => prepareDamage([event, event], [hero, { ...hero, id: 'hero-b' }], sources, action, 'turn-4'));
});
test('HP never becomes negative', () => {
  assert.equal(applyDamage(hero, { ...event, amount: 100 }).hpCurrent, 0);
});
test('metadata is removed from prose and parsed', () => {
  const result = extractDamage('Ожог.\n<damage_event>' + JSON.stringify(event) + '</damage_event>');
  assert.equal(result.cleanContent, 'Ожог.');
  assert.equal(result.events[0].amount, 7);
  assert.throws(() => extractDamage('<damage_event>{bad}</damage_event>'));
  assert.throws(() => extractDamage('<damage_event>{'));
});
test('journal marker and stable per-turn event IDs', () => {
  assert.equal(hasDamage({ damageEvents: [event] }), true);
  assert.equal(hasDamage({}), false);
  const a = prepareDamage([event], [hero], sources, action, 'same-turn')[0];
  const b = prepareDamage([event], [hero], sources, action, 'same-turn')[0];
  assert.equal(a.id, b.id);
  assert.notEqual(makeId(), makeId());
});
test('quoting an existing but unrelated source cannot justify lava damage', () => {
  const gates = { id: 'scene', text: 'Врата цитадели охраняет караул.' };
  assert.throws(() => prepareDamage([{ ...event, sourceId: 'scene', sourceQuote: gates.text }], [hero], [gates], action, 'turn-5'));
  const noLava = { id: 'scene', text: 'Здесь нет лавы. Это обычный караульный двор.' };
  assert.throws(() => prepareDamage([{ ...event, sourceId: 'scene', sourceQuote: noLava.text }], [hero], [noLava], action, 'turn-5'));
});
