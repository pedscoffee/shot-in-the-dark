/**
 * SmartChart — app.js
 * Core logic: template matching, note rendering, clipboard,
 * focus mode, auto-copy, auto-clear, state persistence.
 *
 * Design decisions:
 *  - Stores & renders templates as HTML (no Markdown)
 *  - Copies rich HTML + plain-text fallback to clipboard
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

// Stored as HTML from here on
const DEFAULT_NOTE_TEMPLATE = `{input}<br><br>{templates}`;

/** Default templates — content stored as HTML strings. */
const DEFAULT_TEMPLATES = [
  {
    id: 'well-child-health-maintenance',
    name: 'Well Child / Health Maintenance',
    triggers: ['well child', 'well-child', 'well visit', 'health maintenance', 'checkup', 'check-up', 'annual exam', 'physical', 'preventive', 'WCC'],
    content: '<em>All forms, labs, immunizations, and patient concerns reviewed and addressed appropriately. Screening questions, past medical history, past social history, medications, and growth chart reviewed. Age-appropriate anticipatory guidance reviewed and printed in AVS. Parent questions addressed.</em>',
    priority: 1,
  },
  {
    id: 'illness-supportive-care',
    name: 'Illness Supportive Care',
    triggers: ['illness', 'sick', 'fever', 'cough', 'congestion', 'runny nose', 'uri', 'cold', 'rash', 'sore throat', 'strep', 'ear pain', 'earache', 'otitis', 'vomiting', 'diarrhea', 'dehydration', 'trouble breathing', 'shortness of breath', 'wheezing'],
    content: '<em>Recommended supportive care with OTC medications as needed. Return precautions given including increasing pain, worsening fever, dehydration, new symptoms, prolonged symptoms, worsening symptoms, and other concerns. Caregiver expressed understanding and agreement with treatment plan.</em>',
    priority: 2,
  },
  {
    id: 'injury-supportive-care',
    name: 'Injury Supportive Care',
    triggers: ['injury', 'laceration', 'cut', 'wound', 'trauma', 'bruise', 'contusion', 'sprain', 'strain', 'abrasion', 'scrape', 'fracture'],
    content: '<em>Recommended supportive care with Tylenol, Motrin, rest, ice, compression, elevation, and gradual return to activity as appropriate. Return precautions given including increasing pain, swelling, or failure to improve.</em>',
    priority: 3,
  },
  {
    id: 'ear-infection-risk',
    name: 'Ear Infection Risk',
    triggers: ['ear infection', 'otitis', 'otitis media', 'ear pain', 'earache', 'ear ache'],
    content: '<em>Risk of untreated otitis media includes persistent pain and fever, hearing loss, and mastoiditis.</em>',
    priority: 4,
  },
  {
    id: 'strep-test-risk',
    name: 'Strep Test Risk',
    triggers: ['strep test', 'rapid strep', 'throat culture', 'strep throat', 'strep'],
    content: '<em>Risk of untreated strep throat includes rheumatic fever and peritonsillar abscess. This problem is moderate risk due to pending lab results which may necessitate further pharmacologic management.</em>',
    priority: 5,
  },
  {
    id: 'dehydration-risk',
    name: 'Dehydration Risk',
    triggers: ['dehydration', 'vomiting', 'diarrhea', 'decreased urination', 'not drinking', 'poor intake', 'poor po'],
    content: '<em>Patient is at risk for dehydration, which would warrant emergency room care or admission for IV fluids.</em>',
    priority: 6,
  },
  {
    id: 'respiratory-distress-risk',
    name: 'Respiratory Distress Risk',
    triggers: ['trouble breathing', 'difficulty breathing', 'shortness of breath', 'respiratory distress', 'wheezing', 'labored breathing'],
    content: '<em>Patient is at risk for worsening respiratory distress and clinical deterioration, which would need emergency room care or hospital admission.</em>',
    priority: 7,
  },
  {
    id: 'eczema',
    name: 'Eczema',
    triggers: ['eczema', 'atopic dermatitis'],
    content: '<em>Discussed supportive care with emphasis on frequent moisturization, appropriate use of topical steroids, and return precautions.</em>',
    priority: 8,
  },
  {
    id: 'pcmh-reminder',
    name: 'PCMH Reminder',
    triggers: ['adhd', 'weight', 'obesity', 'strep throat'],
    content: '<em>PCMH Reminder</em>',
    priority: 9,
  },
  {
    id: 'follow-up',
    name: 'Follow-Up Dropdown',
    type: 'dropdown',
    triggers: ['follow up', 'follow-up', 'followup'],
    label: 'Follow-Up',
    join: 'lines',
    singleSelect: true,
    showLabel: true,
    options: [
      'Follow up as needed.',
      'Follow up in 2-3 days.',
      'Follow up in 2-4 weeks.',
      'Follow up in a month.',
      'Follow up in 3 months.',
      'Follow up in 3-6 months.',
      'Follow up in 1 year.',
      'Follow up at next regularly scheduled check up or as needed.',
      '',
    ],
    priority: 20,
    category: 'Dropdown',
  },
];

const DEFAULT_BEHAVIOR = {
  autoCopyDelay:   1500,
  autoClearDelay:  30000,
  autoCopyEnabled: true,
  plainTextCopy:   false,
  sourceLabels:    false,
};

const state = {
  noteTemplate:       DEFAULT_NOTE_TEMPLATE,
  templates:          typeof structuredClone === 'function' ? structuredClone(DEFAULT_TEMPLATES) : JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
  behavior:           Object.assign({}, DEFAULT_BEHAVIOR),
  currentInput:       '',
  currentNoteHtml:    '',
  matchedTemplates:   [],
  activeDropdowns:    [],
  dropdownSelections: {},
  autoCopyTimer:      null,
  autoClearTimer:     null,
  previewDebounce:    null,
  lastClearedInput:   '',
  isDragging:         false,
  isResizing:         false,
};

const $ = id => document.getElementById(id);
const dom = {};

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

function debounce(fn, ms) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/**
 * sanitizeHtml(html) → string
 * Runs HTML through DOMPurify before any innerHTML assignment.
 * Strips scripts, event handlers, and dangerous attributes.
 * Falls back to plain-text escaping if DOMPurify is not loaded (should not happen).
 */
function sanitizeHtml(html) {
  if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
    return DOMPurify.sanitize(String(html || ''), {
      ALLOWED_TAGS: ['b','i','em','strong','u','s','p','br','hr','ul','ol','li',
                     'h1','h2','h3','span','div','table','thead','tbody','tr','td','th'],
      ALLOWED_ATTR: ['class','style'],
    });
  }
  // Fallback: strip all tags if DOMPurify somehow unavailable
  console.warn('[SmartChart] DOMPurify not loaded — stripping all HTML as safety fallback.');
  return String(html || '').replace(/<[^>]*>/g, '');
}

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

function collectDropdownIdsFromHtml(html, ids = new Set(), seen = new Set()) {
  String(html || '').replace(/\{dropdown:([a-zA-Z0-9_-]+)\}/g, (_, id) => {
    if (seen.has(id)) return '';
    seen.add(id);
    const tpl = getTemplateById(id);
    if (isDropdownTemplate(tpl)) ids.add(id);
    if (tpl && tpl.content) collectDropdownIdsFromHtml(tpl.content, ids, seen);
    return '';
  });
  return ids;
}

function joinTemplateOptions(options, mode) {
  if (mode === 'lines')      return '<ul>' + options.map(o => `<li>${o}</li>`).join('') + '</ul>';
  if (mode === 'paragraphs') return options.map(o => `<p>${o}</p>`).join('');
  if (mode === 'sentence')   return options.join(' ');
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

function renderDropdownValueHtml(t) {
  const selection = getDropdownSelection(t.id);
  const selected = Array.isArray(selection.values) ? selection.values : [];
  if (selected.length === 0) return '';
  const join = selection.join || t.join || 'lines';
  // showLabel defaults to false — only show if explicitly set to true.
  // This avoids redundant headers from wizard-generated nested dropdowns.
  if (t.showLabel === true) {
    return `<p><strong>${t.label || t.name}:</strong></p>${joinTemplateOptions(selected, join)}`;
  }
  return joinTemplateOptions(selected, join);
}

function renderTemplateContentHtml(t, seen = new Set()) {
  if (!t) return '';
  if (isDropdownTemplate(t)) return renderDropdownValueHtml(t);
  if (seen.has(t.id)) return '';
  seen.add(t.id);
  return String(t.content || '').replace(/\{dropdown:([a-zA-Z0-9_-]+)\}/g, (_, id) => {
    const dropdown = getTemplateById(id);
    return isDropdownTemplate(dropdown) ? renderDropdownValueHtml(dropdown) : '';
  });
}

/**
 * renderNote(input, matched, noteTemplate) → HTML string
 * Replaces {input}, {templates}, dropdown placeholders, and {static:...}.
 */
function renderNote(input, matched, noteTemplate, opts = {}) {
  const showLabels = opts.sourceLabels || false;

  const templatesHtml = matched.map(t => {
    const content = renderTemplateContentHtml(t);
    if (!content.trim()) return '';
    const label = showLabels ? `<p><strong>[${t.name}]</strong></p>` : '';
    return label + content;
  }).filter(Boolean).join('<hr class="sc-template-sep">');

  // Escape the input text for safe HTML insertion
  const escapedInput = input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  let out = noteTemplate
    .replace(/\{input\}/g, escapedInput)
    .replace(/\{templates\}/g, templatesHtml)
    .replace(/\{dropdown:([a-zA-Z0-9_-]+)\}/g, (_, id) => renderTemplateContentHtml(getTemplateById(id)));

  // {static:TEXT} → plain span
  out = out.replace(/\{static:([^}]*)\}/g, (_, content) => `<span>${content}</span>`);

  return out;
}

/** Extract plain text from an HTML string for plain-text clipboard copy. */
function htmlToPlainText(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  // Replace <br>, <p>, <li>, <hr> with newlines before innerText extraction
  div.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
  div.querySelectorAll('p, div, li, hr').forEach(el => {
    el.insertAdjacentText('afterend', '\n');
  });
  return (div.innerText || div.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

async function copyToClipboard(html, forcePlain = false) {
  if (!html || !html.trim()) return false;

  const plainText = htmlToPlainText(html);
  const usePlain  = forcePlain || (state.behavior && state.behavior.plainTextCopy);

  if (!usePlain && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html':  new Blob([`<div>${html}</div>`], { type: 'text/html' }),
          'text/plain': new Blob([plainText],            { type: 'text/plain' }),
        }),
      ]);
      return true;
    } catch {}
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(plainText);
      if (!usePlain) showToast('Copied as plain text (rich text not supported in this browser)', 'warning', 3500);
      return true;
    } catch {}
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = plainText;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
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
    const isSingleSelect = !!(t.singleSelect);
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
    // Single-select mode: use a <select> without multiple; add a blank "(none)" option
    if (isSingleSelect) {
      select.multiple = false;
      select.size = 1;
      const blankOpt = document.createElement('option');
      blankOpt.value = '';
      blankOpt.textContent = '— select one —';
      blankOpt.selected = (selection.values || []).length === 0;
      select.appendChild(blankOpt);
    } else {
      select.multiple = true;
      select.size = Math.min(Math.max((t.options || []).length, 3), 6);
    }
    (t.options || []).forEach(optionText => {
      const option = document.createElement('option');
      option.value = optionText;
      option.textContent = optionText;
      option.selected = (selection.values || []).includes(optionText);
      select.appendChild(option);
    });

    const join = document.createElement('select');
    join.className = 'sc-dropdown-template-join';
    // Hide join selector for single-select dropdowns (only one value, no joining needed)
    if (isSingleSelect) join.style.display = 'none';
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
      const selectedValues = isSingleSelect
        ? (select.value ? [select.value] : [])
        : Array.from(select.selectedOptions).map(o => o.value);
      state.dropdownSelections[t.id] = {
        values: selectedValues,
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

function updatePreview() {
  const input    = state.currentInput;
  const hasInput = input.trim();
  const nt       = state.noteTemplate;

  if (!nt.includes('{input}') || !nt.includes('{templates}')) {
    setStatus('Error: Note template missing {input} or {templates}', 'error');
    return;
  }

  if (!hasInput) {
    state.matchedTemplates = [];
    state.activeDropdowns  = [];
    state.currentNoteHtml  = '';
    dom.matchBadge.classList.add('hidden');
    dom.previewEmpty.classList.remove('hidden');
    dom.previewRendered.classList.add('hidden');
    dom.sourceText.textContent = '';
    setStatus('Ready', 'idle');
    cancelAutoCopy();
    return;
  }

  const matched = matchTemplates(input);
  state.matchedTemplates = matched;

  let modifiedInput = input;
  const bottomTemplates = [];

  matched.forEach(t => {
    let replaced = false;
    if (t.type === 'dropdown') {
      for (const trigger of t.triggers) {
        if (!trigger) continue;
        const normalized = String(trigger).trim();
        if (!normalized) continue;
        const escaped = escapeRegExp(normalized).replace(/\s+/g, '\\s+');
        const regex = new RegExp(`(^|[^a-z0-9])(${escaped})($|[^a-z0-9])`, 'gi');
        if (regex.test(modifiedInput)) {
          modifiedInput = modifiedInput.replace(regex, `$1{dropdown:${t.id}}$3`);
          replaced = true;
        }
      }
    }
    if (!replaced) bottomTemplates.push(t);
  });

  const idsToSearch = new Set();
  collectDropdownIdsFromHtml(nt, idsToSearch, new Set());
  collectDropdownIdsFromHtml(modifiedInput, idsToSearch, new Set());
  bottomTemplates.forEach(t => collectDropdownIdsFromHtml(t.content, idsToSearch, new Set()));

  state.activeDropdowns = [...idsToSearch]
    .map(id => getTemplateById(id))
    .filter(Boolean)
    .filter(isDropdownTemplate)
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

  const htmlSource = renderNote(modifiedInput, bottomTemplates, nt, {
    sourceLabels: state.behavior.sourceLabels,
  });

  if (matched.length > 0) {
    dom.matchBadge.textContent = matched.length;
    dom.matchBadge.classList.remove('hidden');
  } else {
    dom.matchBadge.classList.add('hidden');
  }

  state.currentNoteHtml = htmlSource;
  // Source tab shows cleaned HTML for transparency
  dom.sourceText.textContent = htmlSource;

  dom.previewRendered.innerHTML = sanitizeHtml(htmlSource);
  renderDropdownControls(state.activeDropdowns);
  dom.previewEmpty.classList.add('hidden');
  dom.previewRendered.classList.remove('hidden');

  if (matched.length === 0 && input.trim()) {
    setStatus('No templates matched — try "illness", "injury", "otitis", "strep", or "follow up"', 'idle');
    dom.previewRendered.innerHTML = sanitizeHtml('<div class="sc-no-match-msg"><span class="sc-no-match-icon">🔍</span><span>No templates matched your input.</span><span class="sc-no-match-hint">Try words like: <em>illness, injury, otitis, strep, dehydration, trouble breathing, follow up…</em></span></div>');
    dom.previewEmpty.classList.add('hidden');
    dom.previewRendered.classList.remove('hidden');
  } else {
    setStatus(
      `${matched.length} template${matched.length !== 1 ? 's' : ''} matched: ${matched.map(t => t.name).join(', ')}`,
      'matched'
    );
  }

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

function scheduleAutoCopy() {
  cancelAutoCopy();
  if (!state.behavior.autoCopyEnabled) return;
  if (!state.currentNoteHtml.trim()) return;
  // Auto-copy proceeds even if dropdowns are unselected — unselected dropdowns
  // simply render as empty and are excluded from the copied output.

  dom.autoCopyIndicator.classList.remove('hidden');
  state.autoCopyTimer = setTimeout(async () => {
    dom.autoCopyIndicator.classList.add('hidden');
    if (!state.currentNoteHtml.trim()) return;
    const ok = await copyToClipboard(state.currentNoteHtml);
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
    if (dom.undoClearBtn) {
      dom.undoClearBtn.classList.remove('hidden');
      clearTimeout(state.undoClearTimer);
      state.undoClearTimer = setTimeout(() => {
        dom.undoClearBtn.classList.add('hidden');
        state.lastClearedInput = '';
      }, 8000);
    }
  }
  dom.input.value      = '';
  state.currentInput   = '';
  state.activeDropdowns   = [];
  state.dropdownSelections = {};
  clearTimeout(state.autoClearTimer);
  cancelAutoCopy();
  dom.input.style.height = 'auto';
  debouncedUpdate();
}

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
function initDrag() { dom.header.removeAttribute('title'); }
function initResize() {
  const handle = dom.resizeHandle;
  if (!handle) return;
  handle.hidden = true;
}

function applyFocusMode(enabled) {
  dom.pane.classList.toggle('sc-focus-mode', enabled);
  const btn  = dom.minimizeBtn;
  const icon = dom.minIcon;
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
  applyFocusMode(!dom.pane.classList.contains('sc-focus-mode'));
  savePaneState();
}
function applyMinimize(minimized) { applyFocusMode(minimized); }
function toggleMinimize() { toggleFocusMode(); }

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
  const after  = el.value.slice(cursor);
  const replacements = {
    '.today':    formatDateOffset(0),
    '.now':      formatTimeNow(),
    '.tomorrow': formatDateOffset(1),
    '.2d':       formatDateOffset(2),
    '.1w':       formatDateOffset(7),
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
  const cursor    = el.selectionStart ?? el.value.length;
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
    // Backspace on an otherwise-empty bullet line removes the bullet prefix
    if (e.key === 'Backspace' && !e.metaKey && !e.ctrlKey) {
      const cursor    = el.selectionStart ?? el.value.length;
      const selEnd    = el.selectionEnd ?? cursor;
      if (cursor === selEnd) { // no selection
        const lineStart = el.value.lastIndexOf('\n', cursor - 1) + 1;
        const lineBeforeCursor = el.value.slice(lineStart, cursor);
        // If the line is exactly a bullet prefix ("- " or "* ") with nothing after,
        // remove the entire prefix rather than deleting character-by-character
        const bulletOnly = lineBeforeCursor.match(/^(\s*[-*] )$/);
        if (bulletOnly) {
          e.preventDefault();
          // Remove the prefix (and the preceding newline if not at start)
          const removeFrom = lineStart > 0 ? lineStart - 1 : lineStart; // remove the \n before this line too
          const removeLength = lineStart > 0
            ? 1 + bulletOnly[1].length  // \n + prefix chars
            : bulletOnly[1].length;
          el.value = el.value.slice(0, removeFrom) + el.value.slice(removeFrom + removeLength);
          const newCursor = removeFrom;
          el.setSelectionRange(newCursor, newCursor);
          onChange();
          return;
        }
      }
    }

    if (e.key !== 'Enter') return;
    const cursor    = el.selectionStart ?? el.value.length;
    const lineStart = el.value.lastIndexOf('\n', cursor - 1) + 1;
    const line      = el.value.slice(lineStart, cursor);
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

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 180) + 'px';
}

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

function init() {
  dom.pane              = $('smartchart-pane');
  dom.header            = $('sc-header');
  dom.input             = $('sc-input');
  dom.body              = $('sc-body');
  dom.previewPanel      = $('sc-preview');
  dom.previewEmpty      = $('sc-preview-empty');
  dom.previewRendered   = $('sc-preview-rendered');
  dom.sourcePanel       = $('sc-source');
  dom.sourceText        = $('sc-source-text');
  dom.statusText        = $('sc-status-text');
  dom.autoCopyIndicator = $('sc-autocopy-indicator');
  dom.matchBadge        = $('sc-match-badge');
  dom.copyBtn           = $('sc-copy-btn');
  dom.settingsBtn       = $('sc-settings-btn');
  dom.minimizeBtn       = $('sc-minimize-btn');
  dom.minIcon           = $('sc-min-icon');
  dom.settingsPanel     = $('sc-settings');
  dom.settingsClose     = $('sc-settings-close');
  dom.wizardBtn         = $('sc-wizard-btn');
  dom.wizardPanel       = $('sc-wizard');
  dom.wizardClose       = $('sc-wizard-close');
  dom.wizardCancel      = $('sc-wiz-cancel-btn');
  dom.resizeHandle      = $('sc-resize-handle');
  dom.toastContainer    = $('sc-toast-container');
  dom.newPatientBtn     = $('sc-new-patient-btn');
  dom.undoClearBtn      = $('sc-undo-clear-btn');
  dom.sourceLabelsBtnEl = $('sc-source-labels-btn');
  dom.plainTextBtn      = $('sc-plaintext-btn');

  loadState();
  restorePaneState();
  initDrag();
  initResize();
  initPreviewTabs();

  attachSmartTextareaBehavior(dom.input, () => {
    state.currentInput = dom.input.value;
    autoResizeTextarea(dom.input);
    cancelAutoCopy();
    clearTimeout(state.autoClearTimer);
    debouncedUpdate();
    scheduleAutoClear();
  });

  dom.copyBtn.addEventListener('click', async () => {
    if (!state.currentNoteHtml.trim()) { showToast('Nothing to copy yet', 'warning'); return; }
    cancelAutoCopy();
    const ok = await copyToClipboard(state.currentNoteHtml);
    if (ok) { showToast('✓ Copied to clipboard', 'success'); setStatus('Copied to clipboard ✓', 'matched'); }
  });

  dom.minimizeBtn.addEventListener('click', toggleMinimize);

  dom.settingsBtn.addEventListener('click', () => {
    if (dom.pane.classList.contains('sc-focus-mode')) {
      applyFocusMode(false);
      savePaneState();
    }
    dom.settingsPanel.classList.remove('hidden');
    if (window.SmartChartSettings) window.SmartChartSettings.open();
  });

  dom.settingsClose.addEventListener('click', () => {
    dom.settingsPanel.classList.add('hidden');
  });

  if (dom.wizardBtn) {
    dom.wizardBtn.addEventListener('click', () => {
      if (dom.pane.classList.contains('sc-focus-mode')) {
        applyFocusMode(false);
        savePaneState();
      }
      dom.wizardPanel.classList.remove('hidden');
      if (window.SmartChartWizard) window.SmartChartWizard.open();
    });
  }

  const closeWizard = () => {
    dom.wizardPanel.classList.add('hidden');
  };

  if (dom.wizardClose) dom.wizardClose.addEventListener('click', closeWizard);
  if (dom.wizardCancel) dom.wizardCancel.addEventListener('click', closeWizard);

  if (dom.newPatientBtn) {
    dom.newPatientBtn.addEventListener('click', () => {
      clearInput(true);
      showToast('New patient — input cleared', 'success', 1800);
      dom.input.focus();
    });
  }

  if (dom.undoClearBtn) {
    dom.undoClearBtn.addEventListener('click', () => {
      if (state.lastClearedInput) {
        dom.input.value    = state.lastClearedInput;
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
    if (state.behavior.sourceLabels) dom.sourceLabelsBtnEl.classList.add('active');
  }

  if (dom.plainTextBtn) {
    dom.plainTextBtn.addEventListener('click', async () => {
      if (!state.currentNoteHtml.trim()) { showToast('Nothing to copy yet', 'warning'); return; }
      cancelAutoCopy();
      const ok = await copyToClipboard(state.currentNoteHtml, true);
      if (ok) { showToast('✓ Copied as plain text', 'success'); setStatus('Copied as plain text ✓', 'matched'); }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      let handled = false;
      if (!dom.settingsPanel.classList.contains('hidden')) {
        dom.settingsPanel.classList.add('hidden');
        handled = true;
      }
      if (dom.wizardPanel && !dom.wizardPanel.classList.contains('hidden')) {
        dom.wizardPanel.classList.add('hidden');
        handled = true;
      }
      if (handled) return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'W') {
      e.preventDefault();
      const isOpen = !dom.wizardPanel.classList.contains('hidden');
      if (!isOpen && dom.pane.classList.contains('sc-focus-mode')) {
        applyFocusMode(false);
        savePaneState();
      }
      dom.wizardPanel.classList.toggle('hidden', isOpen);
      if (!isOpen && window.SmartChartWizard) window.SmartChartWizard.open();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      if (state.currentNoteHtml.trim()) {
        cancelAutoCopy();
        copyToClipboard(state.currentNoteHtml).then(ok => {
          if (ok) { showToast('✓ Copied to clipboard', 'success'); setStatus('Copied to clipboard ✓', 'matched'); }
        });
      } else { showToast('Nothing to copy yet', 'warning'); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      clearInput(true);
      showToast('New patient — input cleared', 'success', 1800);
      dom.input.focus();
      return;
    }
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
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      dom.input.focus();
      return;
    }
  });

  window.addEventListener('resize', debounce(clampPaneToViewport, 200));
  updatePreview();
}

document.addEventListener('DOMContentLoaded', init);

// Expose only the minimal API that settings.js requires.
// Raw state, storage internals, and DOM references are NOT exported.
window.SmartChart = {
  // Read-only snapshots (settings.js reads these once on open)
  getState()           { return { ...state, autoCopyTimer: undefined, autoClearTimer: undefined, previewDebounce: undefined }; },
  getTemplates()       { return state.templates; },
  getNoteTemplate()    { return state.noteTemplate; },
  getBehavior()        { return { ...state.behavior }; },
  STORAGE_KEYS,
  DEFAULT_NOTE_TEMPLATE,
  DEFAULT_TEMPLATES,
  DEFAULT_BEHAVIOR,
  // Mutators (settings.js uses these to save changes)
  setTemplates(tpls)   { state.templates    = tpls; },
  setNoteTemplate(nt)  { state.noteTemplate = nt;   },
  setBehavior(b)       { state.behavior     = b;    },
  // Shared utilities
  storage,
  updatePreview,
  showToast,
  renderNote,
  matchTemplates,
  htmlToPlainText,
  clearInput,
  sanitizeHtml,
  attachSmartTextareaBehavior,
};
