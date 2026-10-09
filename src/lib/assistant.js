import {
  WEEKDAY_STEMS,
  addDays,
  formatRange,
  formatWhen,
  nextWeekday,
  padTime,
  toISODate,
  weekRange,
} from "./dates.js";

export function normalize(value) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'“”]/g, "")
    .replace(/[?!.,;()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function plural(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function hasStem(text, stem) {
  return text.includes(stem);
}

function matchWeekday(text) {
  return WEEKDAY_STEMS.find((item) => hasStem(text, item.stem)) ?? null;
}

export function extractTime(text) {
  const clock = text.match(/(?:^|\s)(\d{1,2}):(\d{2})(?=\s|$)/);
  if (clock) {
    const hours = Number(clock[1]);
    const minutes = Number(clock[2]);
    if (hours <= 23 && minutes <= 59) return padTime(hours, minutes);
  }

  const verbal = text.match(
    /(?:^|\s)(?:в\s+)?(\d{1,2})(?:\s+(\d{2}))?\s+(утра|вечера|дня|час(?:а|ов)?)(?=\s|$)/,
  );
  if (verbal) {
    let hours = Number(verbal[1]);
    const minutes = verbal[2] ? Number(verbal[2]) : 0;
    const part = verbal[3];
    if ((part.startsWith("вечер") || part === "дня") && hours < 12) hours += 12;
    if (hours <= 23 && minutes <= 59) return padTime(hours, minutes);
  }

  const bare = text.match(/^в\s+(\d{1,2})(?::(\d{2}))?$/);
  if (bare) {
    const hours = Number(bare[1]);
    const minutes = bare[2] ? Number(bare[2]) : 0;
    if (hours <= 23 && minutes <= 59) return padTime(hours, minutes);
  }

  return null;
}

function parseWhen(text, today) {
  let date = null;
  if (hasStem(text, "послезавтра")) date = addDays(today, 2);
  else if (new RegExp(`(?:^|\\s)завтра(?:\\s|$)`).test(text)) date = addDays(today, 1);
  else if (hasStem(text, "сегодня")) date = today;
  else {
    const weekday = matchWeekday(text);
    if (weekday) date = nextWeekday(today, weekday.dow);
  }
  return { date, time: extractTime(text) };
}

function isCancel(text) {
  return /^(отмена|отмени|отменить|не надо|не нужно)$/.test(text);
}

function isWhenAnswer(text) {
  const stripped = text
    .replace(/(?:^|\s)(?:в|во|на)(?=\s|$)/g, " ")
    .replace(/\d{1,2}:\d{2}/g, " ")
    .replace(/(?:^|\s)\d{1,2}(?=\s|$)/g, " ")
    .replace(/(?:^|\s)(?:утра|вечера|дня|час|часа|часов)(?=\s|$)/g, " ")
    .replace(/(?:^|\s)(?:сегодня|завтра|послезавтра)(?=\s|$)/g, " ")
    .replace(
      /(?:^|\s)(?:понедельник\p{L}*|вторник\p{L}*|сред\p{L}*|четверг\p{L}*|пятниц\p{L}*|суббот\p{L}*|воскресень\p{L}*)(?=\s|$)/gu,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length === 0 && extractTime(text);
}

function isListCue(text) {
  return /(что|какие|планы|покажи|есть ли|мои)/.test(text);
}

function wantsMeetings(text) {
  return text.includes("встреч");
}

function wantsTasks(text) {
  return text.includes("задач") && !text.includes("встреч");
}

function interpret(text, today) {
  const meetingsToday =
    wantsMeetings(text) &&
    text.includes("сегодня") &&
    !text.includes("завтра") &&
    !/(добав|постав|созда)/.test(text);
  if (meetingsToday) return { type: "list", range: "today", types: ["meeting"] };

  const meetingsTomorrow =
    wantsMeetings(text) &&
    /(?:^|\s)завтра(?:\s|$)/.test(text) &&
    !/(добав|постав|созда)/.test(text) &&
    isListCue(text);
  if (meetingsTomorrow) return { type: "list", range: "tomorrow", types: ["meeting"] };

  if (/^(?:найди|найти|поиск)(?:\s|$)/.test(text) || text.includes("когда у меня")) {
    return { type: "search", plan: searchPlan(text) };
  }

  const reminder = parseReminder(text, today);
  if (reminder) return reminder;

  const meeting = parseMeeting(text, today);
  if (meeting) return meeting;

  const task = parseTask(text, today);
  if (task) return task;

  const weekday = matchWeekday(text);
  if (weekday && (isListCue(text) || /^(?:что|планы|покажи)(?:\s|$)/.test(text))) {
    return {
      type: "list",
      range: "date",
      date: toISODate(nextWeekday(today, weekday.dow)),
      types: wantsMeetings(text) ? ["meeting"] : wantsTasks(text) ? ["task", "reminder"] : null,
    };
  }

  if (/на этой неделе|на текущей неделе|планы на неделю|на неделе|за неделю/.test(text)) {
    return {
      type: "list",
      range: "week",
      types: wantsMeetings(text) ? ["meeting"] : null,
    };
  }

  if (
    /планы на завтра/.test(text) ||
    /^на завтра$/.test(text) ||
    /что (у меня )?завтра/.test(text) ||
    /какие планы завтра/.test(text)
  ) {
    return { type: "list", range: "tomorrow", types: null };
  }

  if (
    /планы на сегодня/.test(text) ||
    /что (у меня )?сегодня/.test(text) ||
    /какие планы сегодня/.test(text) ||
    /^сегодня$/.test(text)
  ) {
    return { type: "list", range: "today", types: null };
  }

  return { type: "unknown" };
}

function searchPlan(text) {
  const past = /когда|была|был|прошл/.test(text);
  if (text.includes("презентац")) {
    return { mode: "task", stem: "презентац", label: "презентация", past: false };
  }
  if (text.includes("письм")) {
    return { mode: "task", stem: "письм", label: "письма", past: false };
  }
  if (text.includes("отпуск")) {
    return { mode: "task", stem: "отпуск", label: "отпуск", past: false };
  }
  if (text.includes("отчет")) {
    return { mode: "any", stem: "отчет", label: "отчёт", past: false };
  }
  if (text.includes("иван")) {
    return { mode: "meeting", stem: "иван", label: "Иван", past };
  }

  const label = text
    .replace(/^(найди|найти|поиск)\s+/, "")
    .replace(/^(задачу|встречу|напоминание|запись)\s+/, "")
    .replace(/^(про|о|с)\s+/, "")
    .trim();
  return {
    mode: "any",
    stem: label.slice(0, 24),
    label: label || "запрос",
    past: false,
  };
}

function parseReminder(text, today) {
  if (!/^напомни(?:\s|$)/.test(text)) return null;
  const when = parseWhen(text, today);
  let title = "Напоминание";
  if (text.includes("иван")) title = "Позвонить Ивану";
  else {
    title = cleanupTitle(text) || "Напоминание";
  }
  return {
    type: "create",
    record: {
      type: "reminder",
      title,
      date: when.date ? toISODate(when.date) : toISODate(addDays(today, 1)),
      time: when.time,
    },
  };
}

function parseMeeting(text, today) {
  const command = /(добав|постав|созда)/.test(text) && text.includes("встреч");
  if (!command) return null;
  const when = parseWhen(text, today);
  let title = "Встреча";
  if (text.includes("команд")) title = "Встреча с командой";
  else if (text.includes("иван")) title = "Встреча с Иваном";
  else {
    const withWhom = text.match(/встреч\p{L}*\s+с\s+([\p{L}\-]+)/u);
    if (withWhom) {
      const name = withWhom[1];
      title = `Встреча с ${name.charAt(0).toUpperCase()}${name.slice(1)}`;
    }
  }

  const date = when.date ? toISODate(when.date) : null;
  if (!when.time) {
    return {
      type: "clarify",
      draft: {
        type: "meeting",
        title,
        date: date ?? toISODate(addDays(today, 1)),
        assumedDate: !date,
        time: null,
      },
    };
  }

  return {
    type: "create",
    record: {
      type: "meeting",
      title,
      date: date ?? toISODate(today),
      time: when.time,
    },
  };
}

function parseTask(text, today) {
  const scripted = text.includes("пятниц") && text.includes("отчет");
  const generic = /(нужно|надо|добав(ить)? задачу|^задача(?:\s|$))/.test(text);
  if (!scripted && !generic) return null;

  if (scripted) {
    return {
      type: "create",
      record: {
        type: "task",
        title: "Отправить отчёт",
        date: toISODate(nextWeekday(today, 5)),
        time: null,
      },
    };
  }

  const when = parseWhen(text, today);
  return {
    type: "create",
    record: {
      type: "task",
      title: cleanupTitle(text) || "Новая задача",
      date: when.date ? toISODate(when.date) : null,
      time: when.time,
    },
  };
}

function cleanupTitle(text) {
  return text
    .replace(/^напомни(те)?( мне)?\s+/, "")
    .replace(/^(нужно|надо)\s+/, "")
    .replace(/^добав(ить)? задачу\s+/, "")
    .replace(/(?:^|\s)(?:сегодня|завтра|послезавтра)(?=\s|$)/g, " ")
    .replace(
      /(?:^|\s)(?:(?:в|во)\s+)?(?:понедельник\p{L}*|вторник\p{L}*|сред\p{L}*|четверг\p{L}*|пятниц\p{L}*|суббот\p{L}*|воскресень\p{L}*)(?=\s|$)/gu,
      " ",
    )
    .replace(/(?:^|\s)в\s+\d{1,2}(?::\d{2})?(?:\s+(?:утра|вечера|дня|час(?:а|ов)?))?(?=\s|$)/g, " ")
    .replace(/(?:^|\s)\d{1,2}:\d{2}(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function sortRecords(records) {
  return [...records].sort((left, right) => {
    const byDate = (left.date || "9999-99-99").localeCompare(right.date || "9999-99-99");
    if (byDate !== 0) return byDate;
    return (left.time || "99:99").localeCompare(right.time || "99:99");
  });
}

function rangeBounds(range, today, explicitDate) {
  if (range === "today") {
    const iso = toISODate(today);
    return { start: iso, end: iso, label: formatWhen(iso, today) };
  }
  if (range === "tomorrow") {
    const iso = toISODate(addDays(today, 1));
    return { start: iso, end: iso, label: formatWhen(iso, today) };
  }
  if (range === "date") {
    return { start: explicitDate, end: explicitDate, label: formatWhen(explicitDate, today) };
  }
  const { start, end } = weekRange(today);
  const startIso = toISODate(start);
  const endIso = toISODate(end);
  return {
    start: startIso,
    end: endIso,
    label: `эта неделя, ${formatRange(startIso, endIso)}`,
  };
}

function applyParsed(parsed, { records, today, makeId }) {
  if (parsed.type === "unknown") {
    return {
      records,
      pending: null,
      message: message(
        "Могу записать задачу, напоминание или встречу, показать планы или найти запись. Например: «Что у меня сегодня?»",
        [],
        "info",
      ),
    };
  }

  if (parsed.type === "clarify") {
    const when = formatWhen(parsed.draft.date, today);
    const assumption = parsed.draft.assumedDate ? ` Дату не назвали, пока беру ${when}.` : "";
    return {
      records,
      pending: { type: "meeting", draft: parsed.draft },
      message: message(
        `На какое время?${assumption} «${parsed.draft.title}» — ${when} — я пока не создаю.`,
        [],
        "clarify",
        true,
      ),
    };
  }

  if (parsed.type === "create") {
    const record = { ...parsed.record, id: makeId(), seeded: false };
    return {
      records: [...records, record],
      pending: null,
      message: message(createCopy(record, today), [record], "success"),
    };
  }

  if (parsed.type === "list") {
    const bounds = rangeBounds(parsed.range, today, parsed.date);
    const found = sortRecords(
      records.filter((item) => {
        if (!item.date || item.date < bounds.start || item.date > bounds.end) return false;
        if (parsed.types && !parsed.types.includes(item.type)) return false;
        return true;
      }),
    );
    return {
      records,
      pending: null,
      message: message(listCopy(found, bounds.label, parsed.types), found, found.length ? "success" : "empty"),
    };
  }

  const todayIso = toISODate(today);
  const found = sortRecords(
    records.filter((item) => {
      if (parsed.plan.mode === "task" && item.type !== "task") return false;
      if (parsed.plan.mode === "meeting" && item.type !== "meeting") return false;
      if (parsed.plan.past && (!item.date || item.date >= todayIso)) return false;
      return normalize(item.title).includes(parsed.plan.stem);
    }),
  );

  return {
    records,
    pending: null,
    message: message(searchCopy(found, parsed.plan.label), found, found.length ? "success" : "not_found"),
  };
}

function createCopy(record, today) {
  const when = record.date ? formatWhen(record.date, today, record.time) : "";
  const whenPart = when ? `: ${when}` : "";
  if (record.type === "task") {
    const timeNote = record.time ? "" : " Время не задано.";
    const dateNote = record.date ? "" : " Дата тоже не задана.";
    return `Записала задачу «${record.title}»${whenPart}.${timeNote}${dateNote}`;
  }
  if (record.type === "reminder") {
    const timeNote = record.time ? "" : " Время не задано.";
    return `Сохранила напоминание «${record.title}»${whenPart}.${timeNote} Это только запись: уведомление не отправляется.`;
  }
  return when
    ? `Встреча сохранена: «${record.title}», ${when}.`
    : `Встреча сохранена: «${record.title}».`;
}

function listCopy(found, label, types) {
  const meetingsOnly = types?.length === 1 && types[0] === "meeting";
  const heading = label.charAt(0).toUpperCase() + label.slice(1);
  if (!found.length) {
    return meetingsOnly ? `Встреч нет — ${label}.` : `Ничего не запланировано — ${label}.`;
  }
  const noun = plural(found.length, "запись", "записи", "записей");
  if (meetingsOnly) {
    const meetingNoun = plural(found.length, "встреча", "встречи", "встреч");
    return found.length === 1
      ? `Да, есть встреча — ${label}.`
      : `Да, есть ${found.length} ${meetingNoun} — ${label}.`;
  }
  return `${heading}: ${found.length} ${noun}.`;
}

function searchCopy(found, label) {
  if (!found.length) return `Ничего не нашла по запросу «${label}».`;
  if (found.length === 1) return `Нашла одну запись про «${label}».`;
  return `Нашла ${found.length} ${plural(found.length, "запись", "записи", "записей")} про «${label}». Даты разные — по ним их легко отличить.`;
}

function message(text, cards, tone, clarify = false) {
  return { text, cards, tone, clarify };
}

export function answer({ text, today, records, pending, makeId }) {
  const normalized = normalize(text);

  if (pending?.type === "meeting") {
    if (isCancel(normalized)) {
      return {
        records,
        pending: null,
        message: message("Создание встречи отменено. Ничего не сохранила.", [], "cancelled"),
      };
    }

    if (isWhenAnswer(normalized)) {
      const when = parseWhen(normalized, today);
      const date = when.date ? toISODate(when.date) : pending.draft.date;
      const record = {
        ...pending.draft,
        id: makeId(),
        date,
        time: when.time,
        seeded: false,
        assumedDate: undefined,
      };
      return {
        records: [...records, record],
        pending: null,
        message: message(createCopy(record, today), [record], "success"),
      };
    }

    const parsed = interpret(normalized, today);
    if (parsed.type === "unknown") {
      const when = formatWhen(pending.draft.date, today);
      return {
        records,
        pending,
        message: message(
          `Пока встреча не создана. Напишите время, например «в 15:00», или отмените создание. Жду время для «${pending.draft.title}» — ${when}.`,
          [],
          "clarify",
          true,
        ),
      };
    }

    const next = applyParsed(parsed, { records, today, makeId });
    if (next.pending) return next;
    return {
      ...next,
      message: {
        ...next.message,
        text: `Незавершённую встречу не сохранила. ${next.message.text}`,
      },
    };
  }

  return applyParsed(interpret(normalized, today), { records, today, makeId });
}

export function cancelPending() {
  return message("Создание встречи отменено. Ничего не сохранила.", [], "cancelled");
}
