import { useEffect, useMemo, useRef, useState } from "react";
import { answer, cancelPending } from "./lib/assistant.js";
import { emptyDayQuestion, formatWhen, startOfDay } from "./lib/dates.js";
import { HINTS, SHORTCUTS, VOICE_LINES, WELCOME_MORE, WELCOME_PRIMARY } from "./lib/scenarios.js";
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

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  function focusInput() {
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function submitText(raw, { echoUser = true } = {}) {
    const text = raw.trim();
    if (!text || phaseRef.current === "processing" || phaseRef.current === "recording" || phaseRef.current === "recognizing") return;
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
    if (pending) return "В 15:00";
    if (hintId === "task") return voiceLines[0];
    if (hintId === "meeting") return voiceLines[2];
    if (hintId === "search") return "Найди задачу про презентацию";
    return "Что у меня сегодня?";
  }

  if (!onboardingDone) {
    return <Onboarding onDone={() => setOnboardingDone(true)} />;
  }

  return (
    <div className="shell">
      <aside className="rail">
        <p className="rail__label">Быстрые действия</p>
        <p className="rail__note">
          Ответы подготовлены заранее. Это не ИИ, микрофон и уведомления не работают по-настоящему.
        </p>
        <ShortcutList shortcuts={SHORTCUTS} hint={hintId} onShortcut={chooseShortcut} orientation="vertical" />
      </aside>

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
            messages={messages}
            today={today}
            pending={pending}
            phase={phase}
            speakingId={speakingId}
            speechSimulated={speechSimulated}
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
        <Composer
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
