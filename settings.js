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
    const noteTemplateTools = $('sc-note-template-tools');

    // Handle Enter key to insert <br> instead of default behavior
    noteTemplateInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.execCommand('insertHTML', false, '<br>');
      }
    });

    function editorHtmlToMarkdown(html) {
      let temp = document.createElement('div');
      temp.innerHTML = html;

      function traverse(node) {
        if (node.nodeType === 3) {
          return node.nodeValue;
        }
        let res = '';
        const tag = (node.tagName || '').toLowerCase();
        for (const child of node.childNodes) {
          res += traverse(child);
        }
        if (tag === 'b' || tag === 'strong') return `**${res}**`;
        if (tag === 'i' || tag === 'em') return `*${res}*`;
        if (tag === 'u') return `<u>${res}</u>`;
        if (tag === 'p' || tag === 'div') return `\n${res}\n`;
        if (tag === 'br') return `\n`;
        if (tag === 'li') return `\n- ${res}`;
        if (tag === 'ul' || tag === 'ol') return `\n${res}\n`;
        return res;
      }

      let md = traverse(temp);

      // Cleanup whitespace and newlines
      md = md.replace(/\n- \n/g, '\n- ');

      // Trim only leading whitespace, preserve trailing blank lines from template
      md = md.trimStart();

      // Unescape standard entities
      md = md.replace(/&nbsp;/g, ' ');
      md = md.replace(/&amp;/g, '&');
      md = md.replace(/&lt;/g, '<');
      md = md.replace(/&gt;/g, '>');

      return md;
    }

    function markdownToEditorHtml(md) {
      if (!md) return '';
      let html = String(md);

      // Convert Markdown formatting to HTML tags for the editor
      html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');

      let lines = html.split('\n');
      let inList = false;
      let out = [];

      for (let line of lines) {
        if (line.match(/^[-*]\s+(.*)/)) {
          if (!inList) { out.push('<ul>'); inList = true; }
          out.push(`<li>${line.replace(/^[-*]\s+/, '')}</li>`);
        } else {
          if (inList) { out.push('</ul>'); inList = false; }
          // Preserve empty lines by ensuring they get a <br>
          out.push(`${line}<br>`);
        }
      }
      if (inList) out.push('</ul>');

      html = out.join('');
      html = html.replace(/<\/ul><br>/g, '</ul>');

      return html;
    }

    function loadNoteTemplateTab() {
      // Use markdownToEditorHtml to show the formatting as rich text
      noteTemplateInput.innerHTML = markdownToEditorHtml(state.noteTemplate);
      noteTemplateError.classList.add('hidden');
      noteTemplateError.textContent = '';
    }

    if (noteTemplateTools) {
      // Setup rich text commands
      noteTemplateTools.querySelectorAll('button[data-cmd]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const cmd = btn.dataset.cmd;
          document.execCommand(cmd, false, null);
          noteTemplateInput.focus();
        });
      });

      // Setup snippet insertion
      noteTemplateTools.querySelectorAll('button[data-snippet]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const snippet = btn.dataset.snippet || '';
          noteTemplateInput.focus();
          document.execCommand('insertText', false, snippet);
        });
      });
    }

    saveNoteBtn.addEventListener('click', () => {
      // Convert rich text HTML back to robust Markdown format
      const md = editorHtmlToMarkdown(noteTemplateInput.innerHTML);
      if (!md.includes('{input}') || !md.includes('{templates}')) {
        noteTemplateError.textContent = 'Note template must include both {input} and {templates}.';
        noteTemplateError.classList.remove('hidden');
        noteTemplateInput.focus();
        return;
      }
      noteTemplateError.classList.add('hidden');
      state.noteTemplate = md;
      storage.set(STORAGE_KEYS.NOTE_TEMPLATE, md);
      showToast('Note template saved', 'success');
      updatePreview();
    });

    resetNoteBtn.addEventListener('click', () => {
      if (!confirm(`Reset note template to the default?

"${DEFAULT_NOTE_TEMPLATE}"`)) return;
      const def = DEFAULT_NOTE_TEMPLATE;
      state.noteTemplate = def;
      storage.set(STORAGE_KEYS.NOTE_TEMPLATE, def);
      noteTemplateInput.innerHTML = markdownToEditorHtml(def);
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
    const formType        = $('sc-form-type');
    const formContent     = $('sc-form-content');
    const formDropdownFields = $('sc-form-dropdown-fields');
    const formDropdownLabel = $('sc-form-dropdown-label');
    const formOptions     = $('sc-form-options');
    const formJoin        = $('sc-form-join');
    const formPriority    = $('sc-form-priority');
    const formSaveBtn     = $('sc-form-save');
    const formCancelBtn   = $('sc-form-cancel');
    const formCloseBtn    = $('sc-form-close');

    let activeCategory = '';

    function renderTemplateList() {
      const allSorted = [...state.templates].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
      const categories = [...new Set(allSorted.map(t => t.category || '').filter(Boolean))];

      // Build category filter bar
      const filterHtml = categories.length > 0 ? `
        <div class="sc-cat-filter">
          <button class="sc-cat-btn${activeCategory === '' ? ' active' : ''}" data-cat="">All</button>
          ${categories.map(c => `<button class="sc-cat-btn${activeCategory === c ? ' active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
        </div>
      ` : '';

      const sorted = activeCategory ? allSorted.filter(t => (t.category || '') === activeCategory) : allSorted;

      if (allSorted.length === 0) {
        templateListEl.innerHTML =
          '<p style="color:var(--text-3);font-size:12px;text-align:center;padding:18px 0;">No templates yet. Add one above.</p>';
        return;
      }

      templateListEl.innerHTML = filterHtml + (sorted.length === 0
        ? '<p style="color:var(--text-3);font-size:12px;text-align:center;padding:18px 0;">No templates in this category.</p>'
        : sorted.map(t => `
        <div class="sc-template-item" data-id="${esc(t.id)}">
          <div class="sc-template-info">
            <div class="sc-template-name-row">
              <span class="sc-template-name">${esc(t.name)}</span>
              ${t.category ? `<span class="sc-template-cat-badge">${esc(t.category)}</span>` : ''}
              ${t.type === 'dropdown' ? '<span class="sc-template-cat-badge">Dropdown</span>' : ''}
            </div>
            <div class="sc-template-triggers">
              ${esc(t.triggers.slice(0, 5).join(', '))}${t.triggers.length > 5 ? ' …' : ''}
            </div>
          </div>
          <span class="sc-template-priority">P${t.priority ?? '—'}</span>
          <div class="sc-template-actions">
            <button class="sc-btn sc-btn-icon" data-action="preview" data-id="${esc(t.id)}" title="Preview template content">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
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
      `).join(''));

      // Category filter click handlers
      templateListEl.querySelectorAll('.sc-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          activeCategory = btn.dataset.cat;
          renderTemplateList();
        });
      });

      // Template action click handlers
      templateListEl.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const { action, id } = btn.dataset;
          if (action === 'edit')    openEditForm(id);
          if (action === 'delete')  deleteTemplate(id);
          if (action === 'preview') togglePreview(id, btn);
        });
      });
    }

    function togglePreview(id, btn) {
      const item = btn.closest('.sc-template-item');
      const existing = item.querySelector('.sc-template-preview-expand');
      if (existing) { existing.remove(); return; }
      const t = state.templates.find(t => t.id === id);
      if (!t) return;
      const div = document.createElement('div');
      div.className = 'sc-template-preview-expand';
      div.textContent = t.type === 'dropdown'
        ? `Dropdown options:\n${(t.options || []).map(o => `- ${o}`).join('\n')}`
        : t.content;
      item.appendChild(div);
    }

    function updateTemplateTypeFields() {
      const isDropdown = formType.value === 'dropdown';
      formDropdownFields.classList.toggle('hidden', !isDropdown);
      formContent.closest('.sc-field-group').classList.toggle('hidden', isDropdown);
    }

    /* ── Template form: open / close ── */

    function openAddForm() {
      formTitleLabel.textContent = 'New Template';
      formId.value       = '';
      formName.value     = '';
      formTriggers.value = '';
      formType.value     = 'text';
      formContent.value  = '';
      formDropdownLabel.value = '';
      formOptions.value = '';
      formJoin.value = 'lines';
      formPriority.value = Math.max(...state.templates.map(t => t.priority ?? 0), 0) + 10;
      const catElAdd = $('sc-form-category');
      if (catElAdd) catElAdd.value = '';
      updateTemplateTypeFields();

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
      formType.value     = t.type === 'dropdown' ? 'dropdown' : 'text';
      formContent.value  = t.content || '';
      formDropdownLabel.value = t.label || t.name;
      formOptions.value = (t.options || []).join('\n');
      formJoin.value = t.join || 'lines';
      formPriority.value = t.priority ?? 10;
      const catEl = $('sc-form-category');
      if (catEl) catEl.value = t.category || '';
      updateTemplateTypeFields();

      templateFormEl.classList.remove('hidden');
      templateListEl.classList.add('hidden');
      formName.focus();
    }

    function closeForm() {
      templateFormEl.classList.add('hidden');
      templateListEl.classList.remove('hidden');
    }

    addTemplateBtn.addEventListener('click', openAddForm);
    formType.addEventListener('change', updateTemplateTypeFields);
    formCancelBtn.addEventListener('click', closeForm);
    formCloseBtn.addEventListener('click', closeForm);

    if (typeof App.attachSmartTextareaBehavior === 'function') {
      App.attachSmartTextareaBehavior(formContent, () => {});
    }

    /* ── Template form: save ── */

    formSaveBtn.addEventListener('click', () => {
      const name        = (formName.value || '').trim();
      const triggersRaw = (formTriggers.value || '').trim();
      const type        = formType.value === 'dropdown' ? 'dropdown' : 'text';
      const content     = (formContent.value || '').trim();
      const options     = (formOptions.value || '').split('\n').map(s => s.trim()).filter(Boolean);
      const priority    = parseInt(formPriority.value, 10) || 10;
      const id          = formId.value || `tpl-${Date.now()}`;
      const catElSave   = $('sc-form-category');
      const category    = catElSave ? (catElSave.value || '').trim() : '';

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
      if (type === 'text' && !content) {
        alert('Template content cannot be empty.');
        formContent.focus();
        return;
      }
      if (type === 'dropdown' && options.length === 0) {
        alert('Dropdown templates need at least one option.');
        formOptions.focus();
        return;
      }

      const triggers = triggersRaw.split(',').map(s => s.trim()).filter(Boolean);
      const template = type === 'dropdown'
        ? {
            id,
            name,
            type,
            triggers,
            label: (formDropdownLabel.value || '').trim() || name,
            options,
            join: formJoin.value || 'lines',
            priority,
            ...(category ? { category } : {}),
          }
        : { id, name, triggers, content, priority, ...(category ? { category } : {}) };

      const idx = state.templates.findIndex(t => t.id === id);
      if (idx >= 0) {
        state.templates[idx] = template;
      } else {
        state.templates.push(template);
      }

      try { storage.set(STORAGE_KEYS.TEMPLATES, state.templates); }
      catch(e) { showToast('Storage full — export your data first', 'error', 4000); return; }
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
      const ptEl = $('sc-plaintext-setting');
      if (ptEl) ptEl.checked = !!state.behavior.plainTextCopy;
      const slEl = $('sc-sourcelabels-setting');
      if (slEl) slEl.checked = !!state.behavior.sourceLabels;
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
      const ptEl2 = $('sc-plaintext-setting');
      if (ptEl2) state.behavior.plainTextCopy = ptEl2.checked;
      const slEl2 = $('sc-sourcelabels-setting');
      if (slEl2) {
        state.behavior.sourceLabels = slEl2.checked;
        const labBtn = $('sc-source-labels-btn');
        if (labBtn) labBtn.classList.toggle('active', slEl2.checked);
      }
      try { storage.set(STORAGE_KEYS.BEHAVIOR, state.behavior); } catch(e) {
        showToast('Storage full — export your data first', 'error', 4000); return;
      }
      updatePreview();
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
