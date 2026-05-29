/**
 * SmartChart — app.js
 * Core state, template data, storage helpers, toast, and behavior config.
 * No longer handles textarea input, preview rendering, or clipboard —
 * those are now owned by editor.js (TipTap).
 *
 * This file runs as a classic script (before the ES module editor.js)
 * and exposes window.SmartChart for both settings.js and editor.js.
 */

'use strict';

/* ════════════════════════════════════════════════
   CONSTANTS & DEFAULTS
════════════════════════════════════════════════ */

const STORAGE_KEYS = {
  PANE_STATE:       'sc_pane_state',
  STARTER_TEMPLATE: 'sc_starter_template',
  TEMPLATES:        'sc_templates',
  BEHAVIOR:         'sc_behavior',
};

/**
 * Default starter template — shown in the editor for each new patient.
 * Users can customise or clear this in Settings → Starter Template.
 */
const DEFAULT_STARTER_TEMPLATE = '<p><strong>HPI:</strong></p><p></p><p><strong>Educated On:</strong></p><p></p>';

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
    options: [
      'Follow up as needed.',
      'Follow up in 2-3 days.',
      'Follow up in 2-4 weeks.',
      'Follow up in a month.',
      'Follow up in 3 months.',
      'Follow up in 3-6 months.',
      'Follow up in 1 year.',
      'Follow up at next regularly scheduled check up or as needed.',
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
};

const state = {
  starterTemplate: DEFAULT_STARTER_TEMPLATE,
  templates:       typeof structuredClone === 'function'
                     ? structuredClone(DEFAULT_TEMPLATES)
                     : JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
  behavior:        Object.assign({}, DEFAULT_BEHAVIOR),
  // editor is assigned by editor.js after TipTap mounts
  editor: null,
};

const $ = id => document.getElementById(id);

/* ════════════════════════════════════════════════
   STORAGE
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
   TOAST
════════════════════════════════════════════════ */

function showToast(message, type = 'success', duration = 2200) {
  const container = document.getElementById('sc-toast-container');
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
   LOAD PERSISTED STATE
════════════════════════════════════════════════ */

function loadState() {
  const savedTemplates = storage.get(STORAGE_KEYS.TEMPLATES);
  if (Array.isArray(savedTemplates) && savedTemplates.length > 0) {
    state.templates = savedTemplates;
  }

  const savedStarter = storage.get(STORAGE_KEYS.STARTER_TEMPLATE);
  // null means "not yet set" → use default; empty string means "intentionally blank"
  if (savedStarter !== null) {
    state.starterTemplate = savedStarter;
  }

  const savedBehavior = storage.get(STORAGE_KEYS.BEHAVIOR);
  if (savedBehavior && typeof savedBehavior === 'object') {
    state.behavior = Object.assign({}, DEFAULT_BEHAVIOR, savedBehavior);
  }
}

/* ════════════════════════════════════════════════
   STUB — updatePreview is a no-op in the TipTap model.
   settings.js calls this; editor.js overwrites it.
════════════════════════════════════════════════ */
function updatePreview() {}

/* ════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════ */

function init() {
  loadState();
}

document.addEventListener('DOMContentLoaded', init);

/* ════════════════════════════════════════════════
   PUBLIC API (consumed by settings.js & editor.js)
════════════════════════════════════════════════ */

window.SmartChart = {
  state,
  storage,
  STORAGE_KEYS,
  DEFAULT_STARTER_TEMPLATE,
  DEFAULT_TEMPLATES,
  DEFAULT_BEHAVIOR,
  showToast,
  updatePreview,
  // editor, copyNote assigned by editor.js after mount
};
