const state = {
  input: "",
  templates: loadStorage(
    STORAGE_KEYS.templates,
    DEFAULT_TEMPLATES
  ),
  noteTemplate: loadStorage(
    STORAGE_KEYS.noteTemplate,
    "{input}\n\n{templates}"
  ),
  settings: loadStorage(STORAGE_KEYS.settings, {
    autoCopyDelay: 1500,
    previewDebounce: 300,
    clearDelay: 30000
  }),
  pane: loadStorage(STORAGE_KEYS.pane, {
    x: 20,
    y: 20,
    width: 420,
    height: 650,
    minimized: false
  })
};

let previewTimeout;
let copyTimeout;
let clearTimeoutId;
let lastCopiedNote = "";

const inputEl = document.getElementById("input");
const previewEl = document.getElementById("preview");
const toastEl = document.getElementById("toast");
const noteTemplateInput = document.getElementById("noteTemplateInput");
const templateError = document.getElementById("templateError");

initializeSettingsUI(state);
renderTemplateEditor();
applyPaneState();

noteTemplateInput.value = state.noteTemplate;

inputEl.addEventListener("input", handleInput);
document.getElementById("copyBtn").addEventListener("click", manualCopy);
document.getElementById("clearBtn").addEventListener("click", clearInput);
document.getElementById("minimizeBtn").addEventListener("click", toggleMinimize);

noteTemplateInput.addEventListener("input", () => {
  const value = noteTemplateInput.value;

  if (!validateNoteTemplate(value)) {
    templateError.textContent =
      "Note template must include {input} and {templates}.";
    return;
  }

  templateError.textContent = "";
  state.noteTemplate = value;

  saveStorage(STORAGE_KEYS.noteTemplate, value);
  updatePreview();
});

function handleInput(event) {
  state.input = event.target.value;

  clearTimeout(previewTimeout);
  clearTimeout(copyTimeout);
  clearTimeout(clearTimeoutId);

  previewTimeout = setTimeout(() => {
    updatePreview();
  }, state.settings.previewDebounce);

  copyTimeout = setTimeout(() => {
    autoCopy();
  }, state.settings.autoCopyDelay);

  clearTimeoutId = setTimeout(() => {
    clearInput();
  }, state.settings.clearDelay);
}

function matchTemplates(input) {
  const lower = input.toLowerCase();

  return state.templates
    .filter(template =>
      template.triggers.some(trigger =>
        lower.includes(trigger.toLowerCase())
      )
    )
    .sort((a, b) => a.priority - b.priority);
}

function processStaticBlocks(text) {
  return text.replace(/\{static:([\s\S]*?)\}/g, (_, content) => {
    return content;
  });
}

function renderNote(input, matchedTemplates, noteTemplate) {
  const templateText = matchedTemplates
    .map(t => t.content.trim())
    .join("\n\n");

  let output = noteTemplate
    .replace("{input}", input.trim())
    .replace("{templates}", templateText);

  output = processStaticBlocks(output);

  return output.trim();
}

function updatePreview() {
  const matched = matchTemplates(state.input);

  const note = renderNote(
    state.input,
    matched,
    state.noteTemplate
  );

  previewEl.innerHTML = renderMarkdown(note);
}

async function autoCopy() {
  const matched = matchTemplates(state.input);

  const note = renderNote(
    state.input,
    matched,
    state.noteTemplate
  );

  if (!note || note === lastCopiedNote) {
    return;
  }

  const success = await copyToClipboard(note);

  if (success) {
    lastCopiedNote = note;
    showToast("Copied!");
  } else {
    showToast("Clipboard failed");
  }
}

function manualCopy() {
  autoCopy();
}

function clearInput() {
  state.input = "";
  inputEl.value = "";
  previewEl.innerHTML = "";
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");

  setTimeout(() => {
    toastEl.classList.add("hidden");
  }, 1500);
}

function validateNoteTemplate(template) {
  return (
    template.includes("{input}") &&
    template.includes("{templates}")
  );
}

function renderTemplateEditor() {
  const container = document.getElementById("templateList");
  container.innerHTML = "";

  state.templates.forEach(template => {
    const card = document.createElement("div");
    card.className = "template-card";

    card.innerHTML = `
      <label>Name</label>
      <input value="${template.name}" />

      <label>Triggers (comma separated)</label>
      <input value="${template.triggers.join(", ")}" />

      <label>Content</label>
      <textarea>${template.content}</textarea>
    `;

    container.appendChild(card);
  });
}

function applyPaneState() {
  const pane = document.getElementById("app");

  pane.style.width = `${state.pane.width}px`;
  pane.style.height = `${state.pane.height}px`;
}

function toggleMinimize() {
  document.getElementById("paneBody").classList.toggle("hidden");
}

setupDrag();
setupResize();

function setupDrag() {
  const pane = document.getElementById("app");
  const header = document.getElementById("paneHeader");

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  header.addEventListener("pointerdown", e => {
    dragging = true;

    offsetX = e.clientX - pane.offsetLeft;
    offsetY = e.clientY - pane.offsetTop;
  });

  document.addEventListener("pointermove", e => {
    if (!dragging) return;

    pane.style.left = `${e.clientX - offsetX}px`;
    pane.style.top = `${e.clientY - offsetY}px`;
  });

  document.addEventListener("pointerup", () => {
    dragging = false;
  });
}

function setupResize() {
  const pane = document.getElementById("app");
  const handle = document.getElementById("resizeHandle");

  let resizing = false;

  handle.addEventListener("pointerdown", () => {
    resizing = true;
  });

  document.addEventListener("pointermove", e => {
    if (!resizing) return;

    pane.style.width = `${e.clientX - pane.offsetLeft}px`;
    pane.style.height = `${e.clientY - pane.offsetTop}px`;
  });

  document.addEventListener("pointerup", () => {
    resizing = false;
  });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

updatePreview();