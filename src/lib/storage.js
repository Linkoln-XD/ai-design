import { buildSeed } from "./seed.js";

export const STORAGE_KEY = "assistant-demo-v1";

export function emptyState(today) {
  return {
    version: 1,
    onboardingDone: false,
    micExplained: false,
    micUnavailable: false,
    messages: [],
    records: buildSeed(today),
    pending: null,
  };
}

export function loadState(today) {
  if (typeof localStorage === "undefined") return emptyState(today);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState(today);
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || !Array.isArray(parsed.records) || !Array.isArray(parsed.messages)) {
      return emptyState(today);
    }
    return {
      ...emptyState(today),
      ...parsed,
      records: parsed.records,
      messages: parsed.messages,
    };
  } catch {
    return emptyState(today);
  }
}

export function saveState(state) {
  if (typeof localStorage === "undefined") return;
  const payload = {
    version: 1,
    onboardingDone: state.onboardingDone,
    micExplained: state.micExplained,
    micUnavailable: state.micUnavailable,
    messages: state.messages,
    records: state.records,
    pending: state.pending,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
