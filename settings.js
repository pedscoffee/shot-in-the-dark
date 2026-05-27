/**
 * SmartChart — settings.js
 * Settings panel: note template editor, templates CRUD,
 * behavior controls, export/import/reset.
 *
 * Runs after app.js. Accesses shared state via window.SmartChart.
 */

'use strict';

(function () {

  /* ─── Escape HTML for safe innerHTML insertion ─── */
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const $ = id => document.getElementById(id);

  /* ════════════════════════════════════════════════
     INIT — runs after DOMContentLoaded
  ════════════════════════════════════════════════ */

  function init() {
    const App = window.SmartChart;
    if (!App) { console.error('[SmartChart] app.js not loaded'); return; }

    const {
      state, dom, storage, STORAGE_KEYS,
      DEFAULT_NOTE_TEMPLATE, DEFAULT_TEMPLATES, DEFAULT_BEHAVIOR,
      showToast, updatePreview,
    } = App;

    /* ════════════════════════════════════════════════
       SETTINGS TABS
    ════════════════════════════════════════════════ */

    function activateSettingsTab(tabId) {
      document.querySelectorAll('.sc-settings-tab').forEach(btn => {
        const active = btn.dataset.stab === tabId;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      document.querySelectorAll('.sc-stab-content').forEach(pane => {
        const show = pane.id === `stab-${tabId}`;
        pane.classList.toggle('active', show);
        pane.classList.toggle('hidden', !show);
      });
    }

    document.querySelectorAll('.sc-settings-tab').forEach(btn => {
      btn.addEventListener('click', () => activateSettingsTab(btn.dataset.stab));
    });

    /* ════════════════════════════════════════════════
       TAB: NOTE TEMPLATE
    ════════════════════════════════════════════════ */

    const noteTemplateInput = $('sc-note-template-input');
    const noteTemplateError = $('sc-note-template-error');
    const saveNoteBtn       = $('sc-save-note-template');
    const resetNoteBtn      = $('sc-reset-note-template');

    function loadNoteTemplateTab() {
      noteTemplateInput.value = state.noteTemplate;
      noteTemplateError.classList.add('hidden');
      noteTemplateError.textContent = '';
    }

    saveNoteBtn.addEventListener('click', () => {
      const val = noteTemplateInput.value || '';
      if (!val.includes('{input}') || !val.includes('{templates}')) {
        noteTemplateError.textContent = 'Note template must include both {input} and {templates}.';
        noteTemplateError.classList.remove('hidden');
        noteTemplateInput.focus();
        return;
      }
      noteTemplateError.classList.add('hidden');
      state.noteTemplate = val;
      storage.set(STORAGE_KEYS.NOTE_TEMPLATE, val);
      showToast('Note template saved', 'success');
      updatePreview();
    });

    resetNoteBtn.addEventListener('click', () => {
      if (!confirm('Reset note template to the default?\n\n"{input}\\n\\n{templates}"')) return;
      const def = DEFAULT_NOTE_TEMPLATE;
      state.noteTemplate = def;
      storage.set(STORAGE_KEYS.NOTE_TEMPLATE, def);
      noteTemplateInput.value = def;
      noteTemplateError.classList.add('hidden');
      showToast('Note template reset to default', 'success');
      updatePreview();
    });

    /* ════════════════════════════════════════════════
       TAB: TEMPLATES — LIST
    ════════════════════════════════════════════════ */

    const templateListEl  = $('sc-template-list');
    const addTemplateBtn  = $('sc-add-template-btn');
    const templateFormEl  = $('sc-template-form');

    // Form fields
    const formTitleLabel  = $('sc-form-title-label');
    const formId          = $('sc-form-id');
    const formName        = $('sc-form-name');
    const formTriggers    = $('sc-form-triggers');
    const formContent     = $('sc-form-content');
    const formPriority    = $('sc-form-priority');
    const formSaveBtn     = $('sc-form-save');
    const formCancelBtn   = $('sc-form-cancel');
    const formCloseBtn    = $('sc-form-close');

    function renderTemplateList() {
      const sorted = [...state.templates].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

      if (sorted.length === 0) {
        templateListEl.innerHTML =
          '<p style="color:var(--text-3);font-size:12px;text-align:center;padding:18px 0;">No templates yet. Add one above.</p>';
        return;
      }

      templateListEl.innerHTML = sorted.map(t => `
        <div class="sc-template-item" data-id="${esc(t.id)}">
          <div class="sc-template-info">
            <div class="sc-template-name">${esc(t.name)}</div>
            <div class="sc-template-triggers">
              ${esc(t.triggers.slice(0, 5).join(', '))}${t.triggers.length > 5 ? ' …' : ''}
            </div>
          </div>
          <span class="sc-template-priority">P${t.priority ?? '—'}</span>
          <div class="sc-template-actions">
            <button class="sc-btn sc-btn-icon" data-action="edit" data-id="${esc(t.id)}" title="Edit template">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="sc-btn sc-btn-icon" data-action="delete" data-id="${esc(t.id)}"
              title="Delete template" style="color:var(--danger)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </div>
      `).join('');

      // Attach click handlers via event delegation
      templateListEl.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const { action, id } = btn.dataset;
          if (action === 'edit')   openEditForm(id);
          if (action === 'delete') deleteTemplate(id);
        });
      });
    }

    /* ── Template form: open / close ── */

    function openAddForm() {
      formTitleLabel.textContent = 'New Template';
      formId.value       = '';
      formName.value     = '';
      formTriggers.value = '';
      formContent.value  = '';
      formPriority.value = Math.max(...state.templates.map(t => t.priority ?? 0), 0) + 10;

      templateFormEl.classList.remove('hidden');
      templateListEl.classList.add('hidden');
      formName.focus();
    }

    function openEditForm(id) {
      const t = state.templates.find(t => t.id === id);
      if (!t) return;

      formTitleLabel.textContent = 'Edit Template';
      formId.value       = t.id;
      formName.value     = t.name;
      formTriggers.value = t.triggers.join(', ');
      formContent.value  = t.content;
      formPriority.value = t.priority ?? 10;

      templateFormEl.classList.remove('hidden');
      templateListEl.classList.add('hidden');
      formName.focus();
    }

    function closeForm() {
      templateFormEl.classList.add('hidden');
      templateListEl.classList.remove('hidden');
    }

    addTemplateBtn.addEventListener('click', openAddForm);
    formCancelBtn.addEventListener('click', closeForm);
    formCloseBtn.addEventListener('click', closeForm);

    /* ── Template form: save ── */

    formSaveBtn.addEventListener('click', () => {
      const name        = (formName.value || '').trim();
      const triggersRaw = (formTriggers.value || '').trim();
      const content     = (formContent.value || '').trim();
      const priority    = parseInt(formPriority.value, 10) || 10;
      const id          = formId.value || `tpl-${Date.now()}`;

      if (!name) {
        alert('Template name is required.');
        formName.focus();
        return;
      }
      if (!triggersRaw) {
        alert('At least one trigger keyword is required.');
        formTriggers.focus();
        return;
      }
      if (!content) {
        alert('Template content cannot be empty.');
        formContent.focus();
        return;
      }

      const triggers = triggersRaw.split(',').map(s => s.trim()).filter(Boolean);
      const template = { id, name, triggers, content, priority };

      const idx = state.templates.findIndex(t => t.id === id);
      if (idx >= 0) {
        state.templates[idx] = template;
      } else {
        state.templates.push(template);
      }

      storage.set(STORAGE_KEYS.TEMPLATES, state.templates);
      renderTemplateList();
      closeForm();
      showToast(`Template "${name}" saved`, 'success');
      updatePreview();
    });

    /* ── Template delete ── */

    function deleteTemplate(id) {
      const t = state.templates.find(t => t.id === id);
      if (!t) return;
      if (!confirm(`Delete template "${t.name}"?\n\nThis cannot be undone.`)) return;
      state.templates = state.templates.filter(t => t.id !== id);
      storage.set(STORAGE_KEYS.TEMPLATES, state.templates);
      renderTemplateList();
      showToast(`"${t.name}" deleted`, 'warning');
      updatePreview();
    }

    /* ════════════════════════════════════════════════
       TAB: BEHAVIOR
    ════════════════════════════════════════════════ */

    const autoCopyEnabledEl  = $('sc-autocopy-enabled');
    const autoCopyDelayEl    = $('sc-autocopy-delay');
    const autoCopyDelayValEl = $('sc-autocopy-delay-val');
    const autoClearDelayEl   = $('sc-autoclear-delay');
    const autoClearDelayValEl= $('sc-autoclear-delay-val');
    const saveBehaviorBtn    = $('sc-save-behavior');

    function loadBehaviorTab() {
      autoCopyEnabledEl.checked       = state.behavior.autoCopyEnabled;
      autoCopyDelayEl.value           = (state.behavior.autoCopyDelay / 1000).toString();
      autoCopyDelayValEl.textContent  = `${state.behavior.autoCopyDelay / 1000}s`;
      autoClearDelayEl.value          = (state.behavior.autoClearDelay / 1000).toString();
      autoClearDelayValEl.textContent = `${state.behavior.autoClearDelay / 1000}s`;
    }

    autoCopyDelayEl.addEventListener('input', () => {
      autoCopyDelayValEl.textContent = `${autoCopyDelayEl.value}s`;
    });
    autoClearDelayEl.addEventListener('input', () => {
      autoClearDelayValEl.textContent = `${autoClearDelayEl.value}s`;
    });

    saveBehaviorBtn.addEventListener('click', () => {
      state.behavior.autoCopyEnabled  = autoCopyEnabledEl.checked;
      state.behavior.autoCopyDelay    = parseFloat(autoCopyDelayEl.value) * 1000;
      state.behavior.autoClearDelay   = parseFloat(autoClearDelayEl.value) * 1000;
      storage.set(STORAGE_KEYS.BEHAVIOR, state.behavior);
      showToast('Behavior settings saved', 'success');
    });

    /* ════════════════════════════════════════════════
       DATA MANAGEMENT
    ════════════════════════════════════════════════ */

    /* Export */
    $('sc-export-btn').addEventListener('click', () => {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        noteTemplate: state.noteTemplate,
        templates:    state.templates,
        behavior:     state.behavior,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `smartchart-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Data exported', 'success');
    });

    /* Import */
    $('sc-import-btn').addEventListener('click', () => {
      const fileInput  = document.createElement('input');
      fileInput.type   = 'file';
      fileInput.accept = '.json,application/json';
      fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            let changes = 0;

            if (Array.isArray(data.templates) && data.templates.length > 0) {
              state.templates = data.templates;
              storage.set(STORAGE_KEYS.TEMPLATES, state.templates);
              changes++;
            }
            if (typeof data.noteTemplate === 'string' && data.noteTemplate.trim()) {
              state.noteTemplate = data.noteTemplate;
              storage.set(STORAGE_KEYS.NOTE_TEMPLATE, state.noteTemplate);
              changes++;
            }
            if (data.behavior && typeof data.behavior === 'object') {
              state.behavior = Object.assign({}, DEFAULT_BEHAVIOR, data.behavior);
              storage.set(STORAGE_KEYS.BEHAVIOR, state.behavior);
              changes++;
            }

            if (changes === 0) {
              showToast('Nothing to import in that file', 'warning');
              return;
            }

            // Refresh all tabs
            loadNoteTemplateTab();
            renderTemplateList();
            loadBehaviorTab();
            updatePreview();
            showToast(`Import successful (${changes} section${changes !== 1 ? 's' : ''})`, 'success');
          } catch {
            showToast('Import failed: invalid or malformed JSON', 'error', 4000);
          }
        };
        reader.readAsText(file);
      });
      fileInput.click();
    });

    /* Reset all */
    $('sc-reset-all-btn').addEventListener('click', () => {
      if (!confirm(
        'Reset ALL SmartChart data to factory defaults?\n\n' +
        'This will overwrite all templates, the note template, and behavior settings.\n\n' +
        'This action CANNOT be undone.'
      )) return;

      state.templates    = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
      state.noteTemplate = DEFAULT_NOTE_TEMPLATE;
      state.behavior     = Object.assign({}, DEFAULT_BEHAVIOR);

      storage.set(STORAGE_KEYS.TEMPLATES,     state.templates);
      storage.set(STORAGE_KEYS.NOTE_TEMPLATE, state.noteTemplate);
      storage.set(STORAGE_KEYS.BEHAVIOR,      state.behavior);

      loadNoteTemplateTab();
      renderTemplateList();
      loadBehaviorTab();
      closeForm();
      updatePreview();
      showToast('All data reset to defaults', 'warning', 3000);
    });

    /* ════════════════════════════════════════════════
       OPEN — called by app.js when gear icon clicked
    ════════════════════════════════════════════════ */

    function open() {
      loadNoteTemplateTab();
      renderTemplateList();
      loadBehaviorTab();
      closeForm();
      activateSettingsTab('note-template');
    }

    /* ─── Expose ─── */
    window.SmartChartSettings = { open };
  }

  /* ─── Entry point: wait for both DOM and app.js ─── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 30));
  } else {
    setTimeout(init, 30);
  }

})();
