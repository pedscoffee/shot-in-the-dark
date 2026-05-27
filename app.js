/**
 * SmartChart — app.js
 * Core logic: template matching, note rendering, clipboard,
 * draggable/resizable pane, auto-copy, auto-clear, state persistence.
 *
 * Design decisions:
 *  - Copies Markdown source text (not HTML) to clipboard
 *  - Debounce preview: 300ms | Auto-copy: 1.5s | Auto-clear: 30s
 *  - Custom resize handle (more reliable than CSS resize on fixed pane)
 *  - Pane state (position/size/minimized) stored in localStorage
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
};

/* ════════════════════════════════════════════════
   APPLICATION STATE
════════════════════════════════════════════════ */

const state = {
  noteTemplate:    DEFAULT_NOTE_TEMPLATE,
  templates:       structuredClone ? structuredClone(DEFAULT_TEMPLATES) : JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
  behavior:        Object.assign({}, DEFAULT_BEHAVIOR),
  currentInput:    '',
  currentNote:     '',        // Final Markdown string ready for clipboard
  matchedTemplates:[],
  autoCopyTimer:   null,
  autoClearTimer:  null,
  previewDebounce: null,
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
 * Case-insensitive partial keyword matching. No regex.
 * Multiple matches appended in priority order.
 */
function matchTemplates(input) {
  if (!input || !input.trim()) return [];
  const lower = input.toLowerCase();
  return state.templates
    .filter(t => Array.isArray(t.triggers) &&
      t.triggers.some(trigger => lower.includes(trigger.toLowerCase()))
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
 * Replaces {input}, {templates}, and {static:...} placeholders.
 * Strips trailing whitespace per line. Returns trimmed Markdown source.
 */
function renderNote(input, matched, noteTemplate) {
  const templatesStr = matched.map(t => t.content).join('\n\n');

  let out = noteTemplate
    .replace(/\{input\}/g, input)
    .replace(/\{templates\}/g, templatesStr);

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
async function copyToClipboard(markdownText) {
  if (!markdownText || !markdownText.trim()) return false;

  // Render Markdown → HTML for the rich-text clipboard payload.
  // Wrap in a <div> so multi-paragraph notes paste as a coherent block.
  const renderedHtml = (typeof marked !== 'undefined')
    ? `<div>${marked.parse(markdownText)}</div>`
    : `<pre>${markdownText}</pre>`;

  // ── Tier 1: ClipboardItem (rich text) ──────────────────────────────────
  if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html':  new Blob([renderedHtml],  { type: 'text/html' }),
          'text/plain': new Blob([markdownText],  { type: 'text/plain' }),
        }),
      ]);
      return true;
    } catch { /* permission denied or unsupported — fall through */ }
  }

  // ── Tier 2: writeText (plain Markdown) ────────────────────────────────
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(markdownText);
      showToast('Copied as plain text (rich text not supported in this browser)', 'warning', 3500);
      return true;
    } catch { /* fall through */ }
  }

  // ── Tier 3: execCommand fallback ──────────────────────────────────────
  try {
    const ta = document.createElement('textarea');
    ta.value = markdownText;
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

  // Validate note template first
  const nt = state.noteTemplate;
  if (!nt.includes('{input}') || !nt.includes('{templates}')) {
    setStatus('Error: Note template missing {input} or {templates}', 'error');
    return;
  }

  if (!input.trim()) {
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
  const mdSource = renderNote(input, matched, nt);
  state.currentNote = mdSource;

  // Update source tab
  dom.sourceText.textContent = mdSource;

  // Update preview tab (render HTML from Markdown)
  const html = marked.parse(mdSource);
  dom.previewRendered.innerHTML = html;
  dom.previewEmpty.classList.add('hidden');
  dom.previewRendered.classList.remove('hidden');

  // Status
  if (matched.length === 0) {
    setStatus('No templates matched', 'idle');
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
    clearInput();
    showToast('Input cleared (inactivity)', 'warning', 3000);
  }, state.behavior.autoClearDelay);
}

function clearInput() {
  dom.input.value = '';
  state.currentInput = '';
  clearTimeout(state.autoClearTimer);
  cancelAutoCopy();
  // auto-resize textarea back
  dom.input.style.height = 'auto';
  debouncedUpdate();
}

/* ════════════════════════════════════════════════
   PANE PERSISTENCE
════════════════════════════════════════════════ */

function savePaneState() {
  const pane = dom.pane;
  storage.set(STORAGE_KEYS.PANE_STATE, {
    left:      pane.style.left  || '',
    top:       pane.style.top   || '',
    right:     pane.style.right || '',
    width:     pane.offsetWidth  + 'px',
    height:    pane.offsetHeight + 'px',
    minimized: pane.classList.contains('sc-minimized'),
  });
}

function restorePaneState() {
  const s = storage.get(STORAGE_KEYS.PANE_STATE);
  if (!s) return;
  const pane = dom.pane;

  if (s.left)  { pane.style.left  = s.left;  pane.style.right = 'auto'; }
  if (s.top)   { pane.style.top   = s.top; }
  if (s.width) { pane.style.width = s.width; }
  if (s.height && !s.minimized) pane.style.height = s.height;
  if (s.minimized) applyMinimize(true);

  // Clamp to viewport after restore
  requestAnimationFrame(clampPaneToViewport);
}

function clampPaneToViewport() {
  const pane = dom.pane;
  const rect = pane.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let x = rect.left;
  let y = rect.top;
  const w = pane.offsetWidth;
  const h = pane.offsetHeight;

  if (x + w > vw) x = Math.max(0, vw - w);
  if (y + h > vh) y = Math.max(0, vh - h);
  if (x < 0) x = 0;
  if (y < 0) y = 0;

  pane.style.left  = x + 'px';
  pane.style.top   = y + 'px';
  pane.style.right = 'auto';
}

/* ════════════════════════════════════════════════
   DRAG — move pane by header
════════════════════════════════════════════════ */

function initDrag() {
  dom.header.addEventListener('mousedown', onDragStart);
  dom.header.addEventListener('touchstart', onDragTouchStart, { passive: false });
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
   MINIMIZE / EXPAND
════════════════════════════════════════════════ */

function applyMinimize(minimized) {
  const pane = dom.pane;
  const btn  = dom.minimizeBtn;
  const icon = dom.minIcon;

  pane.classList.toggle('sc-minimized', minimized);

  if (minimized) {
    icon.innerHTML = '<polyline points="6 9 12 15 18 9" stroke-linecap="round" stroke-linejoin="round"/>';
    btn.title = 'Expand';
  } else {
    icon.innerHTML = '<line x1="5" y1="12" x2="19" y2="12"/>';
    btn.title = 'Minimize';
  }
}

function toggleMinimize() {
  const minimized = !dom.pane.classList.contains('sc-minimized');
  applyMinimize(minimized);
  savePaneState();
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
    dom.settingsPanel.classList.remove('hidden');
    if (window.SmartChartSettings) window.SmartChartSettings.open();
  });

  /* ── Settings close ── */
  dom.settingsClose.addEventListener('click', () => {
    dom.settingsPanel.classList.add('hidden');
  });

  /* ── Keyboard shortcut: Escape closes settings ── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dom.settingsPanel.classList.contains('hidden')) {
      dom.settingsPanel.classList.add('hidden');
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
};
