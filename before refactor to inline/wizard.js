/**
 * SmartChart — wizard.js
 * Diagnosis Template Wizard: dynamic table generation, custom categories,
 * pre-defined template linking, template generation logic.
 */

'use strict';

(function () {

  const $ = id => document.getElementById(id);

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function slugify(str) {
    return String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 50);
  }

  const DEFAULT_CATEGORIES = [
    {
      id: 'history',
      name: 'Key elements of history',
      desc: 'Symptom details (e.g. onset, duration, quality, aggravating/alleviating factors)',
      placeholder: 'Left ear pain for 2 days; positive congestion\nRight ear pain for 1 day; positive fever\nBilateral ear pain for 3 days; no drainage\nNo ear pain; positive tugging at ears',
      defaultMode: 'singleSelect'
    },
    {
      id: 'exam',
      name: 'Key exam findings',
      desc: 'Physical exam parameters (e.g. tympanic membrane, throat, lungs, abdomen findings)',
      placeholder: 'Left TM red and bulging with middle ear effusion; right TM normal\nRight TM red and bulging with middle ear effusion; left TM normal\nBilateral TMs red and bulging with middle ear effusion\nNormal TMs bilaterally; no erythema or effusion',
      defaultMode: 'singleSelect'
    },
    {
      id: 'differential',
      name: 'Key elements of differential',
      desc: 'Alternative or contributing diagnoses considered and/or ruled out',
      placeholder: 'Acute Otitis Media vs. Otitis Externa vs. Referred Otalgia\nAcute Otitis Media vs. Myringitis\nOtitis Media with Effusion vs. Acute Otitis Media',
      defaultMode: 'singleSelect'
    },
    {
      id: 'likely-diagnosis',
      name: 'Likely diagnosis',
      desc: 'The working diagnosis or assessment',
      placeholder: 'Acute otitis media of left ear\nAcute otitis media of right ear\nBilateral acute otitis media\nOtitis media with effusion',
      defaultMode: 'singleSelect'
    },
    {
      id: 'labs',
      name: 'Labs',
      desc: 'Laboratory testing ordered or reviewed',
      placeholder: 'Rapid strep test: negative; culture pending\nRapid strep test: positive\nUrinalysis and culture ordered\nNo labs indicated at this time',
      defaultMode: 'singleSelect'
    },
    {
      id: 'imaging',
      name: 'Imaging',
      desc: 'Radiology or bedside imaging ordered/performed',
      placeholder: 'Chest X-ray ordered to rule out pneumonia\nBedside ultrasound performed showing no effusion\nNo imaging indicated at this time',
      defaultMode: 'singleSelect'
    },
    {
      id: 'medications',
      name: 'Medications with exact doses if stated',
      desc: 'Pharmacological treatment prescriptions with precise dosing guidance',
      placeholder: 'Amoxicillin 90 mg/kg/day divided BID x10 days\nCefdinir 14 mg/kg/day QD x10 days\nAmoxicillin-Clavulanate 90 mg/kg/day (amoxicillin component) divided BID x10 days\nOTC pain relievers for comfort; no antibiotics indicated at this time',
      defaultMode: 'singleSelect'
    },
    {
      id: 'treatment-plan-actions',
      name: 'Treatment / plan actions',
      desc: 'Active counseling, procedures, or clinic-specific interventions',
      placeholder: 'Counseled parents on diagnosis, treatment options, and watchful waiting.\nEar drop application instructions reviewed.\nReviewed importance of completing full antibiotic course.',
      defaultMode: 'lines'
    },
    {
      id: 'supportive-care',
      name: 'Supportive care',
      desc: 'Non-pharmacological measures, OTC medications, hydration, rest',
      placeholder: 'Supportive care with OTC Tylenol/Motrin for pain and fever.\nEnsure adequate hydration with water, electrolyte solutions, or popsicles.\nRecommend rest and warm compresses over the ear for comfort.',
      defaultMode: 'lines'
    },
    {
      id: 'complications',
      name: 'Complications patient is at risk for',
      desc: 'Clinical risks caregiver should monitor for (e.g. dehydration, mastoiditis)',
      placeholder: 'Untreated or worsening infection could lead to TM perforation or hearing loss.\nRisk of worsening respiratory distress or clinical deterioration.\nRisk of dehydration if PO intake remains poor.',
      defaultMode: 'lines'
    },
    {
      id: 'conditional-plans',
      name: 'Conditional plans (if X, then Y)',
      desc: 'Contingency plans if symptoms change or fail to resolve',
      placeholder: 'If fever persists past 48 hours of antibiotics, contact clinic for reassessment.\nIf unable to keep fluids down or urinates <3 times a day, go to the nearest ER.\nIf watchful waiting fails after 48-72 hours, fill the standby antibiotic prescription.',
      defaultMode: 'lines'
    },
    {
      id: 'return-precautions',
      name: 'Return precautions',
      desc: 'Red flag symptoms indicating the need for prompt re-evaluation',
      placeholder: 'Return immediately for high fever, lethargy, stiff neck, persistent vomiting, or drainage from the ear.\nReturn immediately for fast breathing, retractions, grunting, or blue lips.\nReturn immediately for inability to tolerate oral fluids, extreme listlessness, or no wet diapers for 8+ hours.',
      defaultMode: 'lines'
    },
    {
      id: 'discharge-planning',
      name: 'Discharge planning',
      desc: 'Parameters for discharge or clinic wrap-up',
      placeholder: 'Discharged home in stable condition; parent agreeable to plan.\nDischarged home with AVS and educational handouts printed.',
      defaultMode: 'lines'
    },
    {
      id: 'nursing-orders',
      name: 'Nursing orders',
      desc: 'Instructions for clinic or nursing staff (e.g., vital signs, administering dose)',
      placeholder: 'Administer one dose of Acetaminophen in clinic before discharge.\nNursing to check vital signs and check out patient.\nNursing to provide educational handout on ear infections.',
      defaultMode: 'lines'
    },
    {
      id: 'follow-up',
      name: 'Follow-Up',
      desc: 'Schedule or criteria for follow-up evaluation',
      placeholder: 'Follow up in 2 to 3 days if not improving or worsening.\nFollow up in 10 to 14 days for ear recheck.\nFollow up as needed for recurring symptoms.',
      defaultMode: 'singleSelect'
    }
  ];

  let customCategoryCounter = 0;

  function init() {
    const App = window.SmartChart;
    if (!App) { console.error('[SmartChart] app.js not loaded'); return; }

    const {
      getTemplates, setTemplates, storage, STORAGE_KEYS,
      showToast, updatePreview
    } = App;

    const listContainer = $('sc-wiz-categories-body');
    const linkedTemplatesContainer = $('sc-wiz-linked-templates');
    const addCustomBtn = $('sc-wiz-add-category-btn');
    const generateBtn = $('sc-wiz-generate-btn');
    const cancelBtn = $('sc-wiz-cancel-btn');
    const closeBtn = $('sc-wiz-close');

    function renderCategories() {
      listContainer.innerHTML = '';
      DEFAULT_CATEGORIES.forEach(cat => {
        addCategoryRow(cat.name, cat.desc, cat.placeholder, cat.defaultMode, cat.id, false);
      });
    }

    function addCategoryRow(name, desc, placeholder, defaultMode, id, isCustom = false) {
      const row = document.createElement('tr');
      row.dataset.id = id;
      row.dataset.custom = isCustom;

      const checkboxTd = document.createElement('td');
      checkboxTd.className = 'sc-wiz-td sc-wiz-td--checkbox';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'sc-wiz-checkbox';
      checkboxTd.appendChild(checkbox);

      const nameTd = document.createElement('td');
      nameTd.className = 'sc-wiz-td';
      if (isCustom) {
        const titleCell = document.createElement('div');
        titleCell.className = 'sc-wiz-category-title-cell';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'sc-input-settings sc-wiz-custom-name sc-wiz-custom-name-input';
        input.value = name;
        input.placeholder = 'e.g. School Excuse';
        titleCell.appendChild(input);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'sc-wiz-delete-row-btn';
        delBtn.title = 'Remove custom category';
        delBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="14" height="14">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          </svg>
        `;
        delBtn.addEventListener('click', () => {
          row.remove();
        });
        titleCell.appendChild(delBtn);
        nameTd.appendChild(titleCell);
      } else {
        const wrap = document.createElement('div');
        wrap.className = 'sc-wiz-category-label-wrap';

        const nameRow = document.createElement('div');
        nameRow.className = 'sc-wiz-category-name-row';

        const title = document.createElement('span');
        title.className = 'sc-wiz-category-name';
        title.textContent = name;

        const editIcon = document.createElement('span');
        editIcon.className = 'sc-wiz-category-edit-icon';
        editIcon.title = 'Rename category';
        editIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'sc-wiz-category-name-input';
        nameInput.value = name;
        nameInput.style.display = 'none';

        function startEditing() {
          title.style.display = 'none';
          editIcon.style.display = 'none';
          nameInput.style.display = '';
          nameInput.focus();
          nameInput.select();
        }
        function stopEditing() {
          const val = nameInput.value.trim() || title.textContent;
          nameInput.value = val;
          title.textContent = val;
          nameInput.style.display = 'none';
          title.style.display = '';
          editIcon.style.display = '';
        }

        nameRow.addEventListener('click', startEditing);
        nameInput.addEventListener('blur', stopEditing);
        nameInput.addEventListener('keydown', e => {
          if (e.key === 'Enter')  { e.preventDefault(); stopEditing(); }
          if (e.key === 'Escape') { nameInput.value = title.textContent; stopEditing(); }
        });

        nameRow.appendChild(title);
        nameRow.appendChild(editIcon);
        wrap.appendChild(nameRow);
        wrap.appendChild(nameInput);

        const descSpan = document.createElement('span');
        descSpan.className = 'sc-wiz-category-desc';
        descSpan.textContent = desc;
        wrap.appendChild(descSpan);
        nameTd.appendChild(wrap);
      }

      const prefixTd = document.createElement('td');
      prefixTd.className = 'sc-wiz-td';
      const prefixInput = document.createElement('input');
      prefixInput.type = 'text';
      prefixInput.className = 'sc-input-settings sc-wiz-prefix';
      prefixInput.placeholder = 'e.g. - Pain Location: ';
      prefixTd.appendChild(prefixInput);

      const textareaTd = document.createElement('td');
      textareaTd.className = 'sc-wiz-td';
      const textarea = document.createElement('textarea');
      textarea.placeholder = placeholder || 'Enter variations, one per line...';
      textarea.addEventListener('input', () => {
        if (textarea.value.trim().length > 0) {
          checkbox.checked = true;
        } else {
          checkbox.checked = false;
        }
      });
      textareaTd.appendChild(textarea);

      const modeTd = document.createElement('td');
      modeTd.className = 'sc-wiz-td';
      const select = document.createElement('select');
      [
        ['singleSelect', 'Single-select'],
        ['lines', 'Bullets'],
        ['comma', 'Comma list'],
        ['and', 'Comma + and'],
        ['or', 'Comma + or'],
        ['sentence', 'Sentence'],
        ['paragraphs', 'Paragraphs']
      ].forEach(([val, text]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = text;
        opt.selected = val === defaultMode;
        select.appendChild(opt);
      });
      modeTd.appendChild(select);

      const reorderTd = document.createElement('td');
      reorderTd.className = 'sc-wiz-td sc-wiz-reorder-td';

      const moveUp = document.createElement('button');
      moveUp.type = 'button';
      moveUp.className = 'sc-wiz-move-btn';
      moveUp.title = 'Move up';
      moveUp.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="18 15 12 9 6 15"/></svg>';
      moveUp.addEventListener('click', () => {
        const prev = row.previousElementSibling;
        if (prev) listContainer.insertBefore(row, prev);
      });

      const moveDown = document.createElement('button');
      moveDown.type = 'button';
      moveDown.className = 'sc-wiz-move-btn';
      moveDown.title = 'Move down';
      moveDown.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="6 9 12 15 18 9"/></svg>';
      moveDown.addEventListener('click', () => {
        const next = row.nextElementSibling;
        if (next) listContainer.insertBefore(next, row);
      });

      reorderTd.append(moveUp, moveDown);
      row.append(checkboxTd, nameTd, prefixTd, textareaTd, modeTd, reorderTd);
      listContainer.appendChild(row);

      if (isCustom) {
        checkbox.checked = true;
      }
    }

    function renderLinkedTemplates() {
      linkedTemplatesContainer.innerHTML = '';
      const templates = getTemplates();
      const filterable = templates.filter(t => t.type !== 'dropdown');
      if (filterable.length === 0) {
        linkedTemplatesContainer.innerHTML = '<span class="sc-muted" style="grid-column: 1/-1; padding: 10px; font-style: italic;">No existing templates available.</span>';
        return;
      }
      filterable.forEach(t => {
        const item = document.createElement('label');
        item.className = 'sc-wiz-linked-template-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.id = t.id;
        const name = document.createElement('span');
        name.textContent = t.name;
        name.title = t.name;
        item.append(checkbox, name);
        linkedTemplatesContainer.appendChild(item);
      });
    }

    addCustomBtn.addEventListener('click', () => {
      customCategoryCounter++;
      addCategoryRow('', '', 'Enter custom variations, one per line...', 'lines', `custom-${customCategoryCounter}`, true);
      const container = listContainer.closest('.sc-wiz-table-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });

    generateBtn.addEventListener('click', () => {
      const diagName = ($('sc-wiz-name').value || '').trim();
      const triggersRaw = ($('sc-wiz-triggers').value || '').trim();

      if (!diagName) {
        alert('Diagnosis or Problem Name is required.');
        $('sc-wiz-name').focus();
        return;
      }
      if (!triggersRaw) {
        alert('At least one trigger keyword is required.');
        $('sc-wiz-triggers').focus();
        return;
      }

      const triggers = triggersRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

      const rows = Array.from(listContainer.querySelectorAll('tr'));
      const enabledCategories = [];

      let hasInvalidCategory = false;

      rows.forEach(row => {
        const checkbox = row.querySelector('.sc-wiz-checkbox');
        if (!checkbox || !checkbox.checked) return;

        let name = '';
        const isCustom = row.dataset.custom === 'true';
        if (isCustom) {
          const input = row.querySelector('.sc-wiz-custom-name');
          name = input ? input.value.trim() : '';
        } else {
          const nameInput = row.querySelector('.sc-wiz-category-name-input');
          const nameSpan  = row.querySelector('.sc-wiz-category-name');
          name = (nameInput && nameInput.value.trim())
               || (nameSpan  && nameSpan.textContent.trim())
               || '';
        }

        if (!name) {
          hasInvalidCategory = true;
          return;
        }

        const prefixInput = row.querySelector('.sc-wiz-prefix');
        const prefixText = prefixInput ? prefixInput.value : '';

        const textarea = row.querySelector('textarea');
        const options = (textarea ? textarea.value : '')
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean);

        if (options.length === 0) {
          hasInvalidCategory = true;
          alert(`Please fill in some variations for the checked category "${name}".`);
          textarea.focus();
          return;
        }

        const select = row.querySelector('select');
        const selectMode = select ? select.value : 'lines';

        enabledCategories.push({
          id: row.dataset.id,
          name,
          prefix: prefixText,
          options,
          selectMode,
          isCustom
        });
      });

      if (hasInvalidCategory) return;

      if (enabledCategories.length === 0) {
        alert('Please enable at least one category and enter variations to generate the template.');
        return;
      }

      const templates = getTemplates();
      let subPriority = Math.max(...templates.map(t => t.priority ?? 0), 900) + 1;
      const diagSlug = slugify(diagName);

      const newTemplates = [];
      const dropdownReferences = [];

      enabledCategories.forEach(cat => {
        const catSlug = slugify(cat.name);
        const dropdownId = `wiz-${diagSlug}-${catSlug}`;
        const isSingle = cat.selectMode === 'singleSelect';

        const dropdownTemplate = {
          id: dropdownId,
          name: `${diagName} — ${cat.name}`,
          type: 'dropdown',
          triggers: [],
          label: cat.name,
          prefix: cat.prefix || undefined,
          join: isSingle ? 'lines' : cat.selectMode,
          singleSelect: isSingle,
          showLabel: false,
          options: cat.options,
          priority: subPriority++,
          category: diagName
        };

        newTemplates.push(dropdownTemplate);
        dropdownReferences.push({
          name: cat.name,
          id: dropdownId
        });
      });

      const mainTemplateId = `wiz-${diagSlug}-main`;
      const layoutSelect = $('sc-wiz-layout');
      const useDivs = layoutSelect ? layoutSelect.value === 'divs' : true;
      let contentHtml = '';
      
      if (useDivs) {
        dropdownReferences.forEach(ref => {
          contentHtml += `<div>{dropdown:${ref.id}}</div>`;
        });
      } else {
        dropdownReferences.forEach(ref => {
          contentHtml += `{dropdown:${ref.id}} `;
        });
        contentHtml = contentHtml.replace(/ $/, '');
      }

      const mainTemplate = {
        id: mainTemplateId,
        name: diagName,
        triggers: triggers,
        content: contentHtml,
        priority: 1,
        category: diagName
      };

      newTemplates.push(mainTemplate);

      const currentTemplates = [...templates];
      const selectedTemplateCheckboxes = Array.from(linkedTemplatesContainer.querySelectorAll('input[type="checkbox"]:checked'));
      const linkedTemplateIds = selectedTemplateCheckboxes.map(cb => cb.dataset.id);

      linkedTemplateIds.forEach(id => {
        const t = currentTemplates.find(t => t.id === id);
        if (t) {
          const updatedTriggers = [...(t.triggers || [])];
          triggers.forEach(trg => {
            if (!updatedTriggers.includes(trg)) {
              updatedTriggers.push(trg);
            }
          });
          t.triggers = updatedTriggers;
        }
      });

      const newTemplateIds = newTemplates.map(t => t.id);
      let updatedAllTemplates = currentTemplates.filter(t => !newTemplateIds.includes(t.id));
      updatedAllTemplates = updatedAllTemplates.concat(newTemplates);

      try {
        storage.set(STORAGE_KEYS.TEMPLATES, updatedAllTemplates);
        setTemplates(updatedAllTemplates);
        showToast(`Successfully generated templates for ${diagName}!`, 'success', 3500);
        updatePreview();

        const wizardPanel = $('sc-wizard');
        if (wizardPanel) wizardPanel.classList.add('hidden');

        $('sc-wiz-name').value = '';
        $('sc-wiz-triggers').value = '';
        renderCategories();
      } catch (err) {
        showToast('Error saving templates - LocalStorage limit exceeded', 'error', 4000);
        console.error(err);
      }
    });

    function loadDiagnosis(diagName) {
      const templates = getTemplates();
      const diagSlug = slugify(diagName);
      const mainId = `wiz-${diagSlug}-main`;
      const mainTpl = templates.find(t => t.id === mainId);

      $('sc-wiz-name').value = diagName;
      $('sc-wiz-triggers').value = mainTpl ? (mainTpl.triggers || []).join(', ') : '';
      customCategoryCounter = 0;

      const layoutSelect = $('sc-wiz-layout');
      if (layoutSelect && mainTpl && mainTpl.content) {
        layoutSelect.value = mainTpl.content.includes('<div>') ? 'divs' : 'spaces';
      }

      const dropdownIds = [];
      if (mainTpl && mainTpl.content) {
        const re = /\{dropdown:([^}]+)\}/g;
        let m;
        while ((m = re.exec(mainTpl.content)) !== null) {
          dropdownIds.push(m[1].trim());
        }
      }

      const subMap = {};
      templates.forEach(t => {
        if (t.category === diagName && t.id !== mainId) subMap[t.id] = t;
      });

      listContainer.innerHTML = '';
      DEFAULT_CATEGORIES.forEach(cat => {
        const expectedId = `wiz-${diagSlug}-${slugify(cat.name)}`;
        const subTpl = subMap[expectedId];

        const actualId = dropdownIds.find(id => id === expectedId)
          || dropdownIds.find(id => {
            const t = subMap[id];
            return t && slugify(t.label || '') === slugify(cat.name);
          });
        const resolvedTpl = actualId ? (subMap[actualId] || subTpl) : subTpl;

        const displayName = (resolvedTpl && resolvedTpl.label && resolvedTpl.label !== cat.name)
          ? resolvedTpl.label
          : cat.name;

        addCategoryRow(displayName, cat.desc, cat.placeholder, cat.defaultMode, cat.id, false);

        if (resolvedTpl) {
          const row = listContainer.lastElementChild;
          const textarea = row.querySelector('textarea');
          const select = row.querySelector('select');
          const checkbox = row.querySelector('.sc-wiz-checkbox');
          const prefixInput = row.querySelector('.sc-wiz-prefix');
          
          if (textarea) textarea.value = (resolvedTpl.options || []).join('\n');
          if (select) {
            const mode = resolvedTpl.singleSelect ? 'singleSelect' : (resolvedTpl.join || 'lines');
            select.value = mode;
          }
          if (prefixInput) prefixInput.value = resolvedTpl.prefix || '';
          if (checkbox) checkbox.checked = true;
        }
      });

      const defaultExpectedIds = DEFAULT_CATEGORIES.map(cat => `wiz-${diagSlug}-${slugify(cat.name)}`);
      const handledIds = new Set(defaultExpectedIds);
      handledIds.add(mainId);

      dropdownIds.forEach(id => {
        if (handledIds.has(id)) return;
        const t = subMap[id];
        if (!t) return;
        customCategoryCounter++;
        addCategoryRow(t.label || t.name, '', 'Enter custom variations, one per line...', t.join || 'lines', `custom-${customCategoryCounter}`, true);
        const row = listContainer.lastElementChild;
        const textarea = row.querySelector('textarea');
        const select = row.querySelector('select');
        const prefixInput = row.querySelector('.sc-wiz-prefix');
        if (textarea) textarea.value = (t.options || []).join('\n');
        if (select) select.value = t.singleSelect ? 'singleSelect' : (t.join || 'lines');
        if (prefixInput) prefixInput.value = t.prefix || '';
        handledIds.add(id);
      });

      if (dropdownIds.length > 0) {
        const rowsInOrder = [];
        const unorderedRows = [];
        const allRows = Array.from(listContainer.querySelectorAll('tr'));

        const rowIdMap = new Map();
        allRows.forEach(row => {
          const isCustom = row.dataset.custom === 'true';
          if (isCustom) {
            const nameInput = row.querySelector('.sc-wiz-custom-name');
            const label = nameInput ? nameInput.value.trim() : '';
            const matchId = dropdownIds.find(id => {
              const t = subMap[id];
              return t && (t.label === label || t.name === label);
            });
            rowIdMap.set(row, matchId || null);
          } else {
            const catId = row.dataset.id;
            const cat = DEFAULT_CATEGORIES.find(c => c.id === catId);
            if (cat) {
              const expectedId = `wiz-${diagSlug}-${slugify(cat.name)}`;
              const altId = dropdownIds.find(id => {
                const t = subMap[id];
                return t && slugify(t.label || '') === slugify(cat.name);
              });
              rowIdMap.set(row, dropdownIds.includes(expectedId) ? expectedId : (altId || null));
            } else {
              rowIdMap.set(row, null);
            }
          }
        });

        const inDropdown = [];
        const notInDropdown = [];
        allRows.forEach(row => {
          const id = rowIdMap.get(row);
          if (id && dropdownIds.includes(id)) {
            inDropdown.push({ row, idx: dropdownIds.indexOf(id) });
          } else {
            notInDropdown.push(row);
          }
        });
        inDropdown.sort((a, b) => a.idx - b.idx);

        inDropdown.forEach(({ row }) => listContainer.appendChild(row));
        notInDropdown.forEach(row => listContainer.appendChild(row));
      }

      renderLinkedTemplates();
      $('sc-wiz-name').focus();
    }

    window.SmartChartWizard = {
      open() {
        $('sc-wiz-name').value = '';
        $('sc-wiz-triggers').value = '';
        const layoutSelect = $('sc-wiz-layout');
        if (layoutSelect) layoutSelect.value = 'divs';
        renderCategories();
        renderLinkedTemplates();
        customCategoryCounter = 0;
        $('sc-wiz-name').focus();
      },
      loadDiagnosis
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 50));
  } else {
    setTimeout(init, 50);
  }

})();
