const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const WEEKDAY_NAMES = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
];

export const WEEKDAY_STEMS = [
  { stem: "воскресень", dow: 0 },
  { stem: "понедельник", dow: 1 },
  { stem: "вторник", dow: 2 },
  { stem: "сред", dow: 3 },
  { stem: "четверг", dow: 4 },
  { stem: "пятниц", dow: 5 },
  { stem: "суббот", dow: 6 },
];

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, amount) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromISODate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function nextWeekday(from, targetDow) {
  const date = startOfDay(from);
  const delta = (targetDow - date.getDay() + 7) % 7;
  return addDays(date, delta);
}

export function weekRange(today) {
  const day = startOfDay(today).getDay();
  const mondayDelta = day === 0 ? -6 : 1 - day;
  const start = addDays(today, mondayDelta);
  const end = addDays(start, 6);
  return { start, end };
}

export function formatWhen(iso, today, time = null) {
  if (!iso) return "";
  const date = fromISODate(iso);
  const todayIso = toISODate(startOfDay(today));
  const tomorrowIso = toISODate(addDays(today, 1));
  let relative = WEEKDAY_NAMES[date.getDay()];
  if (iso === todayIso) relative = "сегодня";
  else if (iso === tomorrowIso) relative = "завтра";

  const year =
    date.getFullYear() !== startOfDay(today).getFullYear()
      ? ` ${date.getFullYear()}`
      : "";
  const datePart = `${relative}, ${date.getDate()} ${MONTHS[date.getMonth()]}${year}`;
  return time ? `${datePart}, ${time}` : datePart;
}

export function formatRange(startIso, endIso) {
  const start = fromISODate(startIso);
  const end = fromISODate(endIso);
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS[end.getMonth()]}`;
  }
  return `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
}

export function padTime(hours, minutes) {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

const ACCUSATIVE = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среду",
  "четверг",
  "пятницу",
  "субботу",
];

export function emptyDayQuestion(today, records) {
  for (let offset = 0; offset < 21; offset += 1) {
    const date = addDays(today, offset);
    const iso = toISODate(date);
    if (records.some((item) => item.date === iso)) continue;
    const dow = date.getDay();
    const preposition = dow === 2 ? "во" : "в";
    return `Что у меня ${preposition} ${ACCUSATIVE[dow]}?`;
  }
  return "Что у меня в воскресенье?";
}
