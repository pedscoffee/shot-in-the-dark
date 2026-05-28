/**
 * SmartChart — app.js
 * Core logic: template matching, note rendering, clipboard,
 * focus mode, auto-copy, auto-clear, state persistence.
 *
 * Design decisions:
 *  - Copies Markdown source text (not HTML) to clipboard
 *  - Debounce preview: 300ms | Auto-copy: 1.5s | Auto-clear: 30s
 *  - Pane fills the browser window
 *  - Focus mode hides everything below the input for EMR side-by-side use
 */

'use strict';

/* ════════════════════════════════════════════════
   CONSTANTS & DEFAULTS
════════════════════════════════════════════════ */

const STORAGE_KEYS = {
  PANE_STATE:    'sc_pane_state',
  NOTE_TEMPLATE: 'sc_note_template',
  TEMPLATES:     'sc_templates',
  BEHAVIOR:      'sc_behavior',
};

const DEFAULT_NOTE_TEMPLATE = `{input}\n\n{templates}`;

/** Default templates sourced from templates.txt. */
const DEFAULT_TEMPLATES = [
  {
    id: 'well-child-health-maintenance',
    name: 'Well Child / Health Maintenance',
    triggers: ['well child', 'well-child', 'well visit', 'health maintenance', 'checkup', 'check-up', 'annual exam', 'physical', 'preventive'],
    content: 'All forms, labs, immunizations, and patient concerns reviewed and addressed appropriately. Screening questions, past medical history, past social history, medications, and growth chart reviewed. Age-appropriate anticipatory guidance reviewed and printed in AVS. Parent questions addressed.',
    priority: 1,
  },
  {
    id: 'illness-supportive-care',
    name: 'Illness Supportive Care',
    triggers: ['illness', 'sick', 'fever', 'cough', 'congestion', 'runny nose', 'uri', 'cold', 'rash', 'sore throat', 'strep', 'ear pain', 'earache', 'otitis', 'vomiting', 'diarrhea', 'dehydration', 'trouble breathing', 'shortness of breath', 'wheezing'],
    content: 'Recommended supportive care with OTC medications as needed. Return precautions given including increasing pain, worsening fever, dehydration, new symptoms, prolonged symptoms, worsening symptoms, and other concerns. Caregiver expressed understanding and agreement with treatment plan.',
    priority: 2,
  },
  {
    id: 'injury-supportive-care',
    name: 'Injury Supportive Care',
    triggers: ['injury', 'laceration', 'cut', 'wound', 'trauma', 'bruise', 'contusion', 'sprain', 'strain', 'abrasion', 'scrape', 'fracture'],
    content: 'Recommended supportive care with Tylenol, Motrin, rest, ice, compression, elevation, and gradual return to activity as appropriate. Return precautions given including increasing pain, swelling, or failure to improve.',
    priority: 3,
  },
  {
    id: 'ear-infection-risk',
    name: 'Ear Infection Risk',
    triggers: ['ear infection', 'otitis', 'otitis media', 'ear pain', 'earache', 'ear ache'],
    content: 'Risk of untreated otitis media includes persistent pain and fever, hearing loss, and mastoiditis.',
    priority: 4,
  },
  {
    id: 'strep-test-risk',
    name: 'Strep Test Risk',
    triggers: ['strep test', 'rapid strep', 'throat culture', 'strep throat', 'strep'],
    content: 'Risk of untreated strep throat includes rheumatic fever and peritonsillar abscess. This problem is moderate risk due to pending lab results which may necessitate further pharmacologic management.',
    priority: 5,
  },
  {
    id: 'dehydration-risk',
    name: 'Dehydration Risk',
    triggers: ['dehydration', 'vomiting', 'diarrhea', 'decreased urination', 'not drinking', 'poor intake', 'poor po'],
    content: 'Patient is at risk for dehydration, which would warrant emergency room care or admission for IV fluids.',
    priority: 6,
  },
  {
    id: 'respiratory-distress-risk',
    name: 'Respiratory Distress Risk',
    triggers: ['trouble breathing', 'difficulty breathing', 'shortness of breath', 'respiratory distress', 'wheezing', 'labored breathing'],
    content: 'Patient is at risk for worsening respiratory distress and clinical deterioration, which would need emergency room care or hospital admission.',
    priority: 7,
  },
  {
    id: 'pcmh-reminder',
    name: 'PCMH Reminder',
    triggers: ['adhd', 'weight', 'obesity', 'strep throat'],
    content: 'PCMH Reminder',
    priority: 8,
  },
  {
    id: 'follow-up',
    name: 'Follow-Up Dropdown',
    type: 'dropdown',
    triggers: ['follow up', 'follow-up', 'followup'],
    label: 'Follow-Up',
    join: 'lines',
    options: [
      'Follow up as needed for new or worsening symptoms.',
      'Follow up in 2-3 days if symptoms are not improving.',
      'Follow up in 1 week if symptoms persist.',
      'Return sooner for worsening pain, fever, breathing trouble, dehydration, or other concerns.',
      'Go to the emergency room for severe symptoms or any life-threatening concern.',
    ],
    priority: 20,
    category: 'Dropdown',
  },
];

const DEFAULT_BEHAVIOR = {
  autoCopyDelay:   1500,   // ms
  autoClearDelay:  30000,  // ms
  autoCopyEnabled: true,
  plainTextCopy:   false,  // strip Markdown symbols before clipboard
  sourceLabels:    false,  // show [Template Name] labels in preview
};

/* ════════════════════════════════════════════════
   APPLICATION STATE
════════════════════════════════════════════════ */

const state = {
  noteTemplate:    DEFAULT_NOTE_TEMPLATE,
  templates:       typeof structuredClone === 'function' ? structuredClone(DEFAULT_TEMPLATES) : JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
  behavior:        Object.assign({}, DEFAULT_BEHAVIOR),
  currentInput:    '',
  currentNote:     '',        // Final Markdown string ready for clipboard
  matchedTemplates:[],
  activeDropdowns: [],
  dropdownSelections: {},
  autoCopyTimer:   null,
  autoClearTimer:  null,
  previewDebounce: null,
  lastClearedInput:'',   // for undo-clear
  isDragging:      false,
  isResizing:      false,
  dragOffsetX:     0,
  dragOffsetY:     0,
  resizeStartX:    0,
  resizeStartY:    0,
  resizeStartW:    0,
  resizeStartH:    0,
};

/* ════════════════════════════════════════════════
   DOM CACHE
════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);

const dom = {};  // populated in init()

/* ════════════════════════════════════════════════
   LOCAL STORAGE HELPERS
════════════════════════════════════════════════ */

const storage = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
};

/* ════════════════════════════════════════════════
   UTILITIES
════════════════════════════════════════════════ */

function debounce(fn, ms) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ════════════════════════════════════════════════
   TEMPLATE MATCHING
════════════════════════════════════════════════ */

/**
 * matchTemplates(input) → Template[]
 * Case-insensitive trigger matching with word boundaries.
 * Multiple matches appended in priority order.
 */
function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function triggerMatches(input, trigger) {
  const normalized = String(trigger || '').trim().toLowerCase();
  if (!normalized) return false;
  const escaped = escapeRegExp(normalized).replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(input);
}

function matchTemplates(input) {
  if (!input || !input.trim()) return [];
  const lower = input.toLowerCase();
  return state.templates
    .filter(t => Array.isArray(t.triggers) &&
      t.triggers.some(trigger => triggerMatches(lower, trigger))
    )
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

function isDropdownTemplate(t) {
  return t && t.type === 'dropdown';
}

function getTemplateById(id) {
  return state.templates.find(t => t.id === id);
}

function getDropdownSelection(id) {
  if (!state.dropdownSelections[id]) {
    state.dropdownSelections[id] = { values: [], join: null };
  }
  return state.dropdownSelections[id];
}

function collectDropdownIdsFromText(text, ids = new Set(), seen = new Set()) {
  String(text || '').replace(/\{dropdown:([a-zA-Z0-9_-]+)\}/g, (_, id) => {
    if (seen.has(id)) return '';
    seen.add(id);
    const tpl = getTemplateById(id);
    if (isDropdownTemplate(tpl)) ids.add(id);
    if (tpl && tpl.content) collectDropdownIdsFromText(tpl.content, ids, seen);
    return '';
  });
  return ids;
}

function collectActiveDropdowns(matched) {
  const ids = new Set();
  matched.forEach(t => {
    if (isDropdownTemplate(t)) ids.add(t.id);
    collectDropdownIdsFromText(t.content, ids);
  });
  return [...ids]
    .map(id => getTemplateById(id))
    .filter(isDropdownTemplate)
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

/* ════════════════════════════════════════════════
   NOTE RENDERING
════════════════════════════════════════════════ */

/**
 * processStaticPlaceholders(text) → string
 * Replaces {static:TEXT} with TEXT, handling \n escape sequences.
 */
function processStaticPlaceholders(text) {
  return text.replace(/\{static:([^}]*)\}/g, (_, content) =>
    content.replace(/\\n/g, '\n')
  );
}

function joinTemplateOptions(options, mode) {
  if (mode === 'lines') return options.map(option => `- ${option}`).join('\n');
  if (mode === 'paragraphs') return options.join('\n\n');
  if (mode === 'sentence') return options.join(' ');
  if (mode === 'and') {
    if (options.length < 3) return options.join(' and ');
    return `${options.slice(0, -1).join(', ')}, and ${options[options.length - 1]}`;
  }
  if (mode === 'or') {
    if (options.length < 3) return options.join(' or ');
    return `${options.slice(0, -1).join(', ')}, or ${options[options.length - 1]}`;
  }
  if (mode === 'nor') {
    if (options.length < 3) return options.join(' nor ');
    return `${options.slice(0, -1).join(', ')}, nor ${options[options.length - 1]}`;
  }
  return options.join(', ');
}

function renderDropdownValue(t) {
  const selection = getDropdownSelection(t.id);
  const selected = Array.isArray(selection.values) ? selection.values : [];
  if (selected.length === 0) return '';
  const join = selection.join || t.join || 'lines';
  return `**${t.label || t.name}:**\n${joinTemplateOptions(selected, join)}`;
}

function renderTemplateContent(t, seen = new Set()) {
  if (!t) return '';
  if (isDropdownTemplate(t)) return renderDropdownValue(t);
  if (seen.has(t.id)) return '';
  seen.add(t.id);
  return String(t.content || '').replace(/\{dropdown:([a-zA-Z0-9_-]+)\}/g, (_, id) => {
    const dropdown = getTemplateById(id);
    return isDropdownTemplate(dropdown) ? renderDropdownValue(dropdown) : '';
  });
}

/**
 * renderNote(input, matched, noteTemplate) → Markdown string
 * Replaces {input}, {templates}, dropdown placeholders, and {static:...}.
 * Strips trailing whitespace per line. Returns trimmed Markdown source.
 */
function renderNote(input, matched, noteTemplate, opts = {}) {
  const showLabels = opts.sourceLabels || false;
  const templatesStr = matched.map(t => {
    const content = renderTemplateContent(t);
    if (!content.trim()) return '';
    const label = showLabels ? `**[${t.name}]**\n` : '';
    return label + content;
  }).filter(Boolean).join('\n\n');

  let out = noteTemplate
    .replace(/\{input\}/g, input)
    .replace(/\{templates\}/g, templatesStr)
    .replace(/\{dropdown:([a-zA-Z0-9_-]+)\}/g, (_, id) => renderTemplateContent(getTemplateById(id)));

  out = processStaticPlaceholders(out);

  // Clean up: strip trailing whitespace per line, collapse >2 blank lines
  out = out
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return out;
}


/* ════════════════════════════════════════════════
   PLAIN TEXT STRIP (for EMRs that don't support Markdown)
════════════════════════════════════════════════ */

function stripMarkdown(md) {
  return md
    .replace(/#{1,6}\s+/g, '')          // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')  // bold
    .replace(/\*(.+?)\*/g, '$1')        // italic
    .replace(/~~(.+?)~~/g, '$1')          // strikethrough
    .replace(/`(.+?)`/g, '$1')            // inline code
    .replace(/^\s*[-*+]\s+/gm, '• ')   // unordered lists
    .replace(/^\s*\d+\.\s+/gm, '')    // ordered lists
    .replace(/^>\s+/gm, '')              // blockquotes
    .replace(/!\[.*?\]\(.*?\)/g, '')  // images
    .replace(/\[(.+?)\]\(.*?\)/g, '$1') // links
    .replace(/_{1,2}(.+?)_{1,2}/g, '$1') // underscore bold/italic
    .trim();
}

/* ════════════════════════════════════════════════
   CLIPBOARD
════════════════════════════════════════════════ */

/**
 * copyToClipboard(markdownText) → Promise<boolean>
 *
 * Writes RICH TEXT (HTML) to the clipboard so content pastes with formatting
 * (bold, italics, lists, etc.) into EMR rich-text fields.
 *
 * Tier 1 — ClipboardItem API: writes both text/html and text/plain so the
 *           receiving app can pick the richer format it supports.
 * Tier 2 — clipboard.writeText: plain Markdown if ClipboardItem unavailable.
 * Tier 3 — execCommand('copy'): last resort for very old browsers.
 */
async function copyToClipboard(markdownText, forceText = false) {
  if (!markdownText || !markdownText.trim()) return false;

  // If plain text mode is on (or forced), strip Markdown before writing
  const usePlainText = forceText || (state.behavior && state.behavior.plainTextCopy);
  const textPayload = usePlainText ? stripMarkdown(markdownText) : markdownText;

  // Render Markdown → HTML for the rich-text clipboard payload.
  const renderedHtml = (!usePlainText && typeof marked !== 'undefined')
    ? `<div>${marked.parse(markdownText)}</div>`
    : `<pre>${textPayload}</pre>`;

  // ── Tier 1: ClipboardItem (rich text) ──────────────────────────────────
  if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html':  new Blob([renderedHtml],  { type: 'text/html' }),
          'text/plain': new Blob([textPayload],   { type: 'text/plain' }),
        }),
      ]);
      return true;
    } catch { /* permission denied or unsupported — fall through */ }
  }

  // ── Tier 2: writeText (plain Markdown) ────────────────────────────────
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(textPayload);
      showToast('Copied as plain text (rich text not supported in this browser)', 'warning', 3500);
      return true;
    } catch { /* fall through */ }
  }

  // ── Tier 3: execCommand fallback ──────────────────────────────────────
  try {
    const ta = document.createElement('textarea');
    ta.value = textPayload;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (!ok) throw new Error('execCommand returned false');
    showToast('Copied (legacy fallback)', 'warning');
    return true;
  } catch {
    showToast('Copy failed — please select and copy manually', 'error', 4000);
    return false;
  }
}

/* ════════════════════════════════════════════════
   TOAST NOTIFICATIONS
════════════════════════════════════════════════ */

function showToast(message, type = 'success', duration = 2200) {
  const container = dom.toastContainer;
  if (!container) return;

  const el = document.createElement('div');
  el.className = `sc-toast ${type}`;
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('sc-fade-out');
    setTimeout(() => el.remove(), 280);
  }, duration);
}

function renderDropdownControls(dropdowns) {
  if (!dom.previewRendered || dropdowns.length === 0) return;

  const wrap = document.createElement('div');
  wrap.className = 'sc-dropdown-template-list';

  dropdowns.forEach(t => {
    const selection = getDropdownSelection(t.id);
    const card = document.createElement('div');
    card.className = 'sc-dropdown-template';
    card.dataset.dropdownId = t.id;

    const header = document.createElement('div');
    header.className = 'sc-dropdown-template-header';
    header.textContent = t.label || t.name;

    const controls = document.createElement('div');
    controls.className = 'sc-dropdown-template-controls';

    const select = document.createElement('select');
    select.className = 'sc-dropdown-template-select';
    select.multiple = true;
    select.size = Math.min(Math.max((t.options || []).length, 3), 6);
    (t.options || []).forEach(optionText => {
      const option = document.createElement('option');
      option.value = optionText;
      option.textContent = optionText;
      option.selected = (selection.values || []).includes(optionText);
      select.appendChild(option);
    });

    const join = document.createElement('select');
    join.className = 'sc-dropdown-template-join';
    [
      ['lines', 'Bullets'],
      ['comma', 'Comma list'],
      ['and', 'Comma + and'],
      ['or', 'Comma + or'],
      ['nor', 'Comma + nor'],
      ['sentence', 'Sentence'],
      ['paragraphs', 'Paragraphs'],
    ].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      option.selected = value === (selection.join || t.join || 'lines');
      join.appendChild(option);
    });

    const onChange = () => {
      state.dropdownSelections[t.id] = {
        values: Array.from(select.selectedOptions).map(option => option.value),
        join: join.value,
      };
      updatePreview();
    };
    select.addEventListener('change', onChange);
    join.addEventListener('change', onChange);

    controls.append(select, join);
    card.append(header, controls);
    wrap.appendChild(card);
  });

  dom.previewRendered.appendChild(wrap);
}

/* ════════════════════════════════════════════════
   PREVIEW RENDERING
════════════════════════════════════════════════ */

function updatePreview() {
  const input = state.currentInput;
  const hasInput = input.trim();

  // Validate note template first
  const nt = state.noteTemplate;
  if (!nt.includes('{input}') || !nt.includes('{templates}')) {
    setStatus('Error: Note template missing {input} or {templates}', 'error');
    return;
  }

  if (!hasInput) {
    // Clear state
    state.matchedTemplates = [];
    state.activeDropdowns = [];
    state.currentNote = '';
    dom.matchBadge.classList.add('hidden');
    dom.previewEmpty.classList.remove('hidden');
    dom.previewRendered.classList.add('hidden');
    dom.sourceText.textContent = '';
    setStatus('Ready', 'idle');
    cancelAutoCopy();
    return;
  }

  // Match templates
  const matched = matchTemplates(input);
  state.matchedTemplates = matched;
  state.activeDropdowns = collectActiveDropdowns(matched);

  // Update match badge
  if (matched.length > 0) {
    dom.matchBadge.textContent = matched.length;
    dom.matchBadge.classList.remove('hidden');
  } else {
    dom.matchBadge.classList.add('hidden');
  }

  // Build note Markdown
  const mdSource = renderNote(input, matched, nt, {
    sourceLabels: state.behavior.sourceLabels,
  });
  state.currentNote = mdSource;

  // Update source tab
  dom.sourceText.textContent = mdSource;

  // Update preview tab (render HTML from Markdown)
  const html = marked.parse(mdSource);
  dom.previewRendered.innerHTML = html;
  renderDropdownControls(state.activeDropdowns);
  dom.previewEmpty.classList.add('hidden');
  dom.previewRendered.classList.remove('hidden');

  // Status
  if (matched.length === 0 && input.trim()) {
    setStatus('No templates matched — try "illness", "injury", "otitis", "strep", or "follow up"', 'idle');
    // Show a helpful no-match message in preview
    dom.previewRendered.innerHTML = '<div class="sc-no-match-msg"><span class="sc-no-match-icon">🔍</span><span>No templates matched your input.</span><span class="sc-no-match-hint">Try words like: <em>illness, injury, otitis, strep, dehydration, trouble breathing, follow up…</em></span></div>';
    dom.previewEmpty.classList.add('hidden');
    dom.previewRendered.classList.remove('hidden');
  } else {
    setStatus(
      `${matched.length} template${matched.length !== 1 ? 's' : ''} matched: ${matched.map(t => t.name).join(', ')}`,
      'matched'
    );
  }

  // Schedule auto-copy
  scheduleAutoCopy();
}

const debouncedUpdate = debounce(updatePreview, 300);

function setStatus(text, mode = 'idle') {
  if (!dom.statusText) return;
  dom.statusText.textContent = text;
  dom.statusText.className = 'sc-status-text';
  if (mode === 'matched') dom.statusText.classList.add('sc-matched');
  if (mode === 'error')   dom.statusText.classList.add('sc-error-text');
}

/* ════════════════════════════════════════════════
   AUTO-COPY TIMER
════════════════════════════════════════════════ */

function scheduleAutoCopy() {
  cancelAutoCopy();
  if (!state.behavior.autoCopyEnabled) return;
  if (!state.currentNote.trim()) return;
  if (state.activeDropdowns.some(t => getDropdownSelection(t.id).values.length === 0)) return;

  dom.autoCopyIndicator.classList.remove('hidden');

  state.autoCopyTimer = setTimeout(async () => {
    dom.autoCopyIndicator.classList.add('hidden');
    if (!state.currentNote.trim()) return;
    const ok = await copyToClipboard(state.currentNote);
    if (ok) {
      showToast('✓ Copied to clipboard', 'success');
      setStatus('Copied to clipboard ✓', 'matched');
    }
  }, state.behavior.autoCopyDelay);
}

function cancelAutoCopy() {
  clearTimeout(state.autoCopyTimer);
  if (dom.autoCopyIndicator) dom.autoCopyIndicator.classList.add('hidden');
}

/* ════════════════════════════════════════════════
   AUTO-CLEAR TIMER
════════════════════════════════════════════════ */

function scheduleAutoClear() {
  clearTimeout(state.autoClearTimer);
  if (!dom.input.value.trim()) return;

  state.autoClearTimer = setTimeout(() => {
    clearInput(true);
    showToast('Input cleared (inactivity) — tap Undo to restore', 'warning', 4000);
  }, state.behavior.autoClearDelay);
}

function clearInput(saveForUndo = false) {
  if (saveForUndo && dom.input.value.trim()) {
    state.lastClearedInput = dom.input.value;
    // Show undo button briefly
    if (dom.undoClearBtn) {
      dom.undoClearBtn.classList.remove('hidden');
      clearTimeout(state.undoClearTimer);
      state.undoClearTimer = setTimeout(() => {
        dom.undoClearBtn.classList.add('hidden');
        state.lastClearedInput = '';
      }, 8000);
    }
  }
  dom.input.value = '';
  state.currentInput = '';
  state.activeDropdowns = [];
  state.dropdownSelections = {};
  clearTimeout(state.autoClearTimer);
  cancelAutoCopy();
  dom.input.style.height = 'auto';
  debouncedUpdate();
}

/* ════════════════════════════════════════════════
   PANE PERSISTENCE
════════════════════════════════════════════════ */

function savePaneState() {
  storage.set(STORAGE_KEYS.PANE_STATE, {
    focusMode: dom.pane.classList.contains('sc-focus-mode'),
  });
}

function restorePaneState() {
  const s = storage.get(STORAGE_KEYS.PANE_STATE);
  if (!s) return;
  applyFocusMode(!!(s.focusMode || s.minimized));
}

function clampPaneToViewport() {}

/* ════════════════════════════════════════════════
   DRAG — move pane by header
════════════════════════════════════════════════ */

function initDrag() {
  dom.header.removeAttribute('title');
}

function onDragStart(e) {
  if (e.target.closest('.sc-btn')) return;
  if (e.button !== 0) return;

  state.isDragging = true;
  const rect = dom.pane.getBoundingClientRect();
  state.dragOffsetX = e.clientX - rect.left;
  state.dragOffsetY = e.clientY - rect.top;

  dom.pane.style.transition = 'none';
  document.body.style.userSelect = 'none';
  e.preventDefault();
}

function onDragTouchStart(e) {
  if (e.target.closest('.sc-btn')) return;
  const t = e.touches[0];
  state.isDragging = true;
  const rect = dom.pane.getBoundingClientRect();
  state.dragOffsetX = t.clientX - rect.left;
  state.dragOffsetY = t.clientY - rect.top;
  dom.pane.style.transition = 'none';
  e.preventDefault();
}

document.addEventListener('mousemove', (e) => {
  if (!state.isDragging) return;
  movePaneTo(e.clientX, e.clientY);
});

document.addEventListener('touchmove', (e) => {
  if (!state.isDragging) return;
  const t = e.touches[0];
  movePaneTo(t.clientX, t.clientY);
}, { passive: false });

function movePaneTo(cx, cy) {
  const pane = dom.pane;
  const w = pane.offsetWidth;
  const h = pane.offsetHeight;
  let x = cx - state.dragOffsetX;
  let y = cy - state.dragOffsetY;
  x = Math.max(0, Math.min(x, window.innerWidth  - w));
  y = Math.max(0, Math.min(y, window.innerHeight - h));
  pane.style.left  = x + 'px';
  pane.style.top   = y + 'px';
  pane.style.right = 'auto';
}

document.addEventListener('mouseup', () => {
  if (!state.isDragging) return;
  state.isDragging = false;
  document.body.style.userSelect = '';
  savePaneState();
});

document.addEventListener('touchend', () => {
  if (!state.isDragging) return;
  state.isDragging = false;
  savePaneState();
});

/* ════════════════════════════════════════════════
   RESIZE — custom bottom-right handle
════════════════════════════════════════════════ */

function initResize() {
  const handle = dom.resizeHandle;
  if (!handle) return;
  handle.hidden = true;

  handle.addEventListener('mousedown', (e) => {
    state.isResizing = true;
    state.resizeStartX = e.clientX;
    state.resizeStartY = e.clientY;
    state.resizeStartW = dom.pane.offsetWidth;
    state.resizeStartH = dom.pane.offsetHeight;
    document.body.style.userSelect = 'none';
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousemove', (e) => {
    if (!state.isResizing) return;
    const newW = Math.max(320, state.resizeStartW + (e.clientX - state.resizeStartX));
    const newH = Math.max(220, state.resizeStartH + (e.clientY - state.resizeStartY));
    dom.pane.style.width  = newW + 'px';
    dom.pane.style.height = newH + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!state.isResizing) return;
    state.isResizing = false;
    document.body.style.userSelect = '';
    savePaneState();
  });
}

/* ════════════════════════════════════════════════
   FOCUS MODE
════════════════════════════════════════════════ */

function applyFocusMode(enabled) {
  const pane = dom.pane;
  const btn  = dom.minimizeBtn;
  const icon = dom.minIcon;

  pane.classList.toggle('sc-focus-mode', enabled);

  if (enabled) {
    icon.innerHTML = '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>';
    btn.title = 'Exit focus mode';
    btn.setAttribute('aria-label', 'Exit focus mode');
  } else {
    icon.innerHTML = '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>';
    btn.title = 'Focus mode';
    btn.setAttribute('aria-label', 'Focus mode');
  }
}

function toggleFocusMode() {
  const enabled = !dom.pane.classList.contains('sc-focus-mode');
  applyFocusMode(enabled);
  savePaneState();
}

function applyMinimize(minimized) {
  applyFocusMode(minimized);
}

function toggleMinimize() {
  toggleFocusMode();
}

/* ════════════════════════════════════════════════
   INPUT EXPANSIONS
════════════════════════════════════════════════ */

function formatDateOffset(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function formatTimeNow() {
  return new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function applyDotExpansions(el) {
  const cursor = el.selectionStart ?? el.value.length;
  const before = el.value.slice(0, cursor);
  const after = el.value.slice(cursor);
  const replacements = {
    '.today': formatDateOffset(0),
    '.now': formatTimeNow(),
    '.tomorrow': formatDateOffset(1),
    '.2d': formatDateOffset(2),
    '.1w': formatDateOffset(7),
  };
  const match = before.match(/(^|[\s(])(\.(?:today|now|tomorrow|2d|1w))$/i);
  if (!match) return false;
  const token = match[2].toLowerCase();
  const replacement = replacements[token];
  if (!replacement) return false;
  const start = cursor - match[2].length;
  el.value = el.value.slice(0, start) + replacement + after;
  const nextCursor = start + replacement.length;
  el.setSelectionRange(nextCursor, nextCursor);
  return true;
}

function applyBulletExpansion(el) {
  const cursor = el.selectionStart ?? el.value.length;
  const lineStart = el.value.lastIndexOf('\n', cursor - 1) + 1;
  const lineBeforeCursor = el.value.slice(lineStart, cursor);
  if (lineBeforeCursor !== '-') return false;
  el.value = el.value.slice(0, cursor) + ' ' + el.value.slice(cursor);
  el.setSelectionRange(cursor + 1, cursor + 1);
  return true;
}

function attachSmartTextareaBehavior(el, onChange) {
  el.addEventListener('input', () => {
    applyDotExpansions(el);
    applyBulletExpansion(el);
    onChange();
  });

  el.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const cursor = el.selectionStart ?? el.value.length;
    const lineStart = el.value.lastIndexOf('\n', cursor - 1) + 1;
    const line = el.value.slice(lineStart, cursor);
    const bulletMatch = line.match(/^(\s*[-*]\s+)/);
    if (!bulletMatch) return;
    e.preventDefault();
    const insert = '\n' + bulletMatch[1];
    el.value = el.value.slice(0, cursor) + insert + el.value.slice(el.selectionEnd ?? cursor);
    const nextCursor = cursor + insert.length;
    el.setSelectionRange(nextCursor, nextCursor);
    onChange();
  });
}

/* ════════════════════════════════════════════════
   PREVIEW TABS
════════════════════════════════════════════════ */

function initPreviewTabs() {
  document.querySelectorAll('.sc-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sc-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      const which = tab.dataset.tab;
      if (which === 'preview') {
        dom.previewPanel.classList.remove('hidden');
        dom.sourcePanel.classList.add('hidden');
      } else {
        dom.previewPanel.classList.add('hidden');
        dom.sourcePanel.classList.remove('hidden');
      }
    });
  });
}

/* ════════════════════════════════════════════════
   TEXTAREA AUTO-HEIGHT
════════════════════════════════════════════════ */

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 180) + 'px';
}

/* ════════════════════════════════════════════════
   LOAD SAVED STATE
════════════════════════════════════════════════ */

function loadState() {
  const savedTemplates = storage.get(STORAGE_KEYS.TEMPLATES);
  if (savedTemplates && Array.isArray(savedTemplates) && savedTemplates.length > 0) {
    state.templates = savedTemplates;
  }

  const savedNoteTemplate = storage.get(STORAGE_KEYS.NOTE_TEMPLATE);
  if (typeof savedNoteTemplate === 'string' && savedNoteTemplate.trim()) {
    state.noteTemplate = savedNoteTemplate;
  }

  const savedBehavior = storage.get(STORAGE_KEYS.BEHAVIOR);
  if (savedBehavior && typeof savedBehavior === 'object') {
    state.behavior = Object.assign({}, DEFAULT_BEHAVIOR, savedBehavior);
  }
}

/* ════════════════════════════════════════════════
   INITIALIZATION
════════════════════════════════════════════════ */

function init() {
  // Populate DOM cache
  dom.pane             = $('smartchart-pane');
  dom.header           = $('sc-header');
  dom.input            = $('sc-input');
  dom.body             = $('sc-body');
  dom.previewPanel     = $('sc-preview');
  dom.previewEmpty     = $('sc-preview-empty');
  dom.previewRendered  = $('sc-preview-rendered');
  dom.sourcePanel      = $('sc-source');
  dom.sourceText       = $('sc-source-text');
  dom.statusText       = $('sc-status-text');
  dom.autoCopyIndicator= $('sc-autocopy-indicator');
  dom.matchBadge       = $('sc-match-badge');
  dom.copyBtn          = $('sc-copy-btn');
  dom.settingsBtn      = $('sc-settings-btn');
  dom.minimizeBtn      = $('sc-minimize-btn');
  dom.minIcon          = $('sc-min-icon');
  dom.settingsPanel    = $('sc-settings');
  dom.settingsClose    = $('sc-settings-close');
  dom.resizeHandle     = $('sc-resize-handle');
  dom.toastContainer   = $('sc-toast-container');
  dom.newPatientBtn    = $('sc-new-patient-btn');
  dom.undoClearBtn     = $('sc-undo-clear-btn');
  dom.sourceLabelsBtnEl= $('sc-source-labels-btn');
  dom.plainTextBtn     = $('sc-plaintext-btn');

  // Load persisted data
  loadState();

  // Configure marked.js (basic markdown, no GFM tables)
  if (typeof marked !== 'undefined') {
    marked.use({ gfm: true, breaks: true });
  }

  // Restore pane geometry
  restorePaneState();

  // Initialize interactions
  initDrag();
  initResize();
  initPreviewTabs();

  /* ── Input ── */
  attachSmartTextareaBehavior(dom.input, () => {
    state.currentInput = dom.input.value;
    autoResizeTextarea(dom.input);
    cancelAutoCopy();
    clearTimeout(state.autoClearTimer);
    debouncedUpdate();
    scheduleAutoClear();
  });

  /* ── Manual copy ── */
  dom.copyBtn.addEventListener('click', async () => {
    if (!state.currentNote.trim()) {
      showToast('Nothing to copy yet', 'warning');
      return;
    }
    cancelAutoCopy();
    const ok = await copyToClipboard(state.currentNote);
    if (ok) {
      showToast('✓ Copied to clipboard', 'success');
      setStatus('Copied to clipboard ✓', 'matched');
    }
  });

  /* ── Minimize ── */
  dom.minimizeBtn.addEventListener('click', toggleMinimize);

  /* ── Settings open ── */
  dom.settingsBtn.addEventListener('click', () => {
    if (dom.pane.classList.contains('sc-focus-mode')) {
      applyFocusMode(false);
      savePaneState();
    }
    dom.settingsPanel.classList.remove('hidden');
    if (window.SmartChartSettings) window.SmartChartSettings.open();
  });

  /* ── Settings close ── */
  dom.settingsClose.addEventListener('click', () => {
    dom.settingsPanel.classList.add('hidden');
  });

  /* ── New Patient ── */
  if (dom.newPatientBtn) {
    dom.newPatientBtn.addEventListener('click', () => {
      clearInput(true);
      showToast('New patient — input cleared', 'success', 1800);
      dom.input.focus();
    });
  }

  /* ── Undo Clear ── */
  if (dom.undoClearBtn) {
    dom.undoClearBtn.addEventListener('click', () => {
      if (state.lastClearedInput) {
        dom.input.value = state.lastClearedInput;
        state.currentInput = state.lastClearedInput;
        state.lastClearedInput = '';
        autoResizeTextarea(dom.input);
        debouncedUpdate();
        dom.undoClearBtn.classList.add('hidden');
        clearTimeout(state.undoClearTimer);
        showToast('Input restored', 'success', 1800);
      }
    });
  }

  /* ── Source Labels toggle ── */
  if (dom.sourceLabelsBtnEl) {
    dom.sourceLabelsBtnEl.addEventListener('click', () => {
      state.behavior.sourceLabels = !state.behavior.sourceLabels;
      dom.sourceLabelsBtnEl.classList.toggle('active', state.behavior.sourceLabels);
      dom.sourceLabelsBtnEl.title = state.behavior.sourceLabels
        ? 'Source labels ON — click to hide'
        : 'Source labels OFF — click to show which template each block came from';
      storage.set(STORAGE_KEYS.BEHAVIOR, state.behavior);
      updatePreview();
    });
    // Restore state
    if (state.behavior.sourceLabels) {
      dom.sourceLabelsBtnEl.classList.add('active');
    }
  }

  /* ── Plain Text toggle ── */
  if (dom.plainTextBtn) {
    dom.plainTextBtn.addEventListener('click', async () => {
      if (!state.currentNote.trim()) { showToast('Nothing to copy yet', 'warning'); return; }
      cancelAutoCopy();
      const ok = await copyToClipboard(state.currentNote, true);
      if (ok) {
        showToast('✓ Copied as plain text', 'success');
        setStatus('Copied as plain text ✓', 'matched');
      }
    });
  }

  /* ── Keyboard shortcuts ── */
  document.addEventListener('keydown', (e) => {
    // Escape: close settings
    if (e.key === 'Escape' && !dom.settingsPanel.classList.contains('hidden')) {
      dom.settingsPanel.classList.add('hidden');
      return;
    }
    // Ctrl/Cmd + Shift + C: copy note
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      if (state.currentNote.trim()) {
        cancelAutoCopy();
        copyToClipboard(state.currentNote).then(ok => {
          if (ok) { showToast('✓ Copied to clipboard', 'success'); setStatus('Copied to clipboard ✓', 'matched'); }
        });
      } else { showToast('Nothing to copy yet', 'warning'); }
      return;
    }
    // Ctrl/Cmd + Shift + N: new patient
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      clearInput(true);
      showToast('New patient — input cleared', 'success', 1800);
      dom.input.focus();
      return;
    }
    // Ctrl/Cmd + Shift + S: open settings
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      const isOpen = !dom.settingsPanel.classList.contains('hidden');
      if (!isOpen && dom.pane.classList.contains('sc-focus-mode')) {
        applyFocusMode(false);
        savePaneState();
      }
      dom.settingsPanel.classList.toggle('hidden', isOpen);
      if (!isOpen && window.SmartChartSettings) window.SmartChartSettings.open();
      return;
    }
    // Ctrl/Cmd + Shift + F: focus input
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      dom.input.focus();
      return;
    }
  });

  /* ── Window resize: re-clamp pane ── */
  window.addEventListener('resize', debounce(clampPaneToViewport, 200));

  // Initial render
  updatePreview();
}

document.addEventListener('DOMContentLoaded', init);

/* ════════════════════════════════════════════════
   PUBLIC API (for settings.js module)
════════════════════════════════════════════════ */

window.SmartChart = {
  state,
  dom,
  storage,
  STORAGE_KEYS,
  DEFAULT_NOTE_TEMPLATE,
  DEFAULT_TEMPLATES,
  DEFAULT_BEHAVIOR,
  updatePreview,
  showToast,
  renderNote,
  matchTemplates,
  stripMarkdown,
  clearInput,
  attachSmartTextareaBehavior,
};
