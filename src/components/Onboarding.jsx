import { useEffect, useRef, useState } from "react";

function StepIcon({ kind }) {
  const paths = {
    task: <path d="m5 12 4 4L19 6" />,
    calendar: <><rect x="4" y="6" width="16" height="15" rx="3" /><path d="M8 3v6m8-6v6M4 11h16" /></>,
    search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>,
    share: <><path d="M12 15V3m-4 4 4-4 4 4M7 10H4v11h16V10h-3" /></>,
    add: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8m-4-4h8" /></>,
    app: <><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3" /></>,
    menu: <><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11v1a7 7 0 0 0 14 0v-1m-7 8v3m-4 0h8" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

const STEPS = [
  { kicker: "Планы", title: "Все планы рядом", text: "Запишите сейчас. Найдите, когда нужно.", items: [['task', 'Задачи'], ['calendar', 'Встречи'], ['search', 'Поиск']] },
  { kicker: "Запрос", title: "Напишите или скажите", text: "Одна фраза — и план готов.", voice: true },
  { kicker: "Начало", title: "С чего начнём?", text: "Добавьте задачу или спросите о планах.", ready: true },
];

export function Onboarding({ onDone, installation }) {
  const [mobile] = useState(() => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)) || window.matchMedia('(max-width: 767px)').matches);
  const [platform, setPlatform] = useState(() => /Android/i.test(navigator.userAgent) ? 'android' : 'ios');
  const showInstall = mobile && !installation.installed;
  const steps = showInstall ? [...STEPS.slice(0, 2), {
    kicker: 'Всегда под рукой',
    title: 'Всегда под рукой',
    text: 'Добавьте иконку на экран «Домой».',
    install: true,
  }] : STEPS;
  const titleRef = useRef(null);
  const [step, setStep] = useState(0);
  const current = steps[step];

  useEffect(() => {
    titleRef.current?.focus();
  }, [step]);

  return (
    <main className="onboarding">
      <button type="button" className="text-button onboarding__skip" onClick={onDone}>
        Пропустить
      </button>
      <section className="onboarding__card" aria-labelledby="onboarding-title">
        <p className="kicker">
          Шаг {step + 1} из {steps.length}
        </p>
        <div className="steps" aria-hidden="true">
          {steps.map((item, index) => (
            <span key={item.kicker} className={index === step ? "is-on" : index < step ? "is-done" : ""} />
          ))}
        </div>

        <h1 id="onboarding-title" ref={titleRef} tabIndex={-1}>
          {current.title}
        </h1>
        <p className="lede">{current.text}</p>
        {current.items && <ul className="onboarding-symbols">{current.items.map(([icon, label]) => <li key={icon}><StepIcon kind={icon} /><span>{label}</span></li>)}</ul>}
        {current.voice && <><div className="onboarding-example"><StepIcon kind="mic" /><p>«Встреча завтра в 15:00»</p></div><p className="onboarding-install__note">Голос в демо имитируется. Текст можно исправить.</p></>}
        {current.ready && <div className="onboarding-example"><StepIcon kind="calendar" /><p>«Что у меня сегодня?»</p></div>}
        {current.install && <div className="onboarding-install">
          <div className="segmented" role="group" aria-label="Инструкция для устройства">
            <button type="button" aria-pressed={platform === 'ios'} onClick={() => setPlatform('ios')}>iPhone / iPad</button>
            <button type="button" aria-pressed={platform === 'android'} onClick={() => setPlatform('android')}>Android</button>
          </div>
          <p className="onboarding-browser">{platform === 'ios' ? 'В Safari' : 'В Chrome'}</p>
          <ol className="install-visual">{(platform === 'ios'
            ? [['share', 'Поделиться'], ['add', 'На экран Домой'], ['app', 'Добавить']]
            : [['menu', 'Меню ⋮'], ['add', 'На главный экран'], ['app', 'Установить']]
          ).map(([icon, label], index) => <li key={icon}><span className="install-visual__icon"><StepIcon kind={icon} /></span><span><small>{index + 1}</small>{label}</span></li>)}</ol>
          <details className="install-details" key={platform}><summary>Подробнее</summary><p>{platform === 'ios' ? 'В Safari откройте «Поделиться» (иногда внутри меню), затем «На экран Домой». Если есть «Открывать как веб-приложение», включите его. Нажмите «Добавить».' : 'В меню Chrome выберите «Добавить на главный экран», затем «Установить», если доступно. Подтвердите добавление.'} Запускайте ассистента по новой иконке. Инструкция также есть в меню ассистента.</p></details>
          {installation.available && <button type="button" className="button install-now" disabled={installation.installing} onClick={installation.install}>{installation.installing ? 'Открываем установку…' : 'Установить приложение'}</button>}
          <p className="onboarding-install__note">Для работы нужен интернет.</p>
        </div>}
        <div className="onboarding__actions">
          {step > 0 && (
            <button type="button" className="button button--quiet" onClick={() => setStep(step - 1)}>
              Назад
            </button>
          )}
          {step < steps.length - 1 ? (
            <button type="button" className="button" onClick={() => setStep(step + 1)}>
              Дальше
            </button>
          ) : (
            <button type="button" className="button" onClick={onDone}>
              {current.install ? "Пока в браузере" : "Начать"}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
