/**
 * SmartChart — settings.js
 * Settings panel: note template editor, templates CRUD,
 * behavior controls, export/import/reset.
 */

'use strict';

(function () {

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const $ = id => document.getElementById(id);

  function createRichEditor(editorEl, toolbarEl, toolbarDef) {
    if (!editorEl || !toolbarEl) return null;

    function updateToolbarState() {
      toolbarEl.querySelectorAll('button[data-cmd]').forEach(btn => {
        const cmd = btn.dataset.cmd;
        try {
          btn.classList.toggle('sc-toolbar-active', document.queryCommandState(cmd));
        } catch {}
      });
    }

    editorEl.addEventListener('keyup',   updateToolbarState);
    editorEl.addEventListener('mouseup', updateToolbarState);
    editorEl.addEventListener('selectionchange', updateToolbarState);

    toolbarEl.innerHTML = '';
    toolbarDef.forEach(item => {
      if (item.type === 'divider') {
        const d = document.createElement('div');
        d.className = 'sc-toolbar-divider';
        toolbarEl.appendChild(d);
        return;
      }

      const btn = document.createElement('button');
      btn.type = 'button';

      if (item.type === 'snippet') {
        btn.dataset.snippet = item.snippet;
        btn.innerHTML = item.label;
        btn.title = item.title || item.label;
        btn.className = 'sc-template-tool';
        btn.addEventListener('click', e => {
          e.preventDefault();
          editorEl.focus();
          document.execCommand('insertHTML', false, item.snippet);
        });

      } else if (item.type === 'heading') {
        btn.dataset.heading = item.level;
        btn.innerHTML = item.label;
        btn.title = item.title || `Heading ${item.level}`;
        btn.addEventListener('click', e => {
          e.preventDefault();
          editorEl.focus();
          document.execCommand('formatBlock', false, `h${item.level}`);
        });

      } else {
        btn.dataset.cmd = item.cmd;
        btn.innerHTML = item.label;
        btn.title = item.title || item.label;
        btn.addEventListener('click', e => {
          e.preventDefault();
          editorEl.focus();
          document.execCommand(item.cmd, false, null);
          updateToolbarState();
        });
      }

      toolbarEl.appendChild(btn);
    });

    return {
      getHtml() {
        return editorEl.innerHTML
          .replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>')
          .trim();
      },
      setHtml(html) {
        editorEl.innerHTML = html || '';
      },
      focus() { editorEl.focus(); },
    };
  }

  const CONTENT_TOOLBAR = [
    { cmd: 'bold',          label: '<b>B</b>',       title: 'Bold (Ctrl+B)' },
    { cmd: 'italic',        label: '<i>I</i>',       title: 'Italic (Ctrl+I)' },
    { cmd: 'underline',     label: '<u>U</u>',       title: 'Underline (Ctrl+U)' },
    { cmd: 'strikeThrough', label: '<s>S</s>',       title: 'Strikethrough' },
    { type: 'divider' },
    { type: 'heading', level: 1, label: 'H1', title: 'Heading 1' },
    { type: 'heading', level: 2, label: 'H2', title: 'Heading 2' },
    { type: 'heading', level: 3, label: 'H3', title: 'Heading 3' },
    { type: 'divider' },
    { cmd: 'insertUnorderedList', label: '• List',   title: 'Bullet list' },
    { cmd: 'insertOrderedList',   label: '1. List',  title: 'Numbered list' },
    { cmd: 'indent',              label: '→',        title: 'Indent' },
    { cmd: 'outdent',             label: '←',        title: 'Outdent' },
    { type: 'divider' },
    { cmd: 'justifyLeft',   label: '⬤‥',  title: 'Align left' },
    { cmd: 'justifyCenter', label: '‥⬤‥', title: 'Center' },
    { cmd: 'justifyRight',  label: '‥⬤',  title: 'Align right' },
    { type: 'divider' },
    { cmd: 'removeFormat',  label: '✕ fmt', title: 'Clear formatting' },
  ];

  const NOTE_TEMPLATE_TOOLBAR = [
    { cmd: 'bold',          label: '<b>B</b>',       title: 'Bold' },
    { cmd: 'italic',        label: '<i>I</i>',       title: 'Italic' },
    { cmd: 'underline',     label: '<u>U</u>',       title: 'Underline' },
    { type: 'divider' },
    { cmd: 'insertUnorderedList', label: '• List',   title: 'Bullet list' },
    { cmd: 'insertOrderedList',   label: '1. List',  title: 'Numbered list' },
    { type: 'divider' },
    { type: 'snippet', label: '{input}',            snippet: '{input}',            title: 'Insert {input} placeholder' },
    { type: 'snippet', label: '{templates}',        snippet: '{templates}',        title: 'Insert {templates} placeholder' },
    { type: 'snippet', label: 'Follow-Up ▾',        snippet: '{dropdown:follow-up}', title: 'Nest follow-up dropdown' },
    { type: 'snippet', label: '{static:…}',         snippet: '{static:Text here}', title: 'Insert static text placeholder' },
    { type: 'divider' },
    { cmd: 'removeFormat',  label: '✕ fmt', title: 'Clear formatting' },
  ];

  function init() {
    const App = window.SmartChart;
    if (!App) { console.error('[SmartChart] app.js not loaded'); return; }

    const {
      getState, getTemplates, getNoteTemplate, getBehavior,
      setTemplates, setNoteTemplate, setBehavior,
      storage, STORAGE_KEYS,
      DEFAULT_NOTE_TEMPLATE, DEFAULT_TEMPLATES, DEFAULT_BEHAVIOR,
      showToast, updatePreview, sanitizeHtml,
    } = App;

    const state = {
      get templates()    { return getTemplates(); },
      set templates(v)   { setTemplates(v); },
      get noteTemplate() { return getNoteTemplate(); },
      set noteTemplate(v){ setNoteTemplate(v); },
      get behavior()     { return getBehavior(); },
      set behavior(v)    { setBehavior(v); },
    };

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

    const noteTemplateEditorEl  = $('sc-note-template-input');
    const noteTemplateToolbarEl = $('sc-note-template-tools');
    const noteTemplateError     = $('sc-note-template-error');
    const saveNoteBtn           = $('sc-save-note-template');
    const resetNoteBtn          = $('sc-reset-note-template');

    const noteTemplateEditor = createRichEditor(
      noteTemplateEditorEl,
      noteTemplateToolbarEl,
      NOTE_TEMPLATE_TOOLBAR
    );

    function loadNoteTemplateTab() {
      noteTemplateEditor.setHtml(state.noteTemplate);
      noteTemplateError.classList.add('hidden');
      noteTemplateError.textContent = '';
    }

    saveNoteBtn.addEventListener('click', () => {
      const html = noteTemplateEditor.getHtml();
      if (!html.includes('{input}') || !html.includes('{templates}')) {
        noteTemplateError.textContent = 'Note template must include both {input} and {templates}.';
        noteTemplateError.classList.remove('hidden');
        noteTemplateEditor.focus();
        return;
      }
      noteTemplateError.classList.add('hidden');
      state.noteTemplate = html;
      storage.set(STORAGE_KEYS.NOTE_TEMPLATE, html);
      showToast('Note template saved', 'success');
      updatePreview();
    });

    resetNoteBtn.addEventListener('click', () => {
      if (!confirm('Reset note template to the default?\n\n"{input}<br><br>{templates}"')) return;
      state.noteTemplate = DEFAULT_NOTE_TEMPLATE;
      storage.set(STORAGE_KEYS.NOTE_TEMPLATE, DEFAULT_NOTE_TEMPLATE);
      noteTemplateEditor.setHtml(DEFAULT_NOTE_TEMPLATE);
      noteTemplateError.classList.add('hidden');
      showToast('Note template reset to default', 'success');
      updatePreview();
    });

    const templateListEl     = $('sc-template-list');
    const addTemplateBtn     = $('sc-add-template-btn');
    const templateFormEl     = $('sc-template-form');
    const formTitleLabel     = $('sc-form-title-label');
    const formId             = $('sc-form-id');
    const formName           = $('sc-form-name');
    const formTriggers       = $('sc-form-triggers');
    const formType           = $('sc-form-type');
    const formDropdownFields = $('sc-form-dropdown-fields');
    const formDropdownLabel  = $('sc-form-dropdown-label');
    const formDropdownPrefix = $('sc-form-dropdown-prefix');
    const formDropdownSuffix = $('sc-form-dropdown-suffix');
    const formOptions        = $('sc-form-options');
    const formJoin           = $('sc-form-join');
    const formPriority       = $('sc-form-priority');
    const formSaveBtn        = $('sc-form-save');
    const formCancelBtn      = $('sc-form-cancel');
    const formCloseBtn       = $('sc-form-close');

    const formContentEditorEl  = $('sc-form-content-editor');
    const formContentToolbarEl = $('sc-form-content-toolbar');
    const formContentEditor = createRichEditor(
      formContentEditorEl,
      formContentToolbarEl,
      CONTENT_TOOLBAR
    );

    let activeCategory = '';

    function renderTemplateList() {
      const allSorted = [...state.templates].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
      const categories = [...new Set(allSorted.map(t => t.category || '').filter(Boolean))];

      const isWizardCategory = activeCategory
        ? allSorted.some(t => t.category === activeCategory && t.id && t.id.endsWith('-main') && t.id.startsWith('wiz-'))
        : false;

      const filterHtml = categories.length > 0 ? `
        <div class="sc-cat-filter">
          <button class="sc-cat-btn${activeCategory === '' ? ' active' : ''}" data-cat="">All</button>
          ${categories.map(c => `<button class="sc-cat-btn${activeCategory === c ? ' active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
          ${isWizardCategory ? `<button class="sc-btn sc-btn-ghost sc-wiz-edit-btn" data-wizcat="${esc(activeCategory)}" title="Re-open this diagnosis in the Template Wizard to edit and regenerate it">✦ Edit in Wizard</button>` : ''}
        </div>
      ` : '';

      const sorted = activeCategory ? allSorted.filter(t => (t.category || '') === activeCategory) : allSorted;

      if (allSorted.length === 0) {
        templateListEl.innerHTML = '<p class="sc-list-empty">No templates yet. Add one above.</p>';
        return;
      }

      templateListEl.innerHTML = filterHtml + (sorted.length === 0
        ? '<p class="sc-list-empty">No templates in this category.</p>'
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
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button class="sc-btn sc-btn-icon" data-action="edit" data-id="${esc(t.id)}" title="Edit template">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="sc-btn sc-btn-icon sc-btn-delete" data-action="delete" data-id="${esc(t.id)}" title="Delete template">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </div>
      `).join(''));

      templateListEl.querySelectorAll('.sc-cat-btn').forEach(btn => {
        btn.addEventListener('click', () => { activeCategory = btn.dataset.cat; renderTemplateList(); });
      });
      const wizEditBtn = templateListEl.querySelector('.sc-wiz-edit-btn');
      if (wizEditBtn) {
        wizEditBtn.addEventListener('click', () => {
          const diagName = wizEditBtn.dataset.wizcat;
          $('sc-settings').classList.add('hidden');
          const wizPanel = $('sc-wizard');
          if (wizPanel) wizPanel.classList.remove('hidden');
          if (window.SmartChartWizard) window.SmartChartWizard.loadDiagnosis(diagName);
        });
      }
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
      div.className = 'sc-template-preview-expand sc-md-content';
      if (t.type === 'dropdown') {
        div.innerHTML = `<p><strong>Dropdown options:</strong></p><ul>${(t.options || []).map(o => `<li>${esc(o)}</li>`).join('')}</ul>`;
      } else {
        div.innerHTML = sanitizeHtml(t.content || '');
      }
      item.appendChild(div);
    }

    function updateTemplateTypeFields() {
      const isDropdown = formType.value === 'dropdown';
      formDropdownFields.classList.toggle('hidden', !isDropdown);
      const contentGroup = formContentEditorEl && formContentEditorEl.closest('.sc-field-group');
      if (contentGroup) contentGroup.classList.toggle('hidden', isDropdown);
    }

    function openAddForm() {
      formTitleLabel.textContent = 'New Template';
      formId.value       = '';
      formName.value     = '';
      formTriggers.value = '';
      formType.value     = 'text';
      formContentEditor.setHtml('');
      formDropdownLabel.value = '';
      if (formDropdownPrefix) formDropdownPrefix.value = '';
      if (formDropdownSuffix) formDropdownSuffix.value = '';
      formOptions.value = '';
      formJoin.value = 'lines';
      const singleSelectEl = $('sc-form-single-select');
      if (singleSelectEl) singleSelectEl.checked = false;
      const showLabelEl = $('sc-form-show-label');
      if (showLabelEl) showLabelEl.checked = false;
      formPriority.value = Math.max(...state.templates.map(t => t.priority ?? 0), 0) + 10;
      const catEl = $('sc-form-category');
      if (catEl) catEl.value = '';
      updateTemplateTypeFields();
      templateFormEl.classList.remove('hidden');
      templateListEl.classList.add('hidden');
      formName.focus();
    }

    function openEditForm(id) {
      const t = state.templates.find(t => t.id === id);
      if (!t) return;
      formTitleLabel.textContent  = 'Edit Template';
      formId.value       = t.id;
      formName.value     = t.name;
      formTriggers.value = t.triggers.join(', ');
      formType.value     = t.type === 'dropdown' ? 'dropdown' : 'text';
      formContentEditor.setHtml(t.content || '');
      formDropdownLabel.value = t.label || t.name;
      if (formDropdownPrefix) formDropdownPrefix.value = t.prefix || '';
      if (formDropdownSuffix) formDropdownSuffix.value = t.suffix || '';
      formOptions.value = (t.options || []).join('\n');
      formJoin.value = t.join || 'lines';
      const singleSelectEl = $('sc-form-single-select');
      if (singleSelectEl) singleSelectEl.checked = !!(t.singleSelect);
      const showLabelEl = $('sc-form-show-label');
      if (showLabelEl) showLabelEl.checked = !!(t.showLabel);
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

    formSaveBtn.addEventListener('click', () => {
      const name        = (formName.value || '').trim();
      const triggersRaw = (formTriggers.value || '').trim();
      const type        = formType.value === 'dropdown' ? 'dropdown' : 'text';
      const content     = formContentEditor.getHtml();
      const options     = (formOptions.value || '').split('\n').map(s => s.trim()).filter(Boolean);
      const prefix      = formDropdownPrefix ? formDropdownPrefix.value : '';
      const suffix      = formDropdownSuffix ? formDropdownSuffix.value : '';
      const priority    = parseInt(formPriority.value, 10) || 10;
      const id          = formId.value || `tpl-${Date.now()}`;
      const catEl       = $('sc-form-category');
      const category    = catEl ? (catEl.value || '').trim() : '';

      if (!name) { alert('Template name is required.'); formName.focus(); return; }
      if (type === 'text' && !content.trim()) { alert('Template content cannot be empty.'); formContentEditor.focus(); return; }
      if (type === 'dropdown' && options.length === 0) { alert('Dropdown templates need at least one option.'); formOptions.focus(); return; }

      const triggers = triggersRaw.split(',').map(s => s.trim()).filter(Boolean);
      const singleSelectEl = $('sc-form-single-select');
      const singleSelect = singleSelectEl ? singleSelectEl.checked : false;
      const showLabelEl = $('sc-form-show-label');
      const showLabel = showLabelEl ? showLabelEl.checked : false;
      const template = type === 'dropdown'
        ? {
            id, name, type, triggers,
            label:    (formDropdownLabel.value || '').trim() || name,
            prefix:   prefix || undefined,
            suffix:   suffix || undefined,
            options,
            join:     formJoin.value || 'lines',
            singleSelect,
            showLabel,
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

    const autoCopyEnabledEl   = $('sc-autocopy-enabled');
    const autoCopyDelayEl     = $('sc-autocopy-delay');
    const autoCopyDelayValEl  = $('sc-autocopy-delay-val');
    const autoClearDelayEl    = $('sc-autoclear-delay');
    const autoClearDelayValEl = $('sc-autoclear-delay-val');
    const saveBehaviorBtn     = $('sc-save-behavior');

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
      const bsEl = $('sc-bullet-style-setting');
      if (bsEl) bsEl.value = state.behavior.bulletStyle || '-';
    }

    autoCopyDelayEl.addEventListener('input', () => {
      autoCopyDelayValEl.textContent = `${autoCopyDelayEl.value}s`;
    });
    autoClearDelayEl.addEventListener('input', () => {
      autoClearDelayValEl.textContent = `${autoClearDelayEl.value}s`;
    });

    saveBehaviorBtn.addEventListener('click', () => {
      state.behavior.autoCopyEnabled = autoCopyEnabledEl.checked;
      state.behavior.autoCopyDelay   = parseFloat(autoCopyDelayEl.value) * 1000;
      state.behavior.autoClearDelay  = parseFloat(autoClearDelayEl.value) * 1000;
      const ptEl2 = $('sc-plaintext-setting');
      if (ptEl2) state.behavior.plainTextCopy = ptEl2.checked;
      const slEl2 = $('sc-sourcelabels-setting');
      if (slEl2) {
        state.behavior.sourceLabels = slEl2.checked;
        const labBtn = $('sc-source-labels-btn');
        if (labBtn) labBtn.classList.toggle('active', slEl2.checked);
      }
      const bsEl2 = $('sc-bullet-style-setting');
      if (bsEl2) state.behavior.bulletStyle = bsEl2.value;
      try { storage.set(STORAGE_KEYS.BEHAVIOR, state.behavior); } catch(e) {
        showToast('Storage full — export your data first', 'error', 4000); return;
      }
      updatePreview();
      showToast('Behavior settings saved', 'success');
    });

    $('sc-export-btn').addEventListener('click', () => {
      const payload = {
        version: 2,
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
              const sanitized = data.templates.map(t => {
                if (!t || typeof t !== 'object') return null;
                return {
                  ...t,
                  id:       String(t.id       || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `tpl-${Date.now()}`,
                  name:     String(t.name     || '').slice(0, 200),
                  content:  typeof t.content === 'string' ? sanitizeHtml(t.content) : '',
                  triggers: Array.isArray(t.triggers)
                              ? t.triggers.map(tr => String(tr).slice(0, 100)).filter(Boolean)
                              : [],
                  options:  Array.isArray(t.options)
                              ? t.options.map(o => String(o).slice(0, 500))
                              : undefined,
                  label:    t.label    ? String(t.label).slice(0, 200)    : undefined,
                  category: t.category ? String(t.category).slice(0, 100) : undefined,
                  priority: Number.isFinite(t.priority) ? t.priority : 10,
                };
              }).filter(Boolean);
              state.templates = sanitized;
              storage.set(STORAGE_KEYS.TEMPLATES, state.templates);
              changes++;
            }

            if (typeof data.noteTemplate === 'string' && data.noteTemplate.trim()) {
              state.noteTemplate = sanitizeHtml(data.noteTemplate);
              storage.set(STORAGE_KEYS.NOTE_TEMPLATE, state.noteTemplate);
              changes++;
            }

            if (data.behavior && typeof data.behavior === 'object') {
              const b = data.behavior;
              const safeBehavior = {
                autoCopyDelay:   Number.isFinite(b.autoCopyDelay)   ? Math.min(Math.max(b.autoCopyDelay, 500), 30000)    : DEFAULT_BEHAVIOR.autoCopyDelay,
                autoClearDelay:  Number.isFinite(b.autoClearDelay)  ? Math.min(Math.max(b.autoClearDelay, 5000), 600000) : DEFAULT_BEHAVIOR.autoClearDelay,
                autoCopyEnabled: typeof b.autoCopyEnabled === 'boolean' ? b.autoCopyEnabled : DEFAULT_BEHAVIOR.autoCopyEnabled,
                plainTextCopy:   typeof b.plainTextCopy   === 'boolean' ? b.plainTextCopy   : DEFAULT_BEHAVIOR.plainTextCopy,
                sourceLabels:    typeof b.sourceLabels    === 'boolean' ? b.sourceLabels    : DEFAULT_BEHAVIOR.sourceLabels,
                bulletStyle:     ['-','*','–','disc'].includes(b.bulletStyle) ? b.bulletStyle : DEFAULT_BEHAVIOR.bulletStyle,
              };
              state.behavior = Object.assign({}, DEFAULT_BEHAVIOR, safeBehavior);
              storage.set(STORAGE_KEYS.BEHAVIOR, state.behavior);
              changes++;
            }

            if (changes === 0) { showToast('Nothing to import in that file', 'warning'); return; }
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

    function open() {
      loadNoteTemplateTab();
      renderTemplateList();
      loadBehaviorTab();
      closeForm();
      activateSettingsTab('note-template');
    }

    window.SmartChartSettings = { open };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 30));
  } else {
    setTimeout(init, 30);
  }

})();
