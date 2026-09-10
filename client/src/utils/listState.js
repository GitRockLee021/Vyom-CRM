export function loadListState(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || 'null') || {};
  } catch {
    return {};
  }
}

export function saveListState(key, state) {
  try {
    sessionStorage.setItem(key, JSON.stringify(state));
  } catch { /* storage unavailable */ }
}