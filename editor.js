/**
 * SmartChart — editor.js
 * TipTap single-pane editor with:
 *  - SmartVariable inline Node View (interactive dropdown pills)
 *  - Fuzzy/exact trigger matching on every keystroke
 *  - Template expansion (text and dropdown types)
 *  - Dot expansions (.today, .now, .tomorrow, .2d, .1w)
 *  - EMR-safe copy-to-clipboard (strips all pill chrome)
 *  - Auto-copy and auto-clear timers (ephemeral, no note persistence)
 *
 * Loaded as <script type="module">. Reads shared state from window.SmartChart.
 */

import { Editor }          from '@tiptap/core';
import Document            from '@tiptap/extension-document';
import Paragraph           from '@tiptap/extension-paragraph';
import Text                from '@tiptap/extension-text';
import Bold                from '@tiptap/extension-bold';
import Italic              from '@tiptap/extension-italic';
import Strike              from '@tiptap/extension-strike';
import HardBreak           from '@tiptap/extension-hard-break';
import BulletList          from '@tiptap/extension-bullet-list';
import OrderedList         from '@tiptap/extension-ordered-list';
import ListItem            from '@tiptap/extension-list-item';
import Heading             from '@tiptap/extension-heading';
import History             from '@tiptap/extension-history';
import Placeholder         from '@tiptap/extension-placeholder';
import { Node, mergeAttributes, InputRule } from '@tiptap/core';

/* ════════════════════════════════════════════════
   UTILITIES
════════════════════════════════════════════════ */

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Compact Wagner-Fischer Levenshtein distance */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function formatDateOffset(days = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function formatTimeNow() {
  return new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/* ════════════════════════════════════════════════
   TEMPLATE MATCHING
════════════════════════════════════════════════ */

/**
 * Given the text content of the current paragraph and a list of templates,
 * returns the first matched template and the character range to delete.
 *
 * Strategy:
 *  1. Exact word-boundary match (any position in text)
 *  2. Levenshtein ≤ 1 on the last typed word (single-word triggers, ≥4 chars)
 */
function fuzzyMatchTrigger(text, templates) {
  const lower = text.toLowerCase().trimEnd();

  for (const tpl of templates) {
    for (const trigger of (tpl.triggers || [])) {
      if (!trigger) continue;
      const trig = trigger.toLowerCase().trim();
      if (!trig) continue;

      // Exact match — word boundaries
      const escaped = escapeRegExp(trig).replace(/\s+/g, '\\s+');
      const exactRe = new RegExp(`(?:^|\\s)(${escaped})(?=\\s|$)`, 'i');
      const exactM  = exactRe.exec(lower);
      if (exactM) {
        const matchStart = exactM.index + (exactM[0].length - exactM[1].length);
        const matchEnd   = matchStart + exactM[1].length;
        return { template: tpl, matchStart, matchEnd };
      }

      // Fuzzy: last word vs single-word trigger
      if (!trig.includes(' ') && trig.length >= 4) {
        const words    = lower.split(/\s+/);
        const lastWord = words[words.length - 1];
        if (lastWord.length >= 4 && levenshtein(lastWord, trig) <= 1) {
          const wordStart = text.lastIndexOf(lastWord);
          if (wordStart !== -1) {
            return { template: tpl, matchStart: wordStart, matchEnd: wordStart + lastWord.length };
          }
        }
      }
    }
  }
  return null;
}

/* ════════════════════════════════════════════════
   SMART VARIABLE NODE VIEW
════════════════════════════════════════════════ */

class SmartVariableView {
  constructor(node, getPos, editor) {
    this.node   = node;
    this.getPos = getPos;
    this.editor = editor;
    this._menuEl = null;

    // Pill DOM element — contenteditable=false so cursor skips over it
    this.dom = document.createElement('span');
    this.dom.className = 'sc-smart-var';
    this.dom.setAttribute('contenteditable', 'false');
    this.dom.setAttribute('data-template-id', node.attrs.templateId || '');

    this._render();

    this.dom.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._openMenu();
    });
  }

  _render() {
    const { label, selectedValue } = this.node.attrs;
    const display = selectedValue || label || 'Select…';
    this.dom.textContent = display;
    this.dom.setAttribute('data-selected-value', selectedValue || '');
    this.dom.classList.toggle('sc-smart-var--set',   !!selectedValue);
    this.dom.classList.toggle('sc-smart-var--empty', !selectedValue);
    this.dom.title = selectedValue
      ? `${label}: ${selectedValue} — click to change`
      : `${label}: click to select`;
  }

  _openMenu() {
    // Close any existing open menu
    document.querySelectorAll('.sc-smart-var-menu').forEach(m => m.remove());
    this._menuEl = null;

    const App = window.SmartChart;
    if (!App) return;
    const tpl = App.state.templates.find(t => t.id === this.node.attrs.templateId);
    if (!tpl) return;

    const menu = document.createElement('div');
    menu.className = 'sc-smart-var-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', `${tpl.label || tpl.name} options`);

    const options = (tpl.options || []).filter(o => o !== '' && o != null);
    options.forEach(opt => {
      const item = document.createElement('button');
      item.className = 'sc-smart-var-menu-item';
      item.type = 'button';
      item.textContent = opt;
      item.setAttribute('role', 'option');
      if (opt === this.node.attrs.selectedValue) {
        item.classList.add('sc-smart-var-menu-item--active');
        item.setAttribute('aria-selected', 'true');
      }
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._selectOption(opt);
      });
      menu.appendChild(item);
    });

    // Clear option
    if (this.node.attrs.selectedValue) {
      const sep = document.createElement('div');
      sep.className = 'sc-smart-var-menu-sep';
      menu.appendChild(sep);

      const clearBtn = document.createElement('button');
      clearBtn.className = 'sc-smart-var-menu-item sc-smart-var-menu-item--clear';
      clearBtn.type = 'button';
      clearBtn.textContent = '✕ Clear';
      clearBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._selectOption(null);
      });
      menu.appendChild(clearBtn);
    }

    document.body.appendChild(menu);
    this._positionMenu(menu);
    this._menuEl = menu;

    // Close on outside click (deferred so this event doesn't bubble and close it)
    const onOutside = (e) => {
      if (!menu.contains(e.target) && e.target !== this.dom) {
        menu.remove();
        this._menuEl = null;
        document.removeEventListener('mousedown', onOutside, true);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0);
  }

  _positionMenu(menu) {
    const rect = this.dom.getBoundingClientRect();
    menu.style.top  = `${rect.bottom + 6}px`;
    menu.style.left = `${rect.left}px`;
    // Clamp to viewport after paint
    requestAnimationFrame(() => {
      const mRect = menu.getBoundingClientRect();
      if (mRect.right > window.innerWidth - 8) {
        menu.style.left = `${Math.max(8, window.innerWidth - mRect.width - 8)}px`;
      }
      if (mRect.bottom > window.innerHeight - 8) {
        // Show above the pill instead
        menu.style.top = `${rect.top - mRect.height - 6}px`;
      }
    });
  }

  _selectOption(value) {
    const pos = this.getPos();
    if (typeof pos !== 'number') return;

    this.editor.chain().command(({ tr }) => {
      tr.setNodeMarkup(pos, null, { ...this.node.attrs, selectedValue: value });
      return true;
    }).run();

    if (this._menuEl) {
      this._menuEl.remove();
      this._menuEl = null;
    }

    // Notify app that the note changed so auto-copy can reschedule
    window.dispatchEvent(new CustomEvent('sc-editor-change'));
  }

  update(node) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this._render();
    return true;
  }

  destroy() {
    if (this._menuEl) {
      this._menuEl.remove();
      this._menuEl = null;
    }
  }
}

/* ════════════════════════════════════════════════
   SMART VARIABLE TIPTAP EXTENSION
════════════════════════════════════════════════ */

const SmartVariable = Node.create({
  name: 'smartVariable',
  group: 'inline',
  inline: true,
  atom: true,       // indivisible — cursor jumps over, Backspace deletes whole node
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      templateId:    { default: null },
      label:         { default: '' },
      selectedValue: { default: null },
      singleSelect:  { default: true },
      join:          { default: 'lines' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-smart-variable]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    // This is what getHTML() produces — used by the clipboard sanitizer.
    // We emit the selectedValue as the text content so cleaning is trivial.
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-smart-variable': '',
        'data-template-id':    node.attrs.templateId,
        'data-selected-value': node.attrs.selectedValue || '',
        'data-label':          node.attrs.label || '',
      }),
      node.attrs.selectedValue || '',
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) =>
      new SmartVariableView(node, getPos, editor);
  },
});

/* ════════════════════════════════════════════════
   DOT EXPANSION INPUT RULES
════════════════════════════════════════════════ */

function makeDotExpansionRule(trigger, getReplacementFn) {
  // Match the trigger at end of input, preceded by start-of-line or whitespace
  const re = new RegExp(`(?:^|\\s)(\\${trigger})$`);
  return new InputRule({
    find: re,
    handler({ state, range, match }) {
      const replacement = getReplacementFn();
      const from = range.from + match[0].indexOf(match[1]);
      const to   = range.to;
      state.tr.insertText(replacement, from, to);
    },
  });
}

/* ════════════════════════════════════════════════
   TEMPLATE EXPANSION
════════════════════════════════════════════════ */

function expandTemplate(editor, template, matchStart, matchEnd, $from) {
  const paragraphStart = $from.start();
  const from = paragraphStart + matchStart;
  const to   = paragraphStart + matchEnd;

  if (template.type === 'dropdown') {
    editor.chain()
      .deleteRange({ from, to })
      .insertContentAt(from, {
        type: 'smartVariable',
        attrs: {
          templateId:    template.id,
          label:         template.label || template.name,
          selectedValue: null,
          singleSelect:  template.singleSelect ?? true,
          join:          template.join || 'lines',
        },
      })
      .run();
  } else {
    // Insert rich HTML content from the template
    editor.chain()
      .deleteRange({ from, to })
      .insertContentAt(from, template.content || '')
      .run();
  }
}

/* ════════════════════════════════════════════════
   HTML → PLAIN TEXT (for clipboard)
════════════════════════════════════════════════ */

function htmlToPlainText(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
  div.querySelectorAll('li').forEach(el => {
    el.insertAdjacentText('beforebegin', '- ');
    el.insertAdjacentText('afterend', '\n');
  });
  div.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, hr').forEach(el => {
    el.insertAdjacentText('afterend', '\n');
  });
  return (div.innerText || div.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

/* ════════════════════════════════════════════════
   COPY NOTE — strips all interactive chrome
════════════════════════════════════════════════ */

async function copyNote(editor, forcePlain = false) {
  // 1. Get TipTap's serialized HTML (calls renderHTML on each node)
  const rawHtml = editor.getHTML();

  // 2. Parse into a temporary tree
  const wrap = document.createElement('div');
  wrap.innerHTML = rawHtml;

  // 3. Replace SmartVariable spans with their selectedValue (or remove if unset)
  wrap.querySelectorAll('span[data-smart-variable]').forEach(el => {
    const value = el.getAttribute('data-selected-value');
    if (value) {
      el.replaceWith(document.createTextNode(value));
    } else {
      el.remove();
    }
  });

  // 4. Strip all data-* attributes
  wrap.querySelectorAll('*').forEach(el => {
    [...el.attributes]
      .filter(a => a.name.startsWith('data-'))
      .forEach(a => el.removeAttribute(a.name));
  });

  const cleanHtml  = wrap.innerHTML.trim();
  const plainText  = htmlToPlainText(cleanHtml);
  const App        = window.SmartChart;
  const usePlain   = forcePlain || (App?.state?.behavior?.plainTextCopy);

  if (!cleanHtml) return false;

  if (!usePlain && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html':  new Blob([`<div>${cleanHtml}</div>`], { type: 'text/html' }),
          'text/plain': new Blob([plainText],                  { type: 'text/plain' }),
        }),
      ]);
      return true;
    } catch {}
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(plainText);
      return true;
    } catch {}
  }

  // Legacy fallback
  try {
    const ta = document.createElement('textarea');
    ta.value = plainText;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

/* ════════════════════════════════════════════════
   EDITOR CONTENT CHECK (for auto-copy gate)
════════════════════════════════════════════════ */

function editorHasMeaningfulContent(editor) {
  const text = editor.getText();
  if (text.trim()) return true;
  // Also check for SmartVariable nodes even if no text surrounds them
  let hasVar = false;
  editor.state.doc.descendants(node => {
    if (node.type.name === 'smartVariable') { hasVar = true; return false; }
  });
  return hasVar;
}

/* ════════════════════════════════════════════════
   MAIN INIT
════════════════════════════════════════════════ */

function initEditor() {
  const App = window.SmartChart;
  if (!App) {
    console.error('[SmartChart] editor.js: app.js not loaded yet');
    return;
  }

  const { state, storage, STORAGE_KEYS, showToast } = App;

  const editorEl = document.getElementById('sc-editor');
  if (!editorEl) {
    console.error('[SmartChart] editor.js: #sc-editor not found');
    return;
  }

  /* ── Timers ── */
  let autoCopyTimer  = null;
  let autoClearTimer = null;

  function cancelAutoCopy() {
    clearTimeout(autoCopyTimer);
    const dot = document.getElementById('sc-autocopy-indicator');
    if (dot) dot.classList.add('hidden');
  }

  function scheduleAutoCopy(editor) {
    cancelAutoCopy();
    if (!state.behavior.autoCopyEnabled) return;
    if (!editorHasMeaningfulContent(editor)) return;
    const dot = document.getElementById('sc-autocopy-indicator');
    if (dot) dot.classList.remove('hidden');
    autoCopyTimer = setTimeout(async () => {
      if (dot) dot.classList.add('hidden');
      if (!editorHasMeaningfulContent(editor)) return;
      const ok = await copyNote(editor);
      if (ok) showToast('✓ Copied to clipboard', 'success');
    }, state.behavior.autoCopyDelay);
  }

  function scheduleAutoClear(editor) {
    clearTimeout(autoClearTimer);
    if (editor.isEmpty) return;
    autoClearTimer = setTimeout(() => {
      editor.commands.clearContent(true);
      showToast('Note cleared (inactivity)', 'warning', 4000);
    }, state.behavior.autoClearDelay);
  }

  /* ── Build starter content from starterTemplate setting ── */
  function getStarterContent() {
    const tpl = state.starterTemplate;
    if (!tpl || !tpl.trim()) return '';
    return tpl;
  }

  /* ── Expansion guard — prevent re-triggering on programmatic inserts ── */
  let _expanding = false;

  /* ── TipTap Editor ── */
  const editor = new Editor({
    element: editorEl,
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Strike,
      HardBreak,
      BulletList,
      OrderedList,
      ListItem,
      Heading.configure({ levels: [1, 2, 3] }),
      History,
      Placeholder.configure({
        placeholder: 'Start typing your clinical note… (try "fever", "vomiting", "follow up")',
        emptyEditorClass: 'sc-editor-empty',
      }),
      SmartVariable,
    ],

    content: getStarterContent() || '',

    editorProps: {
      attributes: {
        class: 'sc-tiptap-editor',
        id: 'sc-tiptap-content',
        'aria-label': 'Clinical note editor',
        spellcheck: 'true',
      },
    },

    onUpdate({ editor, transaction }) {
      if (_expanding) return;
      if (!transaction.docChanged) return;

      // Dot expansions — check text before cursor in current paragraph
      const { $from } = editor.state.selection;
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

      const dotReplacements = {
        '.today':    () => formatDateOffset(0),
        '.now':      () => formatTimeNow(),
        '.tomorrow': () => formatDateOffset(1),
        '.2d':       () => formatDateOffset(2),
        '.1w':       () => formatDateOffset(7),
      };

      for (const [token, getFn] of Object.entries(dotReplacements)) {
        const re = new RegExp(`(?:^|\\s)(\\${token})$`, 'i');
        const m  = re.exec(textBefore);
        if (m) {
          const replacement = getFn();
          const endPos   = $from.pos;
          const startPos = endPos - m[1].length;
          _expanding = true;
          editor.chain()
            .deleteRange({ from: startPos, to: endPos })
            .insertContentAt(startPos, replacement)
            .run();
          _expanding = false;
          return;
        }
      }

      // Template trigger matching
      const match = fuzzyMatchTrigger(textBefore, state.templates);
      if (match) {
        _expanding = true;
        expandTemplate(editor, match.template, match.matchStart, match.matchEnd, $from);
        _expanding = false;
      }

      // Timers
      cancelAutoCopy();
      clearTimeout(autoClearTimer);
      scheduleAutoCopy(editor);
      scheduleAutoClear(editor);
    },

    onCreate({ editor }) {
      // If there's starter content, put cursor at end
      if (!editor.isEmpty) {
        editor.commands.focus('end');
      }
    },
  });

  /* ── SmartVariable changes also reschedule auto-copy ── */
  window.addEventListener('sc-editor-change', () => {
    cancelAutoCopy();
    scheduleAutoCopy(editor);
  });

  /* ── Wire up header buttons ── */

  // Copy button
  const copyBtn = document.getElementById('sc-copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      if (!editorHasMeaningfulContent(editor)) {
        showToast('Nothing to copy yet', 'warning');
        return;
      }
      cancelAutoCopy();
      const ok = await copyNote(editor);
      if (ok) showToast('✓ Copied to clipboard', 'success');
    });
  }

  // Plain text button
  const plainBtn = document.getElementById('sc-plaintext-btn');
  if (plainBtn) {
    plainBtn.addEventListener('click', async () => {
      if (!editorHasMeaningfulContent(editor)) {
        showToast('Nothing to copy yet', 'warning');
        return;
      }
      cancelAutoCopy();
      const ok = await copyNote(editor, true);
      if (ok) showToast('✓ Copied as plain text', 'success');
    });
  }

  // New patient button — clears the editor (ephemeral by design)
  const newPatientBtn = document.getElementById('sc-new-patient-btn');
  if (newPatientBtn) {
    newPatientBtn.addEventListener('click', () => {
      editor.commands.clearContent(true);
      cancelAutoCopy();
      clearTimeout(autoClearTimer);
      // Re-insert starter template if configured
      const starter = getStarterContent();
      if (starter) {
        editor.commands.setContent(starter);
        editor.commands.focus('end');
      } else {
        editor.commands.focus();
      }
      showToast('New patient — note cleared', 'success', 1800);
    });
  }

  // Focus mode / minimize button
  const minimizeBtn = document.getElementById('sc-minimize-btn');
  const pane        = document.getElementById('smartchart-pane');
  if (minimizeBtn && pane) {
    minimizeBtn.addEventListener('click', () => {
      const isFocused = pane.classList.toggle('sc-focus-mode');
      storage.set(STORAGE_KEYS.PANE_STATE, { focusMode: isFocused });
      // Update icon aria-label
      minimizeBtn.setAttribute('aria-label', isFocused ? 'Exit focus mode' : 'Focus mode');
      minimizeBtn.title = isFocused ? 'Exit focus mode' : 'Focus mode';
    });
    // Restore saved focus-mode state
    const savedPane = storage.get(STORAGE_KEYS.PANE_STATE);
    if (savedPane?.focusMode) pane.classList.add('sc-focus-mode');
  }

  // Settings button
  const settingsBtn   = document.getElementById('sc-settings-btn');
  const settingsPanel = document.getElementById('sc-settings');
  const settingsClose = document.getElementById('sc-settings-close');
  if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener('click', () => {
      // Exit focus mode when opening settings
      if (pane?.classList.contains('sc-focus-mode')) {
        pane.classList.remove('sc-focus-mode');
        storage.set(STORAGE_KEYS.PANE_STATE, { focusMode: false });
      }
      settingsPanel.classList.remove('hidden');
      if (window.SmartChartSettings) window.SmartChartSettings.open();
    });
  }
  if (settingsClose && settingsPanel) {
    settingsClose.addEventListener('click', () => {
      settingsPanel.classList.add('hidden');
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !settingsPanel?.classList.contains('hidden')) {
      settingsPanel.classList.add('hidden');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      if (editorHasMeaningfulContent(editor)) {
        cancelAutoCopy();
        copyNote(editor).then(ok => {
          if (ok) showToast('✓ Copied to clipboard', 'success');
        });
      } else {
        showToast('Nothing to copy yet', 'warning');
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      editor.commands.clearContent(true);
      cancelAutoCopy();
      clearTimeout(autoClearTimer);
      const starter = getStarterContent();
      if (starter) {
        editor.commands.setContent(starter);
        editor.commands.focus('end');
      } else {
        editor.commands.focus();
      }
      showToast('New patient — note cleared', 'success', 1800);
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      if (settingsPanel) {
        const isOpen = !settingsPanel.classList.contains('hidden');
        if (!isOpen && pane?.classList.contains('sc-focus-mode')) {
          pane.classList.remove('sc-focus-mode');
          storage.set(STORAGE_KEYS.PANE_STATE, { focusMode: false });
        }
        settingsPanel.classList.toggle('hidden', isOpen);
        if (!isOpen && window.SmartChartSettings) window.SmartChartSettings.open();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
      e.preventDefault();
      editor.commands.focus();
    }
  });

  // Expose editor on window for settings.js to call updatePreview
  window.SmartChart.editor       = editor;
  window.SmartChart.copyNote     = copyNote;
  window.SmartChart.updatePreview = () => {}; // no-op (no separate preview pane)

  // Focus editor on load
  setTimeout(() => editor.commands.focus(), 100);
}

/* Wait for app.js to register window.SmartChart */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initEditor, 50));
} else {
  setTimeout(initEditor, 50);
}
