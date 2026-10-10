import { addDays, toISODate, weekRange } from './dates.js';

export function monthDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = weekRange(first).start;
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function filterRecords(records, { query = '', filter = 'all', date = null, today }) {
  const text = query.trim().toLocaleLowerCase('ru');
  return records.filter(record => {
    if (date && record.date !== date) return false;
    if (text && !record.title.toLocaleLowerCase('ru').includes(text)) return false;
    if (filter === 'open' && (record.type === 'meeting' || record.completed)) return false;
    if (filter === 'done' && !record.completed) return false;
    if (filter === 'overdue' && (record.completed || record.type === 'meeting' || !record.date || record.date >= toISODate(today))) return false;
    if (filter === 'undated' && record.date) return false;
    return true;
  }).sort((a, b) => Number(!!a.completed) - Number(!!b.completed) || (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '99:99').localeCompare(b.time || '99:99') || a.title.localeCompare(b.title, 'ru'));
}
