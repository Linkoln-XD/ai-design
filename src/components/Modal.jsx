import { useEffect, useRef } from "react";
import { CloseIcon } from "./icons.jsx";

export function Modal({ title, children, onClose, labelledBy = "modal-title" }) {
  const ref = useRef(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const root = ref.current;
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function focusable() {
      if (!root) return [];
      return [...root.querySelectorAll("button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])")].filter(
        (element) => !element.disabled,
      );
    }

    const preferred = root?.querySelector("[data-autofocus]");
    (preferred || focusable()[0])?.focus();

    function onKey(event) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  return (
    <div className="overlay overlay--center" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div className="modal__head">
          <h2 id={labelledBy}>{title}</h2>
          <button type="button" className="icon-button" aria-label="Закрыть" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
