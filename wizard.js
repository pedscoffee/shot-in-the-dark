/**
 * wizard.js — Diagnosis Template Onboarding Wizard
 * Adds customized, nested dropdown templates for common diagnoses.
 * Integrates with window.SmartChart API (no changes to app.js required).
 */

'use strict';

/* ═══════════════════════════════════════════
   CATEGORY DEFINITIONS
   Each category maps to a dropdown template.
   The wizard shows only categories the user opts into.
═══════════════════════════════════════════ */

const WIZARD_CATEGORIES = [
  { id: 'history',       label: 'Key History Elements',         placeholder: 'e.g. fever for 3 days, pulling at ear, decreased appetite' },
  { id: 'exam',          label: 'Key Exam Findings',            placeholder: 'e.g. TM erythematous and bulging, decreased mobility' },
  { id: 'differential',  label: 'Differential Diagnosis',       placeholder: 'e.g. AOM, OME, otitis externa, referred pain' },
  { id: 'diagnosis',     label: 'Likely Diagnosis',             placeholder: 'e.g. Acute otitis media, bilateral' },
  { id: 'labs',          label: 'Labs',                         placeholder: 'e.g. CBC, rapid strep, UA' },
  { id: 'imaging',       label: 'Imaging',                      placeholder: 'e.g. No imaging indicated, CXR ordered' },
  { id: 'medications',   label: 'Medications (with doses)',     placeholder: 'e.g. Amoxicillin 90 mg/kg/day divided BID x10d' },
  { id: 'treatment',     label: 'Treatment / Plan Actions',     placeholder: 'e.g. Prescribed antibiotic, ear recheck in 2 weeks' },
  { id: 'supportive',    label: 'Supportive Care',              placeholder: 'e.g. Warm compress, ibuprofen for pain/fever, rest' },
  { id: 'complications', label: 'Complications to Counsel',     placeholder: 'e.g. Risk of mastoiditis, hearing loss if untreated' },
  { id: 'conditional',   label: 'Conditional Plans (If/Then)',  placeholder: 'e.g. If no improvement in 48-72h, return for reassessment' },
  { id: 'precautions',   label: 'Return Precautions',           placeholder: 'e.g. Worsening pain, new fever, stiff neck, facial swelling' },
  { id: 'discharge',     label: 'Discharge Planning',           placeholder: 'e.g. Rx sent to pharmacy, AVS printed' },
  { id: 'nursing',       label: 'Nursing Orders',               placeholder: 'e.g. Ear wicks placed, temp recheck in 30 min' },
  { id: 'followup',      label: 'Follow-Up',                    placeholder: 'e.g. Recheck in 10-14 days, sooner if not improving' },
];

/* ═══════════════════════════════════════════
   WIZARD STATE
═══════════════════════════════════════════ */

const wizardState = {
  step: 'intro',          // 'intro' | 'diagnosis' | 'categories' | 'fill' | 'preview'
  diagnosisName: '',
  diagnosisTriggers: [],
  selectedCategories: [], // array of category ids the user opted into
  customCategories: [],   // [{id, label}] user-defined
  categoryOptions: {},    // { categoryId: ['option1', 'option2', ...] }
  editingDiagnosisId: null, // if editing an existing wizard-generated template
};

/* ═══════════════════════════════════════════
   DOM HELPERS
═══════════════════════════════════════════ */

function wizEl(id) { return document.getElementById(id); }

function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') el.className = v;
    else if (k === 'innerHTML') el.innerHTML = v;
    else if (k === 'textContent') el.textContent = v;
    else el.setAttribute(k, v);
  });
  children.forEach(c => el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return el;
}

/* ═══════════════════════════════════════════
   WIZARD MODAL INJECTION
   Injects the modal HTML once on first open.
═══════════════════════════════════════════ */

function injectWizardModal() {
  if (document.getElementById('sc-wizard-modal')) return;

  const modal = createEl('div', {
    id: 'sc-wizard-modal',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'sc-wizard-title',
    className: 'sc-wizard-modal hidden',
  });

  modal.innerHTML = `
    <div class="sc-wizard-overlay" id="sc-wizard-overlay"></div>
    <div class="sc-wizard-dialog">
      <div class="sc-wizard-header">
        <h2 id="sc-wizard-title" class="sc-wizard-title">Template Wizard</h2>
        <div class="sc-wizard-steps" id="sc-wizard-step-indicator"></div>
        <button class="sc-wizard-close" id="sc-wizard-close" aria-label="Close wizard" title="Close wizard">✕</button>
      </div>
      <div class="sc-wizard-body" id="sc-wizard-body">
        <!-- Step content rendered here -->
      </div>
      <div class="sc-wizard-footer" id="sc-wizard-footer">
        <button class="sc-btn sc-btn-ghost" id="sc-wizard-back">← Back</button>
        <div class="sc-wizard-footer-right">
          <button class="sc-btn sc-btn-ghost" id="sc-wizard-skip">Skip step</button>
          <button class="sc-btn sc-btn-primary" id="sc-wizard-next">Next →</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Wire close/overlay
  document.getElementById('sc-wizard-close').addEventListener('click', closeWizard);
  document.getElementById('sc-wizard-overlay').addEventListener('click', closeWizard);
  document.getElementById('sc-wizard-back').addEventListener('click', wizardBack);
  document.getElementById('sc-wizard-next').addEventListener('click', wizardNext);
  document.getElementById('sc-wizard-skip').addEventListener('click', wizardSkip);
}

/* ═══════════════════════════════════════════
   OPEN / CLOSE
═══════════════════════════════════════════ */

function openWizard(editDiagnosisId = null) {
  injectWizardModal();
  injectWizardStyles();

  // Reset state
  Object.assign(wizardState, {
    step: 'intro',
    diagnosisName: '',
    diagnosisTriggers: [],
    selectedCategories: [],
    customCategories: [],
    categoryOptions: {},
    editingDiagnosisId: editDiagnosisId,
  });

  if (editDiagnosisId) {
    prefillFromExisting(editDiagnosisId);
  }

  document.getElementById('sc-wizard-modal').classList.remove('hidden');
  renderStep();
}

function closeWizard() {
  const modal = document.getElementById('sc-wizard-modal');
  if (modal) modal.classList.add('hidden');
}

function prefillFromExisting(parentId) {
  const templates = window.SmartChart.getTemplates();
  const parent = templates.find(t => t.id === parentId);
  if (!parent || !parent._wizardMeta) return;
  const meta = parent._wizardMeta;
  wizardState.diagnosisName = meta.diagnosisName || parent.name;
  wizardState.diagnosisTriggers = [...(parent.triggers || [])];
  wizardState.selectedCategories = [...(meta.selectedCategories || [])];
  wizardState.customCategories = [...(meta.customCategories || [])];
  wizardState.categoryOptions = JSON.parse(JSON.stringify(meta.categoryOptions || {}));
}

/* ═══════════════════════════════════════════
   STEP NAVIGATION
═══════════════════════════════════════════ */

const STEPS = ['intro', 'diagnosis', 'categories', 'fill', 'preview'];

function currentStepIndex() { return STEPS.indexOf(wizardState.step); }

function wizardNext() {
  if (!validateCurrentStep()) return;
  saveCurrentStepData();

  const idx = currentStepIndex();
  if (idx < STEPS.length - 1) {
    // Skip 'fill' step display — it's rendered inline in categories for now
    // Actually jump forward one
    wizardState.step = STEPS[idx + 1];
    renderStep();
  }
}

function wizardBack() {
  const idx = currentStepIndex();
  if (idx > 0) {
    wizardState.step = STEPS[idx - 1];
    renderStep();
  }
}

function wizardSkip() {
  const idx = currentStepIndex();
  if (idx < STEPS.length - 1) {
    wizardState.step = STEPS[idx + 1];
    renderStep();
  }
}

/* ═══════════════════════════════════════════
   VALIDATION
═══════════════════════════════════════════ */

function validateCurrentStep() {
  if (wizardState.step === 'diagnosis') {
    const nameEl = document.getElementById('wiz-diagnosis-name');
    if (!nameEl || !nameEl.value.trim()) {
      showWizardError('Please enter a diagnosis or problem name.');
      return false;
    }
  }
  if (wizardState.step === 'categories') {
    const checked = document.querySelectorAll('.wiz-cat-checkbox:checked');
    if (checked.length === 0) {
      showWizardError('Please select at least one category.');
      return false;
    }
  }
  clearWizardError();
  return true;
}

function showWizardError(msg) {
  let err = document.getElementById('sc-wizard-error');
  if (!err) {
    err = createEl('div', { id: 'sc-wizard-error', className: 'sc-wizard-error' });
    document.getElementById('sc-wizard-footer').prepend(err);
  }
  err.textContent = msg;
  err.classList.remove('hidden');
}

function clearWizardError() {
  const err = document.getElementById('sc-wizard-error');
  if (err) err.classList.add('hidden');
}

/* ═══════════════════════════════════════════
   SAVE STEP DATA
═══════════════════════════════════════════ */

function saveCurrentStepData() {
  if (wizardState.step === 'diagnosis') {
    wizardState.diagnosisName = document.getElementById('wiz-diagnosis-name').value.trim();
    const triggersEl = document.getElementById('wiz-diagnosis-triggers');
    wizardState.diagnosisTriggers = triggersEl.value
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    // Ensure the diagnosis name itself is also a trigger
    const lower = wizardState.diagnosisName.toLowerCase();
    if (!wizardState.diagnosisTriggers.includes(lower)) {
      wizardState.diagnosisTriggers.unshift(lower);
    }
  }

  if (wizardState.step === 'categories') {
    const checked = [...document.querySelectorAll('.wiz-cat-checkbox:checked')];
    wizardState.selectedCategories = checked.map(el => el.value);

    // Collect custom categories
    const customRows = document.querySelectorAll('.wiz-custom-cat-row');
    wizardState.customCategories = [];
    customRows.forEach(row => {
      const labelEl = row.querySelector('.wiz-custom-cat-label');
      if (labelEl && labelEl.value.trim()) {
        const id = 'custom_' + labelEl.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
        wizardState.customCategories.push({ id, label: labelEl.value.trim() });
      }
    });
  }

  if (wizardState.step === 'fill') {
    saveAllFillOptions();
  }
}

function saveAllFillOptions() {
  const allCategories = getAllCategories();
  allCategories.forEach(cat => {
    const container = document.getElementById(`wiz-opts-${cat.id}`);
    if (!container) return;
    const rows = container.querySelectorAll('.wiz-option-row');
    const options = [];
    rows.forEach(row => {
      const input = row.querySelector('.wiz-option-input');
      if (input && input.value.trim()) {
        options.push(input.value.trim());
      }
    });
    wizardState.categoryOptions[cat.id] = options;
  });
}

function getAllCategories() {
  const built = WIZARD_CATEGORIES.filter(c => wizardState.selectedCategories.includes(c.id));
  return [...built, ...wizardState.customCategories];
}

/* ═══════════════════════════════════════════
   STEP RENDERING
═══════════════════════════════════════════ */

function renderStep() {
  updateStepIndicator();
  updateFooterButtons();

  const body = document.getElementById('sc-wizard-body');
  body.innerHTML = '';

  switch (wizardState.step) {
    case 'intro':       renderIntroStep(body);       break;
    case 'diagnosis':   renderDiagnosisStep(body);   break;
    case 'categories':  renderCategoriesStep(body);  break;
    case 'fill':        renderFillStep(body);         break;
    case 'preview':     renderPreviewStep(body);      break;
  }
}

function updateStepIndicator() {
  const el = document.getElementById('sc-wizard-step-indicator');
  if (!el) return;
  const labels = ['Start', 'Diagnosis', 'Categories', 'Options', 'Preview'];
  el.innerHTML = STEPS.map((s, i) => {
    const active = s === wizardState.step ? 'active' : '';
    const done = currentStepIndex() > i ? 'done' : '';
    return `<span class="sc-wizard-step-dot ${active} ${done}" title="${labels[i]}">${i + 1}</span>`;
  }).join('<span class="sc-wizard-step-line"></span>');
}

function updateFooterButtons() {
  const backBtn = document.getElementById('sc-wizard-back');
  const skipBtn = document.getElementById('sc-wizard-skip');
  const nextBtn = document.getElementById('sc-wizard-next');

  backBtn.classList.toggle('hidden', wizardState.step === 'intro');
  skipBtn.classList.toggle('hidden', ['intro', 'preview'].includes(wizardState.step));

  if (wizardState.step === 'preview') {
    nextBtn.textContent = '✓ Save Templates';
    nextBtn.onclick = saveAndFinish;
  } else if (wizardState.step === 'intro') {
    nextBtn.textContent = 'Get Started →';
    nextBtn.onclick = wizardNext;
  } else {
    nextBtn.textContent = 'Next →';
    nextBtn.onclick = wizardNext;
  }
}

/* ─── Step: Intro ─────────────────────────────── */
function renderIntroStep(body) {
  body.innerHTML = `
    <div class="sc-wizard-intro">
      <div class="sc-wizard-intro-icon">🧙</div>
      <h3>Build a Diagnosis Template</h3>
      <p>This wizard helps you create a fully customized, click-through note template for a specific diagnosis or clinical problem.</p>
      <p>You'll define the <strong>common variations</strong> in history, exam, plan, and more. SmartChart will then generate nested dropdown templates so that typing the diagnosis name instantly populates a structured note — ready to click through in seconds.</p>
      <div class="sc-wizard-intro-steps">
        <div class="sc-wizard-intro-step"><span>1</span> Name your diagnosis or problem</div>
        <div class="sc-wizard-intro-step"><span>2</span> Choose which note categories apply</div>
        <div class="sc-wizard-intro-step"><span>3</span> Enter the common options for each</div>
        <div class="sc-wizard-intro-step"><span>4</span> Save — and start using it immediately</div>
      </div>
      <p class="sc-wizard-tip">💡 Tip: Start with your most common diagnoses — acute otitis media, strep pharyngitis, URI, or whatever you see most often.</p>
    </div>
  `;
}

/* ─── Step: Diagnosis Name ───────────────────── */
function renderDiagnosisStep(body) {
  const name = wizardState.diagnosisName;
  const triggers = wizardState.diagnosisTriggers.join(', ');

  body.innerHTML = `
    <div class="sc-wizard-step-content">
      <h3>Step 1: Name Your Diagnosis or Problem</h3>
      <p>Enter the primary diagnosis or presenting problem. This will be the name of your template and the main trigger word.</p>
      
      <div class="sc-wizard-field">
        <label for="wiz-diagnosis-name" class="sc-wizard-label">Diagnosis / Problem Name <span class="sc-wizard-required">*</span></label>
        <input 
          type="text" 
          id="wiz-diagnosis-name" 
          class="sc-wizard-input" 
          placeholder="e.g. Acute Otitis Media" 
          value="${escapeAttr(name)}"
          autocomplete="off"
        >
        <div class="sc-wizard-hint">This becomes the template name (e.g. "Acute Otitis Media").</div>
      </div>

      <div class="sc-wizard-field">
        <label for="wiz-diagnosis-triggers" class="sc-wizard-label">Trigger Words / Synonyms</label>
        <input 
          type="text" 
          id="wiz-diagnosis-triggers" 
          class="sc-wizard-input" 
          placeholder="e.g. ear infection, otitis media, aom, ear pain, earache" 
          value="${escapeAttr(triggers)}"
          autocomplete="off"
        >
        <div class="sc-wizard-hint">Comma-separated. Typing any of these in the main input will activate this template.</div>
      </div>
    </div>
  `;

  setTimeout(() => {
    const nameEl = document.getElementById('wiz-diagnosis-name');
    if (nameEl) nameEl.focus();
  }, 50);
}

/* ─── Step: Categories ───────────────────────── */
function renderCategoriesStep(body) {
  const selected = wizardState.selectedCategories;

  const categoryRows = WIZARD_CATEGORIES.map(cat => {
    const checked = selected.includes(cat.id) ? 'checked' : '';
    return `
      <label class="sc-wizard-cat-row">
        <input type="checkbox" class="wiz-cat-checkbox" value="${cat.id}" ${checked}>
        <span class="sc-wizard-cat-label">${cat.label}</span>
        <span class="sc-wizard-cat-hint">${cat.placeholder}</span>
      </label>
    `;
  }).join('');

  // Custom category rows (pre-existing)
  const customHtml = wizardState.customCategories.map((c, i) => buildCustomCatRow(c.label, i)).join('');

  body.innerHTML = `
    <div class="sc-wizard-step-content">
      <h3>Step 2: Choose Note Categories</h3>
      <p>Select the sections that apply to <strong>${escapeHtml(wizardState.diagnosisName)}</strong>. You only need to fill in what's clinically relevant — most diagnoses only need 4–7 categories.</p>

      <div class="sc-wizard-cat-actions">
        <button class="sc-btn sc-btn-ghost sc-btn-sm" id="wiz-select-all">Select common</button>
        <button class="sc-btn sc-btn-ghost sc-btn-sm" id="wiz-clear-all">Clear all</button>
      </div>

      <div class="sc-wizard-cat-grid" id="sc-wizard-cat-grid">
        ${categoryRows}
      </div>

      <div class="sc-wizard-custom-cats" id="sc-wizard-custom-cats">
        <div class="sc-wizard-custom-cat-header">
          <span>+ Custom Categories</span>
          <button class="sc-btn sc-btn-ghost sc-btn-sm" id="wiz-add-custom-cat">Add Custom Category</button>
        </div>
        <div id="wiz-custom-cat-rows">${customHtml}</div>
      </div>
    </div>
  `;

  document.getElementById('wiz-select-all').addEventListener('click', () => {
    const COMMON = ['history', 'exam', 'diagnosis', 'medications', 'treatment', 'supportive', 'precautions', 'followup'];
    document.querySelectorAll('.wiz-cat-checkbox').forEach(cb => {
      cb.checked = COMMON.includes(cb.value);
    });
  });

  document.getElementById('wiz-clear-all').addEventListener('click', () => {
    document.querySelectorAll('.wiz-cat-checkbox').forEach(cb => cb.checked = false);
  });

  document.getElementById('wiz-add-custom-cat').addEventListener('click', () => {
    const container = document.getElementById('wiz-custom-cat-rows');
    const idx = container.querySelectorAll('.wiz-custom-cat-row').length;
    const row = document.createElement('div');
    row.innerHTML = buildCustomCatRow('', idx);
    container.appendChild(row.firstElementChild);
    attachCustomCatRowEvents(container.lastElementChild);
  });

  // Attach events to pre-existing custom rows
  document.querySelectorAll('.wiz-custom-cat-row').forEach(row => attachCustomCatRowEvents(row));
}

function buildCustomCatRow(label, idx) {
  return `
    <div class="wiz-custom-cat-row" data-idx="${idx}">
      <input type="text" class="sc-wizard-input wiz-custom-cat-label" placeholder="Category name (e.g. Social History, Vaccines)" value="${escapeAttr(label)}">
      <button class="sc-btn sc-btn-ghost sc-btn-sm sc-btn-danger wiz-remove-custom-cat" title="Remove">✕</button>
    </div>
  `;
}

function attachCustomCatRowEvents(row) {
  const removeBtn = row.querySelector('.wiz-remove-custom-cat');
  if (removeBtn) removeBtn.addEventListener('click', () => row.remove());
}

/* ─── Step: Fill Options ─────────────────────── */
function renderFillStep(body) {
  const allCats = getAllCategories();

  body.innerHTML = `
    <div class="sc-wizard-step-content">
      <h3>Step 3: Add Options for Each Category</h3>
      <p>For each category, add the common phrasings you use. Each option will become a selectable line in the dropdown. You can always edit these later in Settings → Templates.</p>
      <div class="sc-wizard-fill-grid" id="sc-wizard-fill-grid"></div>
    </div>
  `;

  const grid = document.getElementById('sc-wizard-fill-grid');

  allCats.forEach(cat => {
    const builtIn = WIZARD_CATEGORIES.find(c => c.id === cat.id);
    const placeholder = builtIn ? builtIn.placeholder : 'Enter an option…';
    const existingOptions = wizardState.categoryOptions[cat.id] || [];

    const section = createEl('div', { className: 'sc-wizard-fill-section' });
    section.innerHTML = `
      <div class="sc-wizard-fill-header">
        <span class="sc-wizard-fill-label">${escapeHtml(cat.label)}</span>
        <button class="sc-btn sc-btn-ghost sc-btn-sm wiz-add-option-btn" data-cat="${cat.id}">+ Add option</button>
      </div>
      <div class="sc-wizard-fill-options" id="wiz-opts-${cat.id}">
        ${existingOptions.map(opt => buildOptionRow(opt, placeholder)).join('')}
        ${existingOptions.length === 0 ? buildOptionRow('', placeholder) : ''}
      </div>
    `;
    grid.appendChild(section);

    // Wire add-option button
    section.querySelector('.wiz-add-option-btn').addEventListener('click', () => {
      const container = document.getElementById(`wiz-opts-${cat.id}`);
      const row = document.createElement('div');
      row.innerHTML = buildOptionRow('', placeholder);
      container.appendChild(row.firstElementChild);
      attachOptionRowEvents(container.lastElementChild);
      container.lastElementChild.querySelector('.wiz-option-input').focus();
    });

    // Wire existing rows
    section.querySelectorAll('.wiz-option-row').forEach(row => attachOptionRowEvents(row));
  });
}

function buildOptionRow(value, placeholder) {
  return `
    <div class="wiz-option-row">
      <input type="text" class="sc-wizard-input wiz-option-input" value="${escapeAttr(value)}" placeholder="${escapeAttr(placeholder)}">
      <button class="sc-btn sc-btn-ghost sc-btn-sm sc-btn-danger wiz-remove-option-btn" title="Remove row">✕</button>
    </div>
  `;
}

function attachOptionRowEvents(row) {
  const removeBtn = row.querySelector('.wiz-remove-option-btn');
  if (removeBtn) removeBtn.addEventListener('click', () => row.remove());

  const input = row.querySelector('.wiz-option-input');
  if (input) {
    // Auto-add new row on Enter
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const container = input.closest('.sc-wizard-fill-options');
        const newRow = document.createElement('div');
        const placeholder = input.getAttribute('placeholder');
        newRow.innerHTML = buildOptionRow('', placeholder);
        container.appendChild(newRow.firstElementChild);
        attachOptionRowEvents(container.lastElementChild);
        container.lastElementChild.querySelector('.wiz-option-input').focus();
      }
    });
  }
}

/* ─── Step: Preview ──────────────────────────── */
function renderPreviewStep(body) {
  saveAllFillOptions(); // Ensure fill step data is captured even if navigated here via back

  const allCats = getAllCategories();
  const diagName = wizardState.diagnosisName;

  // Build preview of what templates will be created
  const templatePreviews = allCats
    .filter(cat => (wizardState.categoryOptions[cat.id] || []).length > 0)
    .map(cat => {
      const opts = wizardState.categoryOptions[cat.id];
      return `
        <div class="sc-wizard-preview-cat">
          <div class="sc-wizard-preview-cat-label">${escapeHtml(cat.label)}</div>
          <ul class="sc-wizard-preview-opts">
            ${opts.map(o => `<li>${escapeHtml(o)}</li>`).join('')}
          </ul>
        </div>
      `;
    }).join('');

  const emptyCats = allCats.filter(cat => (wizardState.categoryOptions[cat.id] || []).length === 0);
  const emptyWarning = emptyCats.length > 0
    ? `<div class="sc-wizard-preview-warning">⚠ ${emptyCats.length} categor${emptyCats.length > 1 ? 'ies have' : 'y has'} no options and will be skipped: <em>${emptyCats.map(c => c.label).join(', ')}</em></div>`
    : '';

  const triggerList = wizardState.diagnosisTriggers.join(', ');

  body.innerHTML = `
    <div class="sc-wizard-step-content">
      <h3>Step 4: Review &amp; Save</h3>
      <div class="sc-wizard-preview-header">
        <div class="sc-wizard-preview-name">${escapeHtml(diagName)}</div>
        <div class="sc-wizard-preview-triggers">Triggers: <em>${escapeHtml(triggerList)}</em></div>
      </div>
      ${emptyWarning}
      <p>The following dropdown sections will be created:</p>
      <div class="sc-wizard-preview-cats">${templatePreviews || '<em>No options entered yet. Go back and fill in at least one category.</em>'}</div>
      <p class="sc-wizard-tip">After saving, type <strong>${escapeHtml(wizardState.diagnosisTriggers[0] || diagName)}</strong> in the main input to activate this template instantly.</p>
    </div>
  `;
}

/* ═══════════════════════════════════════════
   TEMPLATE GENERATION & SAVE
═══════════════════════════════════════════ */

function slugify(str) {
  return String(str).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildWizardTemplates() {
  const diagSlug = slugify(wizardState.diagnosisName);
  const allCats = getAllCategories();
  const templates = [];
  const dropdownRefs = [];

  allCats.forEach(cat => {
    const options = (wizardState.categoryOptions[cat.id] || []).filter(Boolean);
    if (options.length === 0) return;

    const builtIn = WIZARD_CATEGORIES.find(c => c.id === cat.id);
    const id = `wiz-${diagSlug}-${cat.id}`;

    templates.push({
      id,
      name: `${wizardState.diagnosisName} — ${cat.label}`,
      triggers: [],           // Not triggered directly; accessed via parent
      type: 'dropdown',
      label: cat.label,
      join: 'lines',
      singleSelect: false,
      options: [...options, ''],  // trailing blank = easy deselect
      priority: 500 + templates.length,
      _wizardGenerated: true,
    });

    dropdownRefs.push(id);
  });

  // Build content HTML for parent template using {dropdown:id} placeholders
  const contentParts = dropdownRefs.map(id => `{dropdown:${id}}`).join('');

  // Parent template
  const parentId = `wiz-${diagSlug}`;
  const parentTemplate = {
    id: parentId,
    name: wizardState.diagnosisName,
    triggers: [...wizardState.diagnosisTriggers],
    content: contentParts,
    priority: 50 + (window.SmartChart.getTemplates().filter(t => !t._wizardGenerated).length),
    _wizardGenerated: true,
    _wizardMeta: {
      diagnosisName: wizardState.diagnosisName,
      selectedCategories: [...wizardState.selectedCategories],
      customCategories: JSON.parse(JSON.stringify(wizardState.customCategories)),
      categoryOptions: JSON.parse(JSON.stringify(wizardState.categoryOptions)),
    },
  };

  return [parentTemplate, ...templates];
}

function saveAndFinish() {
  saveAllFillOptions();

  const allCats = getAllCategories();
  const hasAnyOptions = allCats.some(cat => (wizardState.categoryOptions[cat.id] || []).length > 0);
  if (!hasAnyOptions) {
    showWizardError('Please add at least one option in Step 3 before saving.');
    return;
  }

  const newTemplates = buildWizardTemplates();
  const existing = window.SmartChart.getTemplates();

  // Remove old templates if editing
  const parentId = `wiz-${slugify(wizardState.diagnosisName)}`;
  const filtered = wizardState.editingDiagnosisId
    ? existing.filter(t => {
        if (t.id === wizardState.editingDiagnosisId) return false;
        if (t.id.startsWith(wizardState.editingDiagnosisId + '-')) return false;
        return true;
      })
    : existing.filter(t => {
        // Also remove any previously wizard-generated templates for same parent
        if (t.id === parentId) return false;
        if (t.id.startsWith(parentId + '-')) return false;
        return true;
      });

  const merged = [...filtered, ...newTemplates];
  window.SmartChart.setTemplates(merged);
  window.SmartChart.storage.set(window.SmartChart.STORAGE_KEYS.TEMPLATES, merged);

  closeWizard();

  window.SmartChart.showToast(
    `✓ "${wizardState.diagnosisName}" template saved — ${newTemplates.length} templates created`,
    'success',
    4000
  );

  // Offer to add another
  setTimeout(() => {
    if (confirm(`Template for "${wizardState.diagnosisName}" saved!\n\nWould you like to create another diagnosis template?`)) {
      openWizard();
    }
  }, 300);
}

/* ═══════════════════════════════════════════
   UTILITY
═══════════════════════════════════════════ */

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ═══════════════════════════════════════════
   INJECT WIZARD BUTTON into Settings Panel
   Called from DOMContentLoaded.
═══════════════════════════════════════════ */

function injectWizardButton() {
  // Try to attach to the settings panel header or create a floating button
  const settingsPanel = document.getElementById('sc-settings');
  if (settingsPanel) {
    // Look for a good insertion point (settings header)
    const header = settingsPanel.querySelector('.sc-settings-header, .sc-settings-title, h2');
    if (header) {
      const btn = createEl('button', {
        id: 'sc-wizard-btn',
        className: 'sc-btn sc-btn-primary',
        title: 'Open Template Wizard to create customized diagnosis templates',
        textContent: '🧙 Template Wizard',
      });
      btn.addEventListener('click', () => openWizard());
      header.after(btn);
      return;
    }
  }

  // Fallback: inject a floating action button
  const fab = createEl('button', {
    id: 'sc-wizard-fab',
    className: 'sc-wizard-fab',
    title: 'Template Wizard',
    innerHTML: '🧙',
    'aria-label': 'Open Template Wizard',
  });
  fab.addEventListener('click', () => openWizard());
  document.body.appendChild(fab);
}

/* ═══════════════════════════════════════════
   STYLES (injected once)
═══════════════════════════════════════════ */

function injectWizardStyles() {
  if (document.getElementById('sc-wizard-styles')) return;
  const style = document.createElement('style');
  style.id = 'sc-wizard-styles';
  style.textContent = `
    /* ═══ MODAL OVERLAY ═══ */
    .sc-wizard-modal {
      position: fixed; inset: 0; z-index: 9000;
      display: flex; align-items: center; justify-content: center;
    }
    .sc-wizard-modal.hidden { display: none; }
    .sc-wizard-overlay {
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.55); backdrop-filter: blur(2px);
    }
    .sc-wizard-dialog {
      position: relative; z-index: 1;
      background: var(--sc-bg, #1e1e2e);
      border: 1px solid var(--sc-border, #3a3a5c);
      border-radius: 12px;
      width: min(780px, 96vw);
      max-height: 88vh;
      display: flex; flex-direction: column;
      box-shadow: 0 24px 64px rgba(0,0,0,0.5);
      overflow: hidden;
    }

    /* ═══ HEADER ═══ */
    .sc-wizard-header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 20px 12px;
      border-bottom: 1px solid var(--sc-border, #3a3a5c);
      flex-shrink: 0;
    }
    .sc-wizard-title {
      font-size: 1rem; font-weight: 700; margin: 0;
      color: var(--sc-text, #cdd6f4); flex-shrink: 0;
    }
    .sc-wizard-close {
      margin-left: auto; background: none; border: none;
      color: var(--sc-muted, #6c7086); cursor: pointer;
      font-size: 1.1rem; padding: 4px 8px; border-radius: 6px;
      flex-shrink: 0;
    }
    .sc-wizard-close:hover { color: var(--sc-text, #cdd6f4); background: var(--sc-hover, rgba(255,255,255,0.07)); }

    /* ═══ STEP INDICATOR ═══ */
    .sc-wizard-steps {
      display: flex; align-items: center; gap: 0; flex: 1;
      justify-content: center;
    }
    .sc-wizard-step-dot {
      width: 24px; height: 24px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 0.7rem; font-weight: 700;
      background: var(--sc-surface, #313244);
      color: var(--sc-muted, #6c7086);
      border: 2px solid var(--sc-border, #3a3a5c);
      transition: all 0.2s;
    }
    .sc-wizard-step-dot.active {
      background: var(--sc-accent, #89b4fa);
      color: #1e1e2e; border-color: var(--sc-accent, #89b4fa);
    }
    .sc-wizard-step-dot.done {
      background: var(--sc-green, #a6e3a1);
      color: #1e1e2e; border-color: var(--sc-green, #a6e3a1);
    }
    .sc-wizard-step-line {
      width: 24px; height: 2px;
      background: var(--sc-border, #3a3a5c);
      display: inline-block;
    }

    /* ═══ BODY ═══ */
    .sc-wizard-body {
      flex: 1; overflow-y: auto; padding: 20px 24px;
    }
    .sc-wizard-step-content h3 {
      margin: 0 0 8px; font-size: 1rem; color: var(--sc-text, #cdd6f4);
    }
    .sc-wizard-step-content > p {
      color: var(--sc-muted, #6c7086); margin: 0 0 16px; font-size: 0.875rem; line-height: 1.5;
    }

    /* ═══ FOOTER ═══ */
    .sc-wizard-footer {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 20px;
      border-top: 1px solid var(--sc-border, #3a3a5c);
      flex-shrink: 0;
    }
    .sc-wizard-footer-right { margin-left: auto; display: flex; gap: 8px; }
    .sc-wizard-error {
      color: var(--sc-red, #f38ba8); font-size: 0.8rem; flex: 1;
    }
    .sc-wizard-error.hidden { display: none; }

    /* ═══ FORM FIELDS ═══ */
    .sc-wizard-field { margin-bottom: 20px; }
    .sc-wizard-label {
      display: block; font-size: 0.825rem; font-weight: 600;
      color: var(--sc-text, #cdd6f4); margin-bottom: 6px;
    }
    .sc-wizard-required { color: var(--sc-red, #f38ba8); }
    .sc-wizard-input {
      width: 100%; box-sizing: border-box;
      background: var(--sc-surface, #313244);
      border: 1px solid var(--sc-border, #3a3a5c);
      border-radius: 6px; padding: 8px 10px;
      color: var(--sc-text, #cdd6f4); font-size: 0.875rem;
      transition: border-color 0.15s;
    }
    .sc-wizard-input:focus {
      outline: none; border-color: var(--sc-accent, #89b4fa);
    }
    .sc-wizard-hint {
      font-size: 0.77rem; color: var(--sc-muted, #6c7086); margin-top: 4px; line-height: 1.4;
    }

    /* ═══ CATEGORIES ═══ */
    .sc-wizard-cat-actions { display: flex; gap: 8px; margin-bottom: 12px; }
    .sc-wizard-cat-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 6px; margin-bottom: 16px;
    }
    @media (max-width: 560px) { .sc-wizard-cat-grid { grid-template-columns: 1fr; } }
    .sc-wizard-cat-row {
      display: flex; align-items: flex-start; gap: 8px;
      padding: 8px 10px; border-radius: 6px; cursor: pointer;
      background: var(--sc-surface, #313244);
      border: 1px solid transparent;
      transition: border-color 0.15s;
    }
    .sc-wizard-cat-row:hover { border-color: var(--sc-accent, #89b4fa); }
    .sc-wizard-cat-row input[type="checkbox"] { margin-top: 2px; flex-shrink: 0; }
    .sc-wizard-cat-label { font-size: 0.825rem; color: var(--sc-text, #cdd6f4); font-weight: 600; }
    .sc-wizard-cat-hint { font-size: 0.72rem; color: var(--sc-muted, #6c7086); line-height: 1.3; display: block; margin-top: 2px; }

    .sc-wizard-custom-cats { margin-top: 16px; }
    .sc-wizard-custom-cat-header {
      display: flex; align-items: center; justify-content: space-between;
      font-size: 0.825rem; color: var(--sc-muted, #6c7086); margin-bottom: 8px;
    }
    .wiz-custom-cat-row {
      display: flex; gap: 8px; margin-bottom: 6px; align-items: center;
    }
    .wiz-custom-cat-row .sc-wizard-input { flex: 1; }

    /* ═══ FILL STEP ═══ */
    .sc-wizard-fill-grid { display: flex; flex-direction: column; gap: 20px; }
    .sc-wizard-fill-section {
      border: 1px solid var(--sc-border, #3a3a5c);
      border-radius: 8px; padding: 12px 14px;
    }
    .sc-wizard-fill-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 10px;
    }
    .sc-wizard-fill-label {
      font-size: 0.85rem; font-weight: 700; color: var(--sc-text, #cdd6f4);
    }
    .sc-wizard-fill-options { display: flex; flex-direction: column; gap: 6px; }
    .wiz-option-row { display: flex; gap: 6px; align-items: center; }
    .wiz-option-row .sc-wizard-input { flex: 1; }

    /* ═══ PREVIEW STEP ═══ */
    .sc-wizard-preview-header {
      background: var(--sc-surface, #313244);
      border-radius: 8px; padding: 12px 16px; margin-bottom: 12px;
    }
    .sc-wizard-preview-name {
      font-size: 1rem; font-weight: 700; color: var(--sc-accent, #89b4fa); margin-bottom: 4px;
    }
    .sc-wizard-preview-triggers { font-size: 0.8rem; color: var(--sc-muted, #6c7086); }
    .sc-wizard-preview-warning {
      background: rgba(243,139,168,0.1); border: 1px solid var(--sc-red, #f38ba8);
      border-radius: 6px; padding: 8px 12px; font-size: 0.8rem;
      color: var(--sc-red, #f38ba8); margin-bottom: 12px;
    }
    .sc-wizard-preview-cats { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
    .sc-wizard-preview-cat {
      border-left: 3px solid var(--sc-accent, #89b4fa);
      padding: 6px 12px;
    }
    .sc-wizard-preview-cat-label {
      font-size: 0.825rem; font-weight: 700; color: var(--sc-text, #cdd6f4); margin-bottom: 4px;
    }
    .sc-wizard-preview-opts {
      margin: 0; padding-left: 16px;
      font-size: 0.8rem; color: var(--sc-muted, #6c7086); line-height: 1.7;
    }

    /* ═══ INTRO STEP ═══ */
    .sc-wizard-intro { text-align: center; padding: 8px 0; }
    .sc-wizard-intro-icon { font-size: 3rem; margin-bottom: 12px; }
    .sc-wizard-intro h3 { font-size: 1.1rem; color: var(--sc-text, #cdd6f4); margin-bottom: 8px; }
    .sc-wizard-intro p { color: var(--sc-muted, #6c7086); font-size: 0.875rem; line-height: 1.6; max-width: 520px; margin: 0 auto 12px; }
    .sc-wizard-intro-steps {
      display: flex; flex-direction: column; gap: 8px;
      max-width: 360px; margin: 16px auto; text-align: left;
    }
    .sc-wizard-intro-step {
      display: flex; align-items: center; gap: 10px;
      font-size: 0.85rem; color: var(--sc-text, #cdd6f4);
    }
    .sc-wizard-intro-step span {
      width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
      background: var(--sc-accent, #89b4fa); color: #1e1e2e;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: 700;
    }

    /* ═══ TIP ═══ */
    .sc-wizard-tip {
      font-size: 0.8rem; color: var(--sc-yellow, #f9e2af) !important;
      background: rgba(249,226,175,0.07); border-radius: 6px;
      padding: 8px 12px; margin-top: 12px !important;
    }

    /* ═══ BUTTONS ═══ */
    .sc-btn { padding: 7px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.15s; }
    .sc-btn-primary { background: var(--sc-accent, #89b4fa); color: #1e1e2e; border-color: var(--sc-accent, #89b4fa); }
    .sc-btn-primary:hover { filter: brightness(1.1); }
    .sc-btn-ghost { background: transparent; color: var(--sc-text, #cdd6f4); border-color: var(--sc-border, #3a3a5c); }
    .sc-btn-ghost:hover { background: var(--sc-hover, rgba(255,255,255,0.07)); }
    .sc-btn-danger { color: var(--sc-red, #f38ba8) !important; }
    .sc-btn-sm { padding: 4px 10px; font-size: 0.75rem; }
    .hidden { display: none !important; }

    /* ═══ FLOATING ACTION BUTTON (fallback) ═══ */
    .sc-wizard-fab {
      position: fixed; bottom: 20px; right: 20px; z-index: 8000;
      width: 48px; height: 48px; border-radius: 50%;
      background: var(--sc-accent, #89b4fa); color: #1e1e2e;
      border: none; font-size: 1.3rem; cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.35);
      display: flex; align-items: center; justify-content: center;
    }
    .sc-wizard-fab:hover { filter: brightness(1.1); transform: scale(1.05); }
  `;
  document.head.appendChild(style);
}

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // Wait a tick for SmartChart to initialize
  setTimeout(() => {
    injectWizardStyles();
    injectWizardButton();
    // Expose globally for debugging / external triggers
    window.SmartChartWizard = { open: openWizard, close: closeWizard };
  }, 100);
});