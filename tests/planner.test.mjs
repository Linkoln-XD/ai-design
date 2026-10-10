import test from 'node:test';
import assert from 'node:assert/strict';
import { monthDays, filterRecords } from '../src/lib/planner.js';
import { toISODate } from '../src/lib/dates.js';
import { answer } from '../src/lib/assistant.js';

const today = new Date(2026, 9, 10);
const records = [
  { id: 'done', type: 'task', title: 'Отчёт готов', date: '2026-10-09', completed: true },
  { id: 'late', type: 'task', title: 'Отчёт в работе', date: '2026-10-09' },
  { id: 'meeting', type: 'meeting', title: 'Прошлая встреча', date: '2026-10-08', time: '12:00' },
  { id: 'undated', type: 'task', title: 'Без срока', date: null },
  { id: 'today', type: 'task', title: 'Сегодня', date: '2026-10-10' },
];
test('сетка с понедельника покрывает високосный февраль и переход года', () => {
  for (const month of [new Date(2024, 1, 1), new Date(2026, 11, 1)]) {
    const days = monthDays(month);
    assert.equal(days.length, 42);
    assert.equal(days[0].getDay(), 1);
    assert.equal(new Set(days.map(toISODate)).size, 42);
    assert.ok(days.some(day => toISODate(day) === toISODate(new Date(month.getFullYear(), month.getMonth() + 1, 0))));
  }
  assert.ok(monthDays(new Date(2024, 1, 1)).some(day => toISODate(day) === '2024-02-29'));
});
test('просроченные исключают встречи, выполненные и задачи без даты', () => {
  assert.deepEqual(filterRecords(records, { filter: 'overdue', today }).map(r => r.id), ['late']);
  assert.deepEqual(filterRecords(records, { filter: 'undated', today }).map(r => r.id), ['undated']);
  assert.deepEqual(filterRecords(records, { filter: 'done', today }).map(r => r.id), ['done']);
});
test('поиск и дата комбинируются, выполненные идут после активных', () => {
  assert.deepEqual(filterRecords(records, { query: '  ОТЧЁТ ', date: '2026-10-09', today }).map(r => r.id), ['late', 'done']);
});
test('ассистент не возвращает выполненную задачу в планы дня, но находит в поиске', () => {
  const completed = [{ id: 'one', type: 'task', title: 'Отправить отчёт', date: '2026-10-10', completed: true }];
  const ask = text => answer({ text, today, records: completed, pending: null, makeId: () => 'new' });
  assert.equal(ask('Что у меня сегодня?').message.cards.length, 0);
  assert.equal(ask('Найди задачу про отчёт').message.cards[0].completed, true);
});
