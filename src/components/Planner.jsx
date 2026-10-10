import { useEffect, useRef, useState } from 'react';
import { addDays, fromISODate, toISODate } from '../lib/dates.js';
import { filterRecords, monthDays } from '../lib/planner.js';
import { Modal } from './Modal.jsx';

const labels = { task: 'Задача', meeting: 'Встреча', reminder: 'Напоминание' };
const monthLabel = date => date.toLocaleDateString('ru', { month: 'long', year: 'numeric' });
const dayLabel = date => date.toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' });

export function RecordEditor({ record, onSave, onClose, onDelete }) {
  const [value, setValue] = useState(record);
  const change = event => setValue(current => ({ ...current, [event.target.name]: event.target.value }));
  return <Modal title={record.id ? 'Редактировать запись' : 'Новая запись'} onClose={onClose} labelledBy="editor-title">
    <form className="record-editor" onSubmit={event => {
      event.preventDefault();
      if (!value.title.trim()) return;
      onSave({ ...value, title: value.title.trim(), date: value.date || null, time: value.time || null, completed: value.type === 'meeting' ? false : !!value.completed });
    }}>
      <label>Название<input data-autofocus name="title" value={value.title} onChange={change} required maxLength={300} placeholder="Что запланируем?" /></label>
      <label>Тип записи<select name="type" value={value.type} onChange={change}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <div className="editor-dates">
        <label>Дата{value.type !== 'meeting' && <small>Необязательно</small>}<input type="date" name="date" value={value.date || ''} required={value.type === 'meeting'} onChange={change} /></label>
        <label>Время{value.type !== 'meeting' && <small>Необязательно</small>}<input type="time" name="time" value={value.time || ''} required={value.type === 'meeting'} onChange={change} /></label>
      </div>
      {value.type === 'reminder' && <p>Напоминание сохранится в планах. Пуш-уведомления пока не подключены.</p>}
      <div className="modal__actions editor-actions">
        {record.id && onDelete && <button className="text-button delete-record" type="button" onClick={() => onDelete(record)}>Удалить</button>}
        <button className="button button--quiet" type="button" onClick={onClose}>Отмена</button>
        <button className="button" type="submit">{record.id ? "Сохранить" : "Создать запись"}</button>
      </div>
    </form>
  </Modal>;
}

export function Planner({ records, today, onSave, onToggle, onDelete, onRestore }) {
  const [monthExpanded, setMonthExpanded] = useState(false);
  const [selected, setSelected] = useState(toISODate(today));
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [view, setView] = useState('calendar');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [editor, setEditor] = useState(null);
  const [deleted, setDeleted] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [saved, setSaved] = useState(null);
  const rowRefs = useRef(new Map());
  useEffect(() => {
    if (saved) rowRefs.current.get(saved.id)?.scrollIntoView({ block: 'nearest' });
  }, [saved]);
  const todayIso = toISODate(today);
  const days = monthDays(month);
  const selectedDate = fromISODate(selected);
  const weekStart = toISODate(addDays(selectedDate, -((selectedDate.getDay() + 6) % 7)));
  const weekEnd = toISODate(addDays(fromISODate(weekStart), 6));
  const shown = filterRecords(records, { query, filter: view === 'tasks' ? filter : 'all', date: view === 'calendar' ? selected : null, today });
  const open = records.filter(r => r.type !== 'meeting' && !r.completed);
  const overdue = open.filter(r => r.date && r.date < todayIso).length;
  const pickDay = date => { setSelected(toISODate(date)); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); };
  const newRecord = () => setEditor({ type: 'task', title: '', date: selected, time: '', completed: false });

  return <section className="planner" aria-label="Календарь и задачи">
    <header className="planner-header">
      <div><p className="kicker">Личное пространство</p><h1>Мои планы<span className="planner-dot">.</span></h1></div>
      <button className="button" onClick={newRecord}>＋ Создать</button>
    </header>
    <div className="planner-summary"><span><strong>{open.length}</strong> в работе</span><span className={overdue ? 'is-overdue' : ''}><strong>{overdue}</strong> просрочено</span><span className="local-label">Сохранено на устройстве</span></div>
    <div className="planner-tools">
      <div className="segmented" role="group" aria-label="Представление планов"><button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>Календарь</button><button aria-pressed={view === 'tasks'} onClick={() => setView('tasks')}>Все записи</button></div>
      <label className="planner-search"><span className="search-label">{view === 'calendar' ? `Поиск за ${fromISODate(selected).toLocaleDateString('ru', { day: 'numeric', month: 'long' })}` : 'Поиск по всем записям'}</span><input aria-label="Поиск в планах" type="search" enterKeyHint="search" onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} placeholder={view === 'calendar' ? 'Поиск в выбранном дне' : 'Поиск по всем записям'} value={query} onChange={event => setQuery(event.target.value)} /></label>
    </div>
    <div className={`planner-scroll ${view === "calendar" ? "planner-scroll--calendar" : ""}`}>
      {view === 'calendar' ? <div className={`calendar-panel ${monthExpanded ? "calendar-panel--expanded" : "calendar-panel--week"}`}>
        <div className="calendar-toolbar"><h2>{monthLabel(month)}</h2><div><button className="icon-button" aria-label="Предыдущий месяц" onClick={() => pickDay(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><button className="button button--quiet button--small" onClick={() => pickDay(today)}>Сегодня</button><button className="icon-button" aria-label="Следующий месяц" onClick={() => pickDay(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div></div>
        <button className="text-button calendar-expand" aria-expanded={monthExpanded} onClick={() => setMonthExpanded(value => !value)}>{monthExpanded ? "Свернуть месяц ↑" : "Выбрать дату · весь месяц ↓"}</button>
        <div className="calendar-weekdays" aria-hidden="true">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid" role="group" aria-label={monthLabel(month)}>
          {days.map(date => {
            const iso = toISODate(date);
            const entries = records.filter(record => record.date === iso);
            return <button key={iso} className={`calendar-day ${iso < weekStart || iso > weekEnd ? "outside-week" : ""} ${date.getMonth() !== month.getMonth() ? 'outside' : ''} ${iso === todayIso ? 'is-today' : ''} ${iso === selected ? 'is-selected' : ''}`} aria-pressed={iso === selected} aria-current={iso === todayIso ? 'date' : undefined} aria-label={`${dayLabel(date)}, ${date.getFullYear()}, записей: ${entries.length}`} onClick={() => pickDay(date)} onKeyDown={event => {
              const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
              if (delta === undefined) return;
              event.preventDefault();
              const next = addDays(date, delta); pickDay(next);
              requestAnimationFrame(() => document.querySelector(`[data-day="${toISODate(next)}"]`)?.focus());
            }} data-day={iso}>
              <span className="day-number">{date.getDate()}</span>
              <span className="day-entries">{entries.slice(0, 2).map(record => <span key={record.id} className={`calendar-entry entry--${record.type} ${record.completed ? 'is-done' : ''}`}>{record.time && `${record.time} `}{record.title}</span>)}{entries.length > 2 && <span className="calendar-more">Ещё {entries.length - 2}</span>}</span>
              <span className="day-dots" aria-hidden="true">{entries.slice(0, 3).map(record => <i key={record.id} className={`entry--${record.type}`} />)}</span>
            </button>;
          })}
        </div>
      </div> : <div className="task-filters" role="group" aria-label="Фильтр записей">{[['all', 'Все'], ['open', 'В работе'], ['overdue', 'Просрочено'], ['undated', 'Без даты'], ['done', 'Готово']].map(([key, title]) => <button className="shortcut" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{title}</button>)}</div>}
      <section className="agenda-panel" aria-label={view === 'calendar' ? 'Повестка выбранного дня' : 'Список записей'}>
      {view === 'calendar' && <div className="agenda-heading"><div><p className="kicker">Повестка дня</p><h2>{dayLabel(fromISODate(selected))}</h2></div><span>{shown.length}</span></div>}
      <ul className="plan-records">
        {shown.map(record => <li key={record.id} ref={element => { if (element) rowRefs.current.set(record.id, element); else rowRefs.current.delete(record.id); }} className={`plan-row ${record.completed ? 'is-done' : ''} ${saved?.id === record.id ? 'is-saved' : ''}`}>
          {record.type !== 'meeting' ? <input type="checkbox" checked={!!record.completed} aria-label={`Выполнено: ${record.title}`} onChange={() => { onToggle(record.id); setAnnouncement(record.completed ? 'Запись возвращена в работу' : 'Запись выполнена'); }} /> : <span className="meeting-symbol" aria-label="Встреча">◷</span>}
          <button className="plan-record" onClick={() => setEditor(record)} aria-label={`Редактировать: ${record.title}`}><span className="plan-title">{record.title}</span><span className="plan-meta"><span className={`type-tag entry--${record.type}`}>{labels[record.type]}</span>{record.date ? fromISODate(record.date).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Без даты'}{record.time && ` · ${record.time}`}{record.completed ? ' · Готово' : record.type !== 'meeting' && record.date && record.date < todayIso ? ' · Просрочено' : ''}</span></button>
          <span className="row-arrow" aria-hidden="true">›</span>
        </li>)}
      </ul>
      {!shown.length && <div className="planner-empty"><h3>{query ? (view === 'calendar' ? 'В этом дне совпадений нет' : 'Совпадений нет') : filter !== 'all' && view === 'tasks' ? 'Нет записей в этом разделе' : 'На этот день планов нет'}</h3><p>{query ? 'Проверьте название или область поиска.' : 'Добавьте задачу, встречу или напоминание.'}</p>{query && view === 'calendar' ? <button className="button button--quiet" onClick={() => { setView('tasks'); setFilter('all'); }}>Искать во всех записях</button> : <button className="button button--quiet" onClick={query ? () => setQuery('') : newRecord}>{query ? 'Очистить поиск' : '＋ Создать запись'}</button>}</div>}
      </section>
    </div>
    <p className="sr-only" role="status">{announcement}</p>
    {saved && <div className="undo-notice" role="status"><span>Сохранено: {saved.title}{!shown.some(r => r.id === saved.id) && ' · вне текущего списка'}</span>{!shown.some(r => r.id === saved.id) && <button className="text-button" onClick={() => { setQuery(''); setFilter('all'); if (saved.date) { setView('calendar'); pickDay(fromISODate(saved.date)); } else setView('tasks'); setSaved({ ...saved }); }}>Показать</button>}<button className="icon-button" aria-label="Скрыть сообщение о сохранении" onClick={() => setSaved(null)}>×</button></div>}
    {deleted && <div className="undo-notice" role="status"><span>Запись удалена</span><button className="text-button" onClick={() => { onRestore(deleted); setDeleted(null); setAnnouncement('Запись восстановлена'); }}>Вернуть</button><button className="icon-button" aria-label="Скрыть уведомление" onClick={() => setDeleted(null)}>×</button></div>}
    {editor && <RecordEditor record={editor} onClose={() => setEditor(null)} onSave={record => { const result = onSave(record); if (!record.id) { setQuery(''); setFilter('all'); if (record.date) pickDay(fromISODate(record.date)); else setView('tasks'); } setEditor(null); setDeleted(null); setSaved(result); setAnnouncement('Запись сохранена'); }} onDelete={record => { onDelete(record.id); setSaved(null); setDeleted(record); setEditor(null); }} />}
  </section>;
}
