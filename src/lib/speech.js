export function startSpeech(text, onEnd) {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onEnd();
  };

  if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
    const timer = window.setTimeout(finish, playbackDuration(text));
    return {
      simulated: true,
      stop() {
        window.clearTimeout(timer);
        finish();
      },
    };
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  utterance.rate = 1;
  utterance.onend = finish;
  utterance.onerror = () => {
    const timer = window.setTimeout(finish, playbackDuration(text));
    utterance.__fallback = timer;
  };
  synth.cancel();
  synth.speak(utterance);

  return {
    simulated: false,
    stop() {
      if (utterance.__fallback) window.clearTimeout(utterance.__fallback);
      synth.cancel();
      finish();
    },
  };
}

function playbackDuration(text) {
  return Math.min(9000, 900 + text.length * 42);
}
