import { formatWhen } from "../lib/dates.js";
import { useEffect } from "react";
import { RecordCard } from "./RecordCard.jsx";
import { MicIcon, SendIcon, StopIcon, VolumeIcon } from "./icons.jsx";

export function MessageList({
  messages,
  today,
  pending,
  phase,
  speakingId,
  speechSimulated,
  onEdit,
  onSpeak,
  onRetry,
  onCancel,
  bottomRef,
}) {
  return (
    <ol className="messages">
      {messages.map((message) => (
        <li key={message.id} className={`message message--${message.role}`}>
          {message.role === "assistant" ? (
            <>
              <p className="message__who">Ассистент</p>
              <p className="message__text">{message.text}</p>
              {message.cards?.length > 0 && (
                <ul className="records">
                  {message.cards.map((record) => (
                    <li key={record.id}>
                      <RecordCard record={record} today={today} onEdit={onEdit} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="message__actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-pressed={speakingId === message.id}
                  aria-label={speakingId === message.id ? "Остановить озвучивание" : "Озвучить ответ"}
                  onClick={() => onSpeak(message)}
                >
                  {speakingId === message.id ? <StopIcon /> : <VolumeIcon />}
                  <span>{speakingId === message.id ? "Стоп" : "Озвучить"}</span>
                </button>
                {speakingId === message.id && speechSimulated && (
                  <p className="message__note">В этом браузере озвучка имитируется</p>
                )}
                {message.tone === "error" && (
                  <button type="button" className="button button--small" onClick={() => onRetry(message)}>
                    Повторить
                  </button>
                )}
                {message.clarify && pending && message === messages.at(-1) && (
                  <button type="button" className="button button--quiet button--small" onClick={onCancel}>
                    Отменить создание
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="message__text">{message.text}</p>
          )}
        </li>
      ))}
      {phase === "processing" && (
        <li className="message message--assistant">
          <p className="message__who">Ассистент</p>
          <p className="message__text message__text--wait" role="status">
            Обрабатываю запрос
            <span className="dots" aria-hidden="true" />
          </p>
        </li>
      )}
      <li ref={bottomRef} className="messages__end" aria-hidden="true" />
    </ol>
  );
}

export function Welcome({ primary, more, open, onToggle, onPick }) {
  return (
    <section className="welcome">
      <p className="kicker">Новый разговор</p>
      <h2>С чего начнём?</h2>
      <p className="lede">Напишите задачу, встречу или вопрос о планах. Можно и голосом — кнопка микрофона справа внизу.</p>
      <ul className="examples">
        {primary.map((example) => (
          <li key={example}>
            <button type="button" onClick={() => onPick(example)}>
              {example}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="text-button" aria-expanded={open} onClick={onToggle}>
        {open ? "Скрыть другие сценарии" : "Другие сценарии"}
      </button>
      {open && (
        <ul className="examples examples--more">
          {more.map((example) => (
            <li key={example}>
              <button type="button" onClick={() => onPick(example)}>
                {example}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ShortcutList({ shortcuts, hint, onShortcut, orientation = "horizontal" }) {
  return (
    <div className={`shortcuts shortcuts--${orientation}`} role="group" aria-label="Быстрые действия">
      {shortcuts.map((shortcut) => (
        <button
          key={shortcut.id}
          type="button"
          className="shortcut"
          aria-pressed={shortcut.hint === "search" ? hint === shortcut.hint : undefined}
          onClick={() => onShortcut(shortcut)}
        >
          {shortcut.label}
        </button>
      ))}
    </div>
  );
}

export function Composer({
  draft,
  today,
  hint,
  pending,
  recognized,
  unheard,
  phase,
  inputRef,
  onDraft,
  onSubmit,
  onMic,
  onCancelPending,
  onDismissHint,
  onExample,
  onDismissUnheard,
  onRetryVoice,
  micUnavailable,
}) {
  const placeholder = pending ? (!pending.draft.date ? "Например: завтра в 15:00" : "Например: в 15:00") : hint?.placeholder || "Напишите запрос";
  const busy = phase === "processing" || phase === "recognizing" || phase === "recording";

  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 120)}px`;
  }, [draft, inputRef]);

  return (
    <div className="composer-stack">
      <div className="composer-notices">
      {pending && (
        <div className="notice" role="status">
          <div><p className="notice__title">{pending.draft.title}</p><p>{!pending.draft.date ? "Укажите день" : formatWhen(pending.draft.date, today)}{!pending.draft.time ? " и время" : ` · ${pending.draft.time}`}. Встреча ещё не создана.</p></div>
          <button type="button" className="button button--quiet button--small" onClick={onCancelPending}>
            Отменить
          </button>
        </div>
      )}
      {hint && !pending && (
        <div className="notice">
          <div>
            <p className="notice__title">{hint.title}</p>
            <p>{hint.text}</p>
          </div>
          <button type="button" className="text-button" onClick={onDismissHint}>
            Закрыть
          </button>
          <ul className="examples">
            {hint.examples.map((example) => (
              <li key={example}>
                <button type="button" onClick={() => onExample(example)}>
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {recognized && (
        <p className="notice notice--line" role="status">
          Распознано. Текст можно исправить перед отправкой.
        </p>
      )}
      {unheard && (
        <div className="notice" role="status">
          <p>Речь не распознана. Повторите запись или напишите текстом.</p>
          <div className="notice__actions">
            <button type="button" className="button button--small" onClick={onRetryVoice}>
              Записать снова
            </button>
            <button type="button" className="button button--quiet button--small" onClick={onDismissUnheard}>
              Писать текстом
            </button>
          </div>
        </div>
      )}
      {micUnavailable && (
        <p className="notice notice--line" id="mic-unavailable">
          Микрофон недоступен. Запрос можно отправить текстом.
        </p>
      )}
      </div>
      <form
        className={`composer ${draft.trim() ? "composer--has-draft" : ""}`}
        aria-label="Ввод запроса"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(draft);
        }}
      >
        <label className="sr-only" htmlFor="request">
          Сообщение ассистенту
        </label>
        <textarea
          id="request"
          ref={inputRef}
          rows={1}
          value={draft}
          placeholder={placeholder}
          disabled={busy}
          enterKeyHint="send"
          autoComplete="off"
          onChange={(event) => {
            const field = event.target;
            field.style.height = "auto";
            field.style.height = `${Math.min(field.scrollHeight, 120)}px`;
            onDraft(field.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit(draft);
            }
          }}
        />
        <button
          type="button"
          className="mic"
          aria-label={micUnavailable ? "Микрофон недоступен" : "Записать голосовой запрос"}
          aria-describedby={micUnavailable ? "mic-unavailable" : undefined}
          disabled={busy}
          onClick={onMic}
        >
          <MicIcon />
        </button>
        <button type="submit" className="send" disabled={busy || !draft.trim()} aria-label="Отправить">
          <SendIcon />
        </button>

      </form>
    </div>
  );
}
