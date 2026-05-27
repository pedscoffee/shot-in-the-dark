import { useState, useEffect } from 'react';
import { AppState, DropdownConfig, Template } from '../types';

export const DEFAULT_NOTE_TEMPLATE = `{input}\n\n{dropdown:Symptoms}\n\n{dropdown:Exams}\n\n{templates}`;

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'well-child',
    name: 'Well Child / Health Maintenance',
    triggers: ['well child check', 'health maintenance', 'well child', 'well visit'],
    content: 'All forms, labs, immunizations, and patient concerns reviewed and addressed appropriately. Screening questions, past medical history, past social history, medications, and growth chart reviewed. Age-appropriate anticipatory guidance reviewed and printed in AVS. Parent questions addressed.',
    priority: 1,
  },
  {
    id: 'illness',
    name: 'Illness',
    triggers: ['sick', 'illness', 'fever', 'cough', 'congestion', 'vomiting', 'diarrhea', 'rash', 'sore throat', 'pain'],
    content: 'Recommended supportive care with OTC medications as needed. Return precautions given including increasing pain, worsening fever, dehydration, new symptoms, prolonged symptoms, worsening symptoms, and other concerns. Caregiver expressed understanding and agreement with treatment plan.',
    priority: 2,
  },
  {
    id: 'injury',
    name: 'Injury',
    triggers: ['injury', 'pain', 'sprain', 'cut', 'fall', 'laceration'],
    content: 'Recommended supportive care with Tylenol, Motrin, rest, ice, compression, elevation, and gradual return to activity as appropriate. Return precautions given including increasing pain, swelling, or failure to improve.',
    priority: 3,
  },
  {
    id: 'ear-infection',
    name: 'Ear Infection',
    triggers: ['ear infection', 'otitis', 'ear pain'],
    content: 'Risk of untreated otitis media includes persistent pain and fever, hearing loss, and mastoiditis.',
    priority: 4,
  },
  {
    id: 'strep',
    name: 'Strep Test',
    triggers: ['strep', 'strep test', 'pharyngitis', 'sore throat'],
    content: 'Risk of untreated strep throat includes rheumatic fever and peritonsillar abscess. This problem is moderate risk due to pending lab results which may necessitate further pharmacologic management.',
    priority: 5,
  },
  {
    id: 'dehydration',
    name: 'Dehydration Risk',
    triggers: ['dehydration', 'vomiting', 'diarrhea', 'decreased urination', 'not drinking'],
    content: 'Patient is at risk for dehydration, which would warrant emergency room care or admission for IV fluids.',
    priority: 6,
  },
  {
    id: 'breathing',
    name: 'Respiratory Distress',
    triggers: ['trouble breathing', 'respiratory distress', 'wheezing', 'retractions', 'fast breathing'],
    content: 'Patient is at risk for worsening respiratory distress and clinical deterioration, which would need emergency room care or hospital admission.',
    priority: 7,
  },
  {
    id: 'pcmh',
    name: 'PCMH Reminder',
    triggers: ['adhd', 'weight', 'obesity', 'strep throat', 'strep'],
    content: 'PCMH Reminder',
    priority: 8,
  }
];

export const DEFAULT_DROPDOWNS: DropdownConfig[] = [
  {
    id: 'dd-symptoms',
    name: 'Symptoms',
    options: ['fever', 'cough', 'chills', 'nausea', 'vomiting', 'diarrhea', 'ear pain', 'rash'],
    joinStyle: 'comma_and',
    template: 'Patient reports {selections}.'
  },
  {
    id: 'dd-exams',
    name: 'Exams',
    options: ['well-appearing', 'alert', 'active', 'in mild distress', 'toxic appearing', 'tired'],
    joinStyle: 'comma_and',
    template: 'On physical exam, patient is {selections}.'
  }
];

export const DEFAULT_STATE: AppState = {
  noteTemplate: DEFAULT_NOTE_TEMPLATE,
  templates: DEFAULT_TEMPLATES,
  dropdowns: DEFAULT_DROPDOWNS,
  behavior: {
    autoCopyEnabled: true,
    autoCopyDelay: 1500,
    autoClearDelay: 30000,
    plainTextCopy: false,
    sourceLabels: false,
  }
};

const STORAGE_KEY = 'smartchart_state_v3';

export function useAppStorage() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_STATE, ...parsed };
      }
    } catch {}
    return DEFAULT_STATE;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const updateState = (updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const updateBehavior = (updates: Partial<AppState['behavior']>) => {
    setState(prev => ({ ...prev, behavior: { ...prev.behavior, ...updates } }));
  };

  return { state, updateState, updateBehavior };
}
