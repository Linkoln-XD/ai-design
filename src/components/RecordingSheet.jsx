import { useEffect, useRef, useState } from "react";

function formatTimer(total) {
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function RecordingSheet({ lines, initialLine, onFinish, onCancel }) {
  const [selected, setSelected] = useState(initialLine);
  const [seconds, setSeconds] = useState(0);
  const stopRef = useRef(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    stopRef.current?.focus();
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onCancelRef.current();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="overlay" role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="recording-title">
        <div className="sheet__status">
          <span className="rec-dot" aria-hidden="true" />
          <div>
            <h2 id="recording-title">Идёт запись</h2>
            <p className="sheet__timer" aria-live="polite">
              {formatTimer(seconds)}
            </p>
          </div>
        </div>
        <div className="wave" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <fieldset className="sheet__lines">
          <legend>Что сказать — имитация речи</legend>
          {lines.map((line) => (
            <label key={line} className={selected === line ? "choice is-on" : "choice"}>
              <input
                type="radio"
                name="recognized-line"
                checked={selected === line}
                onChange={() => setSelected(line)}
              />
              {line}
            </label>
          ))}
        </fieldset>
        <div className="sheet__actions">
          <button ref={stopRef} type="button" className="button" onClick={() => onFinish(selected)}>
            Завершить
          </button>
          <button type="button" className="button button--quiet" onClick={onCancel}>
            Отменить
          </button>
        </div>
      </div>
    </div>
  );
}
