import { useEffect, useState } from "react";

// A same-origin probe measures reachability; it does not send user data.
export function ConnectionNotice() {
  const [status, setStatus] = useState("ok");
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    let stopped = false;
    let controller;
    let recoveryTimer;
    let previous = "ok";
    const update = (next) => {
      if (stopped || next === previous) return;
      clearTimeout(recoveryTimer);
      const recovered = next === "ok" && previous !== "ok";
      previous = next;
      setDismissed(false);
      setStatus(recovered ? "restored" : next);
      if (recovered) recoveryTimer = setTimeout(() => setStatus("ok"), 3500);
    };
    const check = async () => {
      if (document.hidden || controller) return;
      if (!navigator.onLine) { update("offline"); return; }
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 8000);
      const started = performance.now();
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}connection-check.txt?t=${Date.now()}`, {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok || (await response.text()).trim() !== "arahis-online") update("unavailable");
        else update(performance.now() - started > 2500 ? "slow" : "ok");
      } catch {
        update(navigator.onLine ? "unavailable" : "offline");
      } finally { clearTimeout(timeout); controller = null; }
    };
    const offline = () => update("offline");
    window.addEventListener("offline", offline);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    check();
    const interval = setInterval(check, 30000);
    return () => {
      stopped = true;
      clearInterval(interval);
      clearTimeout(recoveryTimer);
      controller?.abort();
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  const messages = {
    offline: ["Нет интернета", "Проверьте Wi-Fi или мобильную сеть."],
    slow: ["Плохой интернет", "Загрузка может занять больше времени."],
    unavailable: ["Не удаётся подключиться", "Проверим соединение автоматически."],
    restored: ["Соединение восстановлено", "Вы снова на связи."],
  };
  const message = messages[status];
  return <div className="connection-region" role="status" aria-live="polite" aria-atomic="true">
    {message && !dismissed && <div className={`connection-notice connection-notice--${status}`}>
      <span className="connection-notice__icon" aria-hidden="true">{status === "restored" ? "✓" : "!"}</span>
      <div><strong>{message[0]}</strong><p>{message[1]}</p></div>
      <button className="connection-notice__close" aria-label="Скрыть уведомление о соединении" onClick={() => setDismissed(true)}>×</button>
    </div>}
  </div>;
}
