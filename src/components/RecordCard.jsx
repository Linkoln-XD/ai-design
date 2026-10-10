import { formatWhen } from "../lib/dates.js";

const TYPE_LABEL = {
  task: "Задача",
  reminder: "Напоминание",
  meeting: "Встреча",
};

export function RecordCard({ record, today, onEdit }) {
  const dateLabel = record.date ? formatWhen(record.date, today) : "";

  return (
    <article className={`record record--${record.type}`}>
      <p className="record__type">{TYPE_LABEL[record.type]}</p>
      {(record.completed || record.deleted) && <p className="record__note">{record.deleted ? "Удалено из планов" : "Выполнено"}</p>}
      <h3 className="record__title">{record.title}</h3>
      {record.type === "meeting" ? (
        <div className="record__when">
          <p className="record__label">Начало</p>
          <p className="record__clock">{record.time}</p>
          <p className="record__date">{dateLabel}</p>
        </div>
      ) : (
        <div className="record__when">
          <p className="record__label">{record.type === "reminder" ? "Когда напомнить" : "Срок"}</p>
          <p className="record__date">{dateLabel || "Дата не задана"}</p>
          {record.time ? (
            <p className="record__clock record__clock--small">{record.time}</p>
          ) : (
            <p className="record__missing">Время не задано</p>
          )}
        </div>
      )}
      {!record.deleted && onEdit && <button className="button button--quiet button--small record__edit" aria-label={`Изменить: ${record.title}`} onClick={() => onEdit(record)}>Изменить</button>}
      {record.type === "reminder" && <p className="record__note">Уведомление не отправляется</p>}
    </article>
  );
}
