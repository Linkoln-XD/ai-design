import { useEffect, useRef, useState } from "react";

export function useInstall() {
  const promptRef = useRef(null);
  const [available, setAvailable] = useState(false);
  const [installed, setInstalled] = useState(() => window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const sync = () => setInstalled(display.matches || window.navigator.standalone === true);
    function onPrompt(event) {
      event.preventDefault();
      promptRef.current = event;
      setAvailable(true);
    }
    function onInstalled() {
      promptRef.current = null;
      setAvailable(false);
      setInstalled(true);
    }
    sync();
    display.addEventListener("change", sync);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      display.removeEventListener("change", sync);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    const prompt = promptRef.current;
    if (!prompt) return;
    promptRef.current = null;
    setAvailable(false);
    setInstalling(true);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      // Manual installation instructions stay available if the browser declines.
    } finally {
      setInstalling(false);
    }
  }

  return { available, installed, installing, install };
}
