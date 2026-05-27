const STORAGE_KEYS = {
  templates: "smartchart:templates",
  noteTemplate: "smartchart:noteTemplate",
  settings: "smartchart:settings",
  pane: "smartchart:pane"
};

function saveStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}