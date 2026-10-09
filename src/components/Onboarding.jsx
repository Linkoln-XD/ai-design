import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    kicker: "Зачем это",
    title: "Всё нужное — в одном разговоре",
    text: "Ассистент записывает задачи, напоминания и встречи. Можно спросить планы на день или найти старую запись, не открывая отдельные формы.",
  },
  {
    kicker: "Как говорить",
    title: "Текстом или голосом",
    text: "Подойдут обычные фразы. В прототипе голос имитируется: после «записи» текст можно исправить и только потом отправить.",
    examples: [
      "В пятницу нужно отправить отчёт",
      "Напомни завтра в 10 позвонить Ивану",
      "Что у меня сегодня?",
      "Найди задачу про презентацию",
    ],
  },
  {
    kicker: "Первый шаг",
    title: "Начните с одного запроса",
    text: "Спросите, что запланировано на сегодня, или добавьте задачу. Регистрация не нужна — можно сразу перейти к диалогу.",
  },
];

export function Onboarding({ onDone }) {
  const titleRef = useRef(null);
  const [step, setStep] = useState(0);
  const current = STEPS[step];

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
          Шаг {step + 1} из {STEPS.length}
        </p>
        <div className="steps" aria-hidden="true">
          {STEPS.map((item, index) => (
            <span key={item.kicker} className={index === step ? "is-on" : index < step ? "is-done" : ""} />
          ))}
        </div>
        <p className="kicker">{current.kicker}</p>
        <h1 id="onboarding-title" ref={titleRef} tabIndex={-1}>
          {current.title}
        </h1>
        <p className="lede">{current.text}</p>
        {current.examples && (
          <ul className="quotes">
            {current.examples.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
        )}
        <div className="onboarding__actions">
          {step > 0 && (
            <button type="button" className="button button--quiet" onClick={() => setStep(step - 1)}>
              Назад
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="button" onClick={() => setStep(step + 1)}>
              Дальше
            </button>
          ) : (
            <button type="button" className="button" onClick={onDone}>
              Перейти к ассистенту
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
