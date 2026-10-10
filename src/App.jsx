import { Planner, RecordEditor } from "./components/Planner.jsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { answer, cancelPending } from "./lib/assistant.js";
import { emptyDayQuestion, formatWhen, startOfDay } from "./lib/dates.js";
import { HINTS, SHORTCUTS, VOICE_LINES, WELCOME_MORE, WELCOME_PRIMARY } from "./lib/scenarios.js";
import { useInstall } from "./lib/useInstall.js";
import { startSpeech } from "./lib/speech.js";
import { emptyState, loadState, saveState } from "./lib/storage.js";
import { Composer, MessageList, ShortcutList, Welcome } from "./components/ChatParts.jsx";
import { Modal } from "./components/Modal.jsx";
import { Onboarding } from "./components/Onboarding.jsx";
import { RecordingSheet } from "./components/RecordingSheet.jsx";

function spokenText(message, today) {
  const cards = (message.cards ?? [])
    .map((record) => {
      const when = record.date ? formatWhen(record.date, today, record.time) : "без даты";
      const missing = record.type !== "meeting" && !record.time ? ", время не задано" : "";
      return `${record.title}, ${when}${missing}`;
    })
    .join(". ");
  return [message.text, cards].filter(Boolean).join(". ");
}

function withEmptyDay(lines, question) {
  return lines.map((line) => (line.includes("воскресенье") ? question : line));
}

export default function App() {
  const installation = useInstall();
  const [chatEditor, setChatEditor] = useState(null);
  const [chatSaved, setChatSaved] = useState("");
  const [mobileView, setMobileView] = useState("chat");
  const today = useMemo(() => startOfDay(new Date()), []);
  const initial = useMemo(() => loadState(today), [today]);
  const [onboardingDone, setOnboardingDone] = useState(initial.onboardingDone);
  const [micExplained, setMicExplained] = useState(initial.micExplained);
  const [micUnavailable, setMicUnavailable] = useState(initial.micUnavailable);
  const [messages, setMessages] = useState(initial.messages);
  const [records, setRecords] = useState(initial.records);
  const [pending, setPending] = useState(initial.pending);
  const [draft, setDraft] = useState("");
  const [hintId, setHintId] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [dialog, setDialog] = useState(null);
  const [recognized, setRecognized] = useState(false);
  const [unheard, setUnheard] = useState(false);
  const [moreExamples, setMoreExamples] = useState(false);
  const [armFail, setArmFail] = useState(false);
  const [armUnheard, setArmUnheard] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [speechSimulated, setSpeechSimulated] = useState(false);
  const [live, setLive] = useState("");

  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const recordsRef = useRef(records);
  const pendingRef = useRef(pending);
  const speechRef = useRef(null);
  const timerRef = useRef(null);
  const phaseRef = useRef("idle");
  recordsRef.current = records;
  pendingRef.current = pending;

  const emptyQuestion = useMemo(() => emptyDayQuestion(today, records), [today, records]);
  const voiceLines = useMemo(() => withEmptyDay(VOICE_LINES, emptyQuestion), [emptyQuestion]);
  const moreLines = useMemo(() => withEmptyDay(WELCOME_MORE, emptyQuestion), [emptyQuestion]);
  const hint = hintId ? HINTS[hintId] : null;

  useEffect(() => {
    saveState({
      onboardingDone,
      micExplained,
      micUnavailable,
      messages,
      records,
      pending,
    });
  }, [onboardingDone, micExplained, micUnavailable, messages, records, pending]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [messages, phase, hintId, pending, unheard]);

  // Safari keeps the layout viewport tall when the on-screen keyboard opens.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    function resizeViewport() {
      if (viewport.scale !== 1 || Math.abs(viewport.width - document.documentElement.clientWidth) > 1) {
        document.documentElement.style.removeProperty("--viewport-height");
        document.documentElement.style.removeProperty("--viewport-top");
        return;
      }
      document.documentElement.style.setProperty("--viewport-height", `${viewport.height}px`);
      document.documentElement.style.setProperty("--viewport-top", `${viewport.offsetTop}px`);
    }
    resizeViewport();
    viewport.addEventListener("resize", resizeViewport);
    viewport.addEventListener("scroll", resizeViewport);
    return () => {
      viewport.removeEventListener("resize", resizeViewport);
      viewport.removeEventListener("scroll", resizeViewport);
      document.documentElement.style.removeProperty("--viewport-height");
      document.documentElement.style.removeProperty("--viewport-top");
    };
  }, []);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  function saveRecord(record) {
    const saved = record.id ? record : { ...record, id: crypto.randomUUID(), seeded: false };
    setRecords(items => record.id ? items.map(item => item.id === record.id ? saved : item) : [...items, saved]);
    return saved;
  }

  function focusInput() {
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function submitText(raw, { echoUser = true } = {}) {
    const text = raw.trim();
    if (!text || phaseRef.current === "processing" || phaseRef.current === "recording" || phaseRef.current === "recognizing") return;
    inputRef.current?.blur();
    phaseRef.current = "processing";
    setDraft("");
    setHintId(null);
    setRecognized(false);
    setUnheard(false);
    setMoreExamples(false);
    if (inputRef.current) inputRef.current.style.height = "auto";
    if (echoUser) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", text }]);
    }
    const fail = armFail;
    setArmFail(false);
    setPhase("processing");
    setLive("Обрабатываю запрос");
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (fail) {
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: "Не получилось обработать запрос. Записи не изменились.",
            cards: [],
            tone: "error",
            retryText: text,
          },
        ]);
        setLive("Ошибка обработки. Можно повторить.");
        phaseRef.current = "idle";
        setPhase("idle");
        return;
      }
      const result = answer({
        text,
        today,
        records: recordsRef.current,
        pending: pendingRef.current,
        makeId: () => crypto.randomUUID(),
      });
      setRecords(result.records);
      setPending(result.pending);
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", ...result.message }]);
      setLive(result.message.text);
      phaseRef.current = "idle";
      setPhase("idle");
    }, 680);
  }

  function retry(message) {
    setMessages((items) => items.filter((item) => item.id !== message.id));
    submitText(message.retryText, { echoUser: false });
  }

  function cancelDraft() {
    if (!pendingRef.current) return;
    setPending(null);
    const note = cancelPending();
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", ...note }]);
    setLive(note.text);
  }

  function chooseShortcut(shortcut) {
    if (shortcut.hint === "task" || shortcut.hint === "meeting") {
      setChatSaved("");
      setChatEditor({ type: shortcut.hint, title: "", date: "", time: "", completed: false });
      return;
    }
    if (shortcut.submit) {
      submitText(shortcut.submit);
      return;
    }
    setHintId((current) => (current === shortcut.hint ? null : shortcut.hint));
    setRecognized(false);
    focusInput();
  }

  function openMic() {
    if (phaseRef.current !== "idle") return;
    if (micUnavailable) {
      setDialog("denied");
      return;
    }
    if (!micExplained) {
      setDialog("explain");
      return;
    }
    setUnheard(false);
    phaseRef.current = "recording";
    setPhase("recording");
  }

  function startRecording() {
    setMicExplained(true);
    setDialog(null);
    phaseRef.current = "recording";
    setPhase("recording");
  }

  function finishRecording(line) {
    if (armUnheard) {
      setArmUnheard(false);
      phaseRef.current = "recognizing";
      setPhase("recognizing");
      setLive("Распознаю речь");
      window.setTimeout(() => {
        phaseRef.current = "idle";
        setPhase("idle");
        setUnheard(true);
        setRecognized(false);
        setLive("Речь не распознана");
      }, 520);
      return;
    }
    phaseRef.current = "recognizing";
    setPhase("recognizing");
    setLive("Распознаю речь");
    window.setTimeout(() => {
      setDraft(line);
      setRecognized(true);
      phaseRef.current = "idle";
      setPhase("idle");
      setLive("Текст распознан и его можно исправить");
      focusInput();
    }, 520);
  }

  function toggleSpeak(message) {
    if (speakingId === message.id) {
      speechRef.current?.stop();
      setSpeakingId(null);
      return;
    }
    speechRef.current?.stop();
    const playback = startSpeech(spokenText(message, today), () => {
      setSpeakingId((current) => (current === message.id ? null : current));
    });
    speechRef.current = playback;
    setSpeechSimulated(playback.simulated);
    setSpeakingId(message.id);
  }

  function resetDemo() {
    speechRef.current?.stop();
    const fresh = emptyState(today);
    setMessages([]);
    setRecords(fresh.records);
    setPending(null);
    setMicUnavailable(false);
    setDraft("");
    setHintId(null);
    setRecognized(false);
    setUnheard(false);
    setArmFail(false);
    setArmUnheard(false);
    setSpeakingId(null);
    setConfirmReset(false);
    setDialog(null);
    setLive("Демонстрационные данные сброшены");
  }

  function defaultLine() {
    if (pending) return pending.draft.date ? "В 15:00" : "Завтра в 15:00";
    if (hintId === "task") return voiceLines[0];
    if (hintId === "meeting") return voiceLines[2];
    if (hintId === "search") return "Найди задачу про презентацию";
    return "Что у меня сегодня?";
  }

  if (!onboardingDone) {
    return <Onboarding installation={installation} onDone={() => setOnboardingDone(true)} />;
  }

  return (
    <div className={`shell workspace workspace--${mobileView}`}>
      <nav className="workspace-nav" aria-label="Разделы приложения">
        <button aria-pressed={mobileView === "chat"} onClick={() => setMobileView("chat")}>Чат</button>
        <button aria-pressed={mobileView === "plans"} onClick={() => setMobileView("plans")}>Мои планы</button>
      </nav>
      <Planner records={records} today={today}
        onSave={saveRecord}
        onToggle={id => setRecords(items => items.map(item => item.id === id ? { ...item, completed: !item.completed } : item))}
        onDelete={id => setRecords(items => items.filter(item => item.id !== id))}
        onRestore={record => setRecords(items => items.some(item => item.id === record.id) ? items : [...items, record])}
      />

      <div className="stage">
        <a className="skip" href="#request">
          К полю ввода
        </a>
        <header className="topbar">
          <div className="brand">
            <span className="brand__mark" aria-hidden="true" />
            <h1 className="brand__name">Ассистент</h1>
          </div>
          <p className="demo-pill">Демо, не ИИ</p>
          <button type="button" className="button button--quiet button--small" onClick={() => setDialog("menu")}>
            Меню
          </button>
        </header>

        <div className="thread">
          <p className="sr-only" aria-live="polite">
            {live}
          </p>
          {messages.length === 0 && phase === "idle" && (
            <Welcome
              primary={WELCOME_PRIMARY}
              more={moreLines}
              open={moreExamples}
              onToggle={() => setMoreExamples((value) => !value)}
              onPick={submitText}
            />
          )}
          <MessageList
            messages={messages.map(message => ({ ...message, cards: message.cards?.map(card => records.find(record => record.id === card.id) || { ...card, deleted: true }) }))}
            today={today}
            pending={pending}
            phase={phase}
            speakingId={speakingId}
            speechSimulated={speechSimulated}
            onEdit={record => { setChatSaved(""); setChatEditor(record); }}
            onSpeak={toggleSpeak}
            onRetry={retry}
            onCancel={cancelDraft}
            bottomRef={bottomRef}
          />
        </div>

        <div className="dock">
          <div className="mobile-shortcuts">
            <ShortcutList shortcuts={SHORTCUTS} hint={hintId} onShortcut={chooseShortcut} />
          </div>
        {chatSaved && <div className="undo-notice" role="status"><span>{chatSaved}</span><button className="icon-button" aria-label="Скрыть сообщение о сохранении" onClick={() => setChatSaved("")}>×</button></div>}
        <Composer
          today={today}
          draft={draft}
          hint={hint}
          pending={pending}
          recognized={recognized}
          unheard={unheard}
          phase={phase}
          inputRef={inputRef}
          micUnavailable={micUnavailable}
          onDraft={setDraft}
          onSubmit={submitText}
          onMic={openMic}
          onCancelPending={cancelDraft}
          onDismissHint={() => setHintId(null)}
          onExample={submitText}
          onDismissUnheard={() => {
            setUnheard(false);
            focusInput();
          }}
          onRetryVoice={openMic}
        />
        </div>
      </div>

      {chatEditor && <RecordEditor record={chatEditor} onClose={() => setChatEditor(null)} onSave={record => { const saved = saveRecord(record); if (!record.id) setMessages(items => [...items, { id: crypto.randomUUID(), role: "assistant", text: "Запись сохранена в ваших планах.", cards: [saved], tone: "success" }]); setChatEditor(null); setChatSaved(`Сохранено: ${record.title}`); }} />}
      {phase === "recording" && (
        <RecordingSheet
          lines={voiceLines}
          initialLine={defaultLine()}
          onFinish={finishRecording}
          onCancel={() => {
            phaseRef.current = "idle";
            setPhase("idle");
          }}
        />
      )}
      {phase === "recognizing" && (
        <div className="overlay overlay--center" role="status" aria-live="polite">
          <p className="modal modal--status">Распознаю речь…</p>
        </div>
      )}

      {dialog === "explain" && (
        <Modal title="Нужен микрофон" onClose={() => setDialog(null)}>
          <p>
            Он нужен, чтобы записать запрос. В прототипе микрофон не включается: речь имитируется на этом устройстве и никуда не отправляется. Текст можно исправить перед отправкой.
          </p>
          <div className="modal__actions">
            <button type="button" className="button" data-autofocus onClick={startRecording}>
              Начать запись
            </button>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => {
                setMicExplained(true);
                setDialog(null);
                focusInput();
              }}
            >
              Писать текстом
            </button>
          </div>
        </Modal>
      )}

      {dialog === "denied" && (
        <Modal title="Микрофон недоступен" onClose={() => setDialog(null)}>
          <p>Запись не начнётся. Напишите запрос в поле внизу — ассистентом можно пользоваться без микрофона.</p>
          <div className="modal__actions">
            <button
              type="button"
              className="button"
              data-autofocus
              onClick={() => {
                setDialog(null);
                focusInput();
              }}
            >
              Писать текстом
            </button>
          </div>
        </Modal>
      )}

      {dialog === "menu" && (
        <Modal
          title="Демонстрационное меню"
          onClose={() => {
            setConfirmReset(false);
            setDialog(null);
          }}
        >
          <p>
            История и записи хранятся только в этом браузере. Голос, поиск и ответы — заранее подготовленные сценарии, не живой ассистент.
          </p>
          <section className="install-card" aria-labelledby="install-title">
            <h3 id="install-title">{installation.installed ? "Приложение установлено" : "На домашний экран"}</h3>
            {installation.installed ? (
              <p>Открывайте «Ассистент» по иконке на домашнем экране.</p>
            ) : (
              <>
                <p>Запускайте ассистента по иконке, без адресной строки браузера.</p>
                {installation.available && (
                  <button type="button" className="button" onClick={installation.install} disabled={installation.installing}>
                    Установить приложение
                  </button>
                )}
                <ol className="install-steps">
                  <li><strong>iPhone:</strong> откройте сайт в Safari → «Поделиться» → «На экран Домой». Если есть переключатель «Открывать как веб-приложение», включите его.</li>
                  <li><strong>Android:</strong> откройте сайт в Chrome → меню ⋮ → «Установить приложение» или «Добавить на главный экран».</li>
                </ol>
                <p>После добавления закройте вкладку и запустите приложение по новой иконке. Для демо пока нужен интернет.</p>
              </>
            )}
          </section>
          {confirmReset ? (
            <div className="confirm">
              <p>Сбросить историю и вернуть демонстрационные записи?</p>
              <div className="modal__actions">
                <button type="button" className="button" onClick={resetDemo}>
                  Сбросить
                </button>
                <button type="button" className="button button--quiet" onClick={() => setConfirmReset(false)}>
                  Оставить
                </button>
              </div>
            </div>
          ) : (
            <div className="menu-list">
              <button type="button" onClick={() => setConfirmReset(true)}>
                Сбросить демоданные
              </button>
              <button
                type="button"
                onClick={() => {
                  setDialog(null);
                  setOnboardingDone(false);
                }}
              >
                Показать онбординг снова
              </button>
              <button type="button" aria-pressed={micUnavailable} onClick={() => setMicUnavailable((value) => !value)}>
                Микрофон недоступен: {micUnavailable ? "включено" : "выключено"}
              </button>
              <button type="button" aria-pressed={armUnheard} onClick={() => setArmUnheard((value) => !value)}>
                Следующая запись не распознается: {armUnheard ? "да" : "нет"}
              </button>
              <button type="button" aria-pressed={armFail} onClick={() => setArmFail((value) => !value)}>
                Следующий запрос завершится ошибкой: {armFail ? "да" : "нет"}
              </button>
            </div>
          )}
          <div className="menu-scenarios">
            <p className="kicker">Запустить сценарий</p>
            <ul className="examples">
              {voiceLines.map((line) => (
                <li key={line}>
                  <button
                    type="button"
                    onClick={() => {
                      setDialog(null);
                      submitText(line);
                    }}
                  >
                    {line}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </div>
  );
}
