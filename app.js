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

const DEFAULT_FOLLOW_UP_OPTIONS = [
  'Follow up as needed for new or worsening symptoms.',
  'Follow up in 2-3 days if symptoms are not improving.',
  'Follow up in 1 week if symptoms persist.',
  'Return sooner for worsening pain, fever, breathing trouble, dehydration, or other concerns.',
  'Go to the emergency room for severe symptoms or any life-threatening concern.',
];

/** Default clinical templates for pediatric/family medicine. */
const DEFAULT_TEMPLATES = [
  {
    id: 'dehydration',
    name: 'Dehydration Precautions',
    triggers: ['dehydration', 'vomiting', 'diarrhea', 'decreased urination', 'not drinking', 'poor intake', 'poor po'],
    content: 'Patient is at risk for **dehydration**, which may warrant emergency room evaluation or hospital admission for IV fluid resuscitation. Signs of serious dehydration to watch for: no tears when crying, no wet diapers or urination for >8 hours, sunken eyes or fontanelle, extreme lethargy or irritability, or dry/tacky mucous membranes. Encourage small, frequent sips of Pedialyte or clear fluids.',
    priority: 1,
  },
  {
    id: 'fever',
    name: 'Fever Management',
    triggers: ['fever', 'febrile', 'temperature', 'febrile', 'hot', 'temp'],
    content: 'Fever is the body\'s natural response to infection. Treat discomfort with **acetaminophen** (Tylenol) or **ibuprofen** (Motrin/Advil — if age ≥6 months) per weight-based dosing. Do not alternate unless directed. Return to the ER or call our office if: fever exceeds 104°F (40°C), persists beyond 5 days, or the patient appears very ill, inconsolable, or has difficulty breathing.',
    priority: 2,
  },
  {
    id: 'upper-respiratory',
    name: 'Upper Respiratory Illness',
    triggers: ['cough', 'congestion', 'runny nose', 'uri', 'cold', 'upper respiratory', 'snot', 'mucus', 'nasal drainage'],
    content: 'Upper respiratory infections are most commonly **viral** and do not respond to antibiotics. Recommended supportive care: saline nasal rinses or drops, honey for cough in children >1 year (1 tsp as needed), cool-mist humidifier, and rest. Symptoms may last **7–14 days**. Return if breathing becomes labored or fast, symptoms worsen significantly after day 5, high fever develops, or ear pain begins.',
    priority: 3,
  },
  {
    id: 'sore-throat',
    name: 'Sore Throat / Pharyngitis',
    triggers: ['sore throat', 'pharyngitis', 'strep', 'throat pain', 'throat'],
    content: 'Sore throats are most often **viral** and self-limited. If strep throat is confirmed by rapid antigen test or throat culture, a full course of prescribed antibiotics is necessary—do not stop early even if symptoms improve. Supportive care: warm salt water gargles, throat lozenges, and appropriate analgesics. Return immediately if unable to swallow, drooling, muffled "hot potato" voice, or difficulty breathing develops.',
    priority: 4,
  },
  {
    id: 'ear-infection',
    name: 'Ear Infection (Otitis Media)',
    triggers: ['ear pain', 'earache', 'ear ache', 'otitis', 'ear infection', 'ear pulling', 'otalgia'],
    content: 'Ear infections may be viral or bacterial. If antibiotics are prescribed, complete the **full course** as directed. Pain management: acetaminophen or ibuprofen per weight-based dosing; a warm compress over the ear may improve comfort. Return if: fever persists more than 48 hours after starting antibiotics, pain worsens rather than improves, or drainage develops from the ear canal.',
    priority: 5,
  },
  {
    id: 'gi-illness',
    name: 'Gastrointestinal Illness',
    triggers: ['gastroenteritis', 'stomach bug', 'stomach flu', 'nausea', 'vomiting', 'diarrhea', 'gi illness', 'stomach virus', 'zofran', 'ondansetron'],
    content: 'Most gastrointestinal illnesses are **viral** and self-limited, typically resolving in 3–7 days. Prioritize hydration with small, frequent sips of Pedialyte or clear fluids—avoid juice and sports drinks. Once vomiting subsides, advance diet gradually; the BRAT diet (bananas, rice, applesauce, toast) may ease diarrhea. Return if unable to keep any fluids down for >8 hours, signs of dehydration develop, blood appears in stool, or symptoms persist beyond 7 days.',
    priority: 6,
  },
  {
    id: 'rash',
    name: 'Rash / Skin Irritation',
    triggers: ['rash', 'hives', 'urticaria', 'eczema', 'dermatitis', 'itching', 'itchy', 'pruritus'],
    content: 'Avoid scratching to prevent secondary bacterial skin infection; trim nails short. Hydrocortisone 1% cream may be applied to itchy areas up to twice daily (avoid face and groin unless directed). Keep skin moisturized with a fragrance-free emollient after bathing. For hives or allergic reactions, an oral antihistamine — cetirizine (Zyrtec) or diphenhydramine (Benadryl) — may provide relief. Return **immediately** if: rash spreads rapidly, involves the lips, eyes, or mouth, causes significant facial swelling, or is accompanied by difficulty breathing or throat tightness.',
    priority: 7,
  },
  {
    id: 'well-child',
    name: 'Well Child Visit',
    triggers: ['well child', 'well-child', 'well visit', 'checkup', 'check-up', 'annual exam', 'physical exam', 'routine visit', 'preventive'],
    content: 'Routine well-child visit completed today. Growth parameters, developmental milestones, and nutritional status reviewed and appropriate for age. Immunizations updated per the current CDC/ACIP schedule. Anticipatory guidance provided regarding age-appropriate nutrition, sleep hygiene, screen time limits, car seat and home safety, and developmental expectations. Next well-child visit scheduled per AAP Bright Futures guidelines.',
    priority: 8,
  },
  {
    id: 'injury',
    name: 'Minor Injury / Wound Care',
    triggers: ['laceration', 'cut', 'wound', 'injury', 'trauma', 'bruise', 'contusion', 'sprain', 'strain', 'abrasion', 'scrape'],
    content: 'Wound care instructions: keep the area **clean and dry**. Change dressings once daily or whenever soiled. Monitor closely for signs of infection: increasing redness, warmth, swelling, purulent (cloudy/yellow-green) discharge, or red streaks extending from the wound edge. If sutures or steri-strips were placed, keep dry for the first 24–48 hours. Return for suture removal as directed, or sooner if signs of infection or wound dehiscence develop.',
    priority: 9,
  },
  {
    id: 'antibiotic',
    name: 'Antibiotic Instructions',
    triggers: ['antibiotic', 'amoxicillin', 'augmentin', 'azithromycin', 'zpack', 'z-pack', 'penicillin', 'cephalexin', 'keflex', 'trimethoprim', 'bactrim'],
    content: 'Complete the **full course** of antibiotics exactly as prescribed, even if symptoms improve before the course is finished. Do not share, skip doses, or save leftover medication. GI upset (nausea, loose stools) is common — take with food to reduce stomach irritation. If a rash, hives, facial or tongue swelling, or difficulty breathing develops at any point, **stop the medication immediately** and call our office or go to the nearest emergency room.',
    priority: 10,
  },
  {
    id: 'return-precautions',
    name: 'General Return Precautions',
    triggers: ['return precautions', 'return to er', 'emergency precautions'],
    content: '**Return to the emergency room or call 911** for any of the following: difficulty breathing or rapid breathing, significant change in mental status or responsiveness, persistent high fever >104°F unresponsive to medication, uncontrolled bleeding, severe or rapidly worsening pain, or any symptom that seems life-threatening. **Call our office** for questions, symptoms not improving as expected, or any new concerns.',
    priority: 11,
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
  quickText:       '',
  currentNote:     '',        // Final Markdown string ready for clipboard
  matchedTemplates:[],
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

/**
 * renderNote(input, matched, noteTemplate) → Markdown string
 * Replaces {input}, {templates}, {quick}, and {static:...} placeholders.
 * Strips trailing whitespace per line. Returns trimmed Markdown source.
 */
function renderNote(input, matched, noteTemplate, opts = {}) {
  const showLabels = opts.sourceLabels || false;
  const quickText = opts.quickText || '';
  const templatesStr = matched.map(t => {
    const label = showLabels ? `**[${t.name}]**\n` : '';
    return label + t.content;
  }).join('\n\n');
  const hasQuickPlaceholder = noteTemplate.includes('{quick}');

  let out = noteTemplate
    .replace(/\{input\}/g, input)
    .replace(/\{templates\}/g, templatesStr)
    .replace(/\{quick\}/g, quickText);

  if (quickText && !hasQuickPlaceholder) {
    out = [out, quickText].filter(Boolean).join('\n\n');
  }

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

/* ════════════════════════════════════════════════
   PREVIEW RENDERING
════════════════════════════════════════════════ */

function updatePreview() {
  const input = state.currentInput;
  const hasInput = input.trim() || state.quickText.trim();

  // Validate note template first
  const nt = state.noteTemplate;
  if (!nt.includes('{input}') || !nt.includes('{templates}')) {
    setStatus('Error: Note template missing {input} or {templates}', 'error');
    return;
  }

  if (!hasInput) {
    // Clear state
    state.matchedTemplates = [];
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
    quickText: state.quickText,
  });
  state.currentNote = mdSource;

  // Update source tab
  dom.sourceText.textContent = mdSource;

  // Update preview tab (render HTML from Markdown)
  const html = marked.parse(mdSource);
  dom.previewRendered.innerHTML = html;
  dom.previewEmpty.classList.add('hidden');
  dom.previewRendered.classList.remove('hidden');

  // Status
  if (matched.length === 0 && input.trim()) {
    setStatus('No templates matched — try "fever", "vomiting", "rash", "cough"', 'idle');
    // Show a helpful no-match message in preview
    dom.previewRendered.innerHTML = '<div class="sc-no-match-msg"><span class="sc-no-match-icon">🔍</span><span>No templates matched your input.</span><span class="sc-no-match-hint">Try words like: <em>fever, rash, vomiting, cough, ear pain, strep, injury…</em></span></div>';
    dom.previewEmpty.classList.add('hidden');
    dom.previewRendered.classList.remove('hidden');
  } else if (matched.length === 0) {
    setStatus('Follow-up statement ready', 'matched');
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
  state.quickText = '';
  clearQuickInputs();
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
   QUICK INSERTS / FOLLOW-UP LIST
════════════════════════════════════════════════ */

function formatDateOffset(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function formatTimeNow() {
  return new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  const prefix = before && !/\s$/.test(before) ? ' ' : '';
  textarea.value = before + prefix + text + after;
  const cursor = before.length + prefix.length + text.length;
  textarea.setSelectionRange(cursor, cursor);
  textarea.focus();
}

function updateInputFromQuickInsert(text) {
  insertAtCursor(dom.input, text);
  state.currentInput = dom.input.value;
  autoResizeTextarea(dom.input);
  updatePreview();
  scheduleAutoClear();
}

function selectedFollowUpOptions() {
  if (!dom.followUpSelect) return [];
  return Array.from(dom.followUpSelect.selectedOptions).map(option => option.value).filter(Boolean);
}

function joinFollowUpOptions(options, mode) {
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

function updateQuickText() {
  const options = selectedFollowUpOptions();
  const mode = dom.followUpJoin ? dom.followUpJoin.value : 'lines';
  state.quickText = options.length ? `**Follow-Up:**\n${joinFollowUpOptions(options, mode)}` : '';
  updatePreview();
}

function clearQuickInputs() {
  if (dom.followUpSelect) Array.from(dom.followUpSelect.options).forEach(option => { option.selected = false; });
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
  dom.clearBtn         = $('sc-clear-btn');
  dom.settingsPanel    = $('sc-settings');
  dom.settingsClose    = $('sc-settings-close');
  dom.resizeHandle     = $('sc-resize-handle');
  dom.toastContainer   = $('sc-toast-container');
  dom.newPatientBtn    = $('sc-new-patient-btn');
  dom.undoClearBtn     = $('sc-undo-clear-btn');
  dom.sourceLabelsBtnEl= $('sc-source-labels-btn');
  dom.plainTextBtn     = $('sc-plaintext-btn');
  dom.quickInsertBar   = $('sc-quick-insert-bar');
  dom.followUpSelect   = $('sc-followup-select');
  dom.followUpJoin     = $('sc-followup-join');

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
  dom.input.addEventListener('input', () => {
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

  /* ── Clear ── */
  dom.clearBtn.addEventListener('click', clearInput);

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

  /* ── Quick inserts and follow-up dropdown ── */
  if (dom.quickInsertBar) {
    dom.quickInsertBar.querySelectorAll('[data-insert]').forEach(btn => {
      btn.addEventListener('click', () => {
        const insert = btn.dataset.insert;
        if (insert === 'today') updateInputFromQuickInsert(formatDateOffset(0));
        if (insert === 'now') updateInputFromQuickInsert(formatTimeNow());
        if (insert === 'tomorrow') updateInputFromQuickInsert(formatDateOffset(1));
        if (insert === '2days') updateInputFromQuickInsert(formatDateOffset(2));
        if (insert === '1week') updateInputFromQuickInsert(formatDateOffset(7));
        if (insert === 'bullet') updateInputFromQuickInsert('\n- ');
      });
    });
  }

  if (dom.followUpSelect) {
    DEFAULT_FOLLOW_UP_OPTIONS.forEach(text => {
      const option = document.createElement('option');
      option.value = text;
      option.textContent = text;
      dom.followUpSelect.appendChild(option);
    });
    dom.followUpSelect.addEventListener('change', updateQuickText);
  }
  if (dom.followUpJoin) {
    dom.followUpJoin.addEventListener('change', updateQuickText);
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
  DEFAULT_FOLLOW_UP_OPTIONS,
  DEFAULT_BEHAVIOR,
  updatePreview,
  showToast,
  renderNote,
  matchTemplates,
  stripMarkdown,
  clearInput,
};
