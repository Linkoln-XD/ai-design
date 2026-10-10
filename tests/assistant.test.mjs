import assert from "node:assert/strict";
import test from "node:test";
import { answer } from "../src/lib/assistant.js";
import { toISODate } from "../src/lib/dates.js";
import { buildSeed } from "../src/lib/seed.js";

const today = new Date(2026, 9, 7);
let seq = 0;

function id() {
  seq += 1;
  return `id-${seq}`;
}

function ask(text, state) {
  const result = answer({
    text,
    today,
    records: state.records,
    pending: state.pending,
    makeId: id,
  });
  state.records = result.records;
  state.pending = result.pending;
  state.last = result.message;
  return result.message;
}

function fresh() {
  return { records: buildSeed(today), pending: null, last: null };
}

test("создаёт задачу на ближайшую пятницу без времени", () => {
  const state = fresh();
  const before = state.records.length;
  const message = ask("В пятницу нужно отправить отчёт", state);
  assert.equal(state.records.length, before + 1);
  const created = state.records.at(-1);
  assert.equal(created.type, "task");
  assert.equal(created.title, "Отправить отчёт");
  assert.equal(created.date, "2026-10-09");
  assert.equal(created.time, null);
  assert.equal(message.cards.length, 1);
  assert.match(message.text, /9 октября/);
  assert.match(message.text, /пятниц/);
  assert.match(message.text, /Время не задано/);
  assert.equal(message.tone, "success");
});

test("создаёт напоминание на завтра в 10:00 и не обещает уведомление", () => {
  const state = fresh();
  const message = ask("Напомни мне завтра в 10 утра позвонить Ивану", state);
  const created = state.records.at(-1);
  assert.equal(created.type, "reminder");
  assert.equal(created.title, "Позвонить Ивану");
  assert.equal(created.date, "2026-10-08");
  assert.equal(created.time, "10:00");
  assert.match(message.text, /завтра, 8 октября, 10:00/);
  assert.match(message.text, /уведомление не отправляется/);
});

test("создаёт встречу с командой на завтра в 15:00", () => {
  const state = fresh();
  const message = ask("Добавь встречу с командой завтра в 15:00", state);
  const created = state.records.at(-1);
  assert.equal(created.type, "meeting");
  assert.equal(created.title, "Встреча с командой");
  assert.equal(created.date, "2026-10-08");
  assert.equal(created.time, "15:00");
  assert.equal(message.cards.length, 1);
  assert.match(message.text, /завтра, 8 октября, 15:00/);
});

test("не создаёт встречу без времени и сохраняет одну запись после ответа", () => {
  const state = fresh();
  const before = state.records.length;
  const clarify = ask("Поставь встречу с Иваном завтра", state);
  assert.equal(state.records.length, before);
  assert.equal(clarify.tone, "clarify");
  assert.equal(clarify.clarify, true);
  assert.match(clarify.text, /На какое время/);
  assert.match(clarify.text, /завтра, 8 октября/);

  const saved = ask("В 15:00", state);
  assert.equal(state.pending, null);
  assert.equal(state.records.length, before + 1);
  const created = state.records.at(-1);
  assert.equal(created.title, "Встреча с Иваном");
  assert.equal(created.date, "2026-10-08");
  assert.equal(created.time, "15:00");
  assert.equal(saved.cards.length, 1);
  assert.match(saved.text, /завтра, 8 октября, 15:00/);
});

test("отмена незавершённой встречи ничего не сохраняет", () => {
  const state = fresh();
  const before = state.records.length;
  ask("Поставь встречу с Иваном завтра", state);
  const message = ask("Отмена", state);
  assert.equal(state.pending, null);
  assert.equal(state.records.length, before);
  assert.equal(message.tone, "cancelled");
  assert.equal(message.cards.length, 0);
});

test("просмотр планов сохраняет черновик встречи", () => {
  const state = fresh();
  const before = state.records.length;
  ask("Поставь встречу с Иваном завтра", state);
  const message = ask("Что у меня сегодня?", state);
  assert.equal(state.pending.draft.title, "Встреча с Иваном");
  assert.equal(state.records.length, before);
  ask("Найди задачу про письма", state);
  ask("В 15:00", state);
  assert.equal(state.records.length, before + 1);
  assert.equal(state.records.at(-1).title, "Встреча с Иваном");
  assert.ok(message.cards.length > 0);
});

test("показывает задачи и встречи за сегодня", () => {
  const state = fresh();
  const message = ask("Что у меня сегодня?", state);
  assert.equal(message.tone, "success");
  assert.ok(message.cards.some((card) => card.type === "task"));
  assert.ok(message.cards.some((card) => card.type === "meeting"));
  assert.ok(message.cards.some((card) => card.type === "reminder"));
  assert.ok(message.cards.every((card) => card.date === "2026-10-07"));
  assert.match(message.text, /7 октября/);
});

test("показывает только встречи за сегодня", () => {
  const state = fresh();
  const message = ask("Есть ли у меня встречи сегодня?", state);
  assert.ok(message.cards.length >= 1);
  assert.ok(message.cards.every((card) => card.type === "meeting"));
  assert.ok(message.cards.every((card) => card.date === "2026-10-07"));
});

test("показывает завтра и текущую неделю, включая новую задачу", () => {
  const state = fresh();
  ask("В пятницу нужно отправить отчёт", state);
  ask("Добавь встречу с командой завтра в 15:00", state);

  const tomorrow = ask("Что у меня завтра?", state);
  assert.ok(tomorrow.cards.every((card) => card.date === "2026-10-08"));
  assert.ok(tomorrow.cards.some((card) => card.title === "Встреча с командой"));

  const week = ask("Что у меня на этой неделе?", state);
  const dates = week.cards.map((card) => card.date);
  assert.ok(dates.includes("2026-10-07"));
  assert.ok(dates.includes("2026-10-08"));
  assert.ok(dates.includes("2026-10-09"));
  assert.ok(week.cards.some((card) => card.title === "Отправить отчёт"));
  assert.ok(dates.every((date) => date >= "2026-10-05" && date <= "2026-10-11"));
});

test("пустой день, один результат, несколько результатов и пустой поиск", () => {
  const state = fresh();
  const empty = ask("Что у меня в воскресенье?", state);
  assert.equal(empty.tone, "empty");
  assert.equal(empty.cards.length, 0);
  assert.match(empty.text, /11 октября/);

  const one = ask("Найди задачу про письма", state);
  assert.equal(one.cards.length, 1);
  assert.equal(one.cards[0].title, "Ответить на письма");

  const many = ask("Найди задачу про презентацию", state);
  assert.equal(many.cards.length, 2);
  assert.equal(new Set(many.cards.map((card) => card.date)).size, 2);
  assert.match(many.text, /Даты разные/);

  const none = ask("Найди задачу про отпуск", state);
  assert.equal(none.tone, "not_found");
  assert.equal(none.cards.length, 0);
  assert.match(none.text, /отпуск/);
});

test("ищет прошлые встречи с Иваном и не путает их с новой", () => {
  const state = fresh();
  ask("Поставь встречу с Иваном завтра", state);
  ask("В 15:00", state);

  const message = ask("Когда у меня была встреча с Иваном?", state);
  assert.ok(message.cards.length >= 2);
  assert.ok(message.cards.every((card) => card.type === "meeting"));
  assert.ok(message.cards.every((card) => card.date < toISODate(today)));
  assert.equal(new Set(message.cards.map((card) => card.date)).size, message.cards.length);
  assert.ok(message.cards.every((card) => card.date !== "2026-10-08"));
});

test("созданная задача находится поиском", () => {
  const state = fresh();
  ask("В пятницу нужно отправить отчёт", state);
  const message = ask("Найди задачу про отчёт", state);
  assert.equal(message.cards.length, 1);
  assert.equal(message.cards[0].title, "Отправить отчёт");
  assert.equal(message.cards[0].time, null);
});


test("дата встречи не зависит от порядка уточнения", () => {
  for (const lines of [
    ["Добавь встречу с командой в 15:00", "Завтра"],
    ["Добавь встречу с командой", "В 15:00", "Завтра"],
    ["Добавь встречу с командой", "Завтра", "В 15:00"],
  ]) {
    const state = fresh();
    const before = state.records.length;
    for (const line of lines.slice(0, -1)) {
      ask(line, state);
      assert.equal(state.records.length, before);
      assert.ok(state.pending);
    }
    ask(lines.at(-1), state);
    assert.equal(state.records.length, before + 1);
    assert.equal(state.records.at(-1).date, "2026-10-08");
    assert.equal(state.records.at(-1).time, "15:00");
    assert.equal(state.pending, null);
  }
});
