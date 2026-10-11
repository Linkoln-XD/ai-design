import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import { ConnectionNotice } from "./components/ConnectionNotice.jsx";

function Ready() {
  useEffect(() => {
    window.clearTimeout(window.__bootTimer);
    document.getElementById("boot-screen")?.remove();
  }, []);
  return <><App /><ConnectionNotice /></>;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Ready />
  </StrictMode>,
);
