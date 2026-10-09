import { addDays, nextWeekday, toISODate } from "./dates.js";

export const SEED_TITLES = {
  sync: "Синк с командой",
  letters: "Ответить на письма",
  groceries: "Купить продукты",
  planning: "Планёрка отдела",
  draft: "Подготовить черновик презентации",
  materials: "Собрать материалы к презентации",
  demo: "Демо для клиента",
  ivanRecent: "Созвон с Иваном",
  ivanOlder: "Встреча с Иваном",
};

function record(id, type, title, date, time) {
  return {
    id,
    type,
    title,
    date,
    time,
    seeded: true,
  };
}

export function buildSeed(today) {
  const day = toISODate(today);
  const tomorrow = toISODate(addDays(today, 1));
  const friday = toISODate(nextWeekday(today, 5));
  const materialsDay = toISODate(addDays(today, -2));
  const ivanRecent = toISODate(addDays(today, -12));
  const ivanOlder = toISODate(addDays(today, -26));

  return [
    record("seed-sync", "meeting", SEED_TITLES.sync, day, "11:00"),
    record("seed-letters", "task", SEED_TITLES.letters, day, null),
    record("seed-groceries", "reminder", SEED_TITLES.groceries, day, "19:00"),
    record("seed-planning", "meeting", SEED_TITLES.planning, tomorrow, "09:30"),
    record("seed-draft", "task", SEED_TITLES.draft, tomorrow, null),
    record("seed-materials", "task", SEED_TITLES.materials, materialsDay, null),
    record("seed-demo", "meeting", SEED_TITLES.demo, friday, "16:00"),
    record("seed-ivan-recent", "meeting", SEED_TITLES.ivanRecent, ivanRecent, "16:30"),
    record("seed-ivan-older", "meeting", SEED_TITLES.ivanOlder, ivanOlder, "14:00"),
  ];
}
