import { useState } from 'react';
import { AppState, DropdownConfig, Template, JoinStyle } from '../types';
import { X, Plus, Trash2, Edit2, Save } from 'lucide-react';
import { cn } from '../lib/utils';
import { DEFAULT_NOTE_TEMPLATE, DEFAULT_TEMPLATES, DEFAULT_DROPDOWNS, DEFAULT_STATE } from '../hooks/useAppStorage';

interface Props {
  state: AppState;
  updateState: (updates: Partial<AppState>) => void;
  updateBehavior: (updates: Partial<AppState['behavior']>) => void;
  onClose: () => void;
}

export function SettingsModal({ state, updateState, updateBehavior, onClose }: Props) {
  const [tab, setTab] = useState<'note' | 'templates' | 'dropdowns' | 'behavior'>('note');

  // Local state for Note Template
  const [noteTplInput, setNoteTplInput] = useState(state.noteTemplate);

  const saveNoteTemplate = () => {
    updateState({ noteTemplate: noteTplInput });
  };

  const handleReset = () => {
    if(confirm('Are you sure you want to reset everything to defaults?')) {
      updateState(DEFAULT_STATE);
      setNoteTplInput(DEFAULT_STATE.noteTemplate);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#141820] border border-[#272d3d] w-full max-w-4xl h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#1a1f2c] border-b border-[#272d3d]">
          <h2 className="text-[13px] font-bold tracking-widest text-[#e8edf5] uppercase">Settings</h2>
          <button onClick={onClose} className="p-1 text-[#8a95aa] hover:text-white rounded hover:bg-[#1f2535]">
            <X size={18} />
          </button>
        </div>

        {/* Tabs Row */}
        <div className="flex border-b border-[#272d3d] bg-[#1a1f2c] shrink-0">
          {[ 
            { id: 'note', label: 'Note Template' },
            { id: 'templates', label: 'Clinical Templates' },
            { id: 'dropdowns', label: 'Dropdowns' },
            { id: 'behavior', label: 'Behavior' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={cn(
                "px-5 py-3 text-[11px] font-bold tracking-wider uppercase border-b-2 transition-colors",
                tab === t.id ? "text-[#22c55e] border-[#22c55e]" : "text-[#8a95aa] border-transparent hover:text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0b0e14]">
          
          {tab === 'note' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <label className="block text-[10px] font-bold tracking-widest text-[#8a95aa] uppercase mb-2">Structure</label>
                <textarea
                  value={noteTplInput}
                  onChange={e => setNoteTplInput(e.target.value)}
                  className="w-full min-h-[200px] bg-[#0e111a] border border-[#272d3d] rounded p-3 text-xs font-mono text-[#e8edf5] focus:border-[#22c55e] outline-none"
                />
              </div>
              <div className="flex gap-3">
                 <button onClick={saveNoteTemplate} className="px-4 py-2 bg-[#22c55e] text-[#051208] text-[11px] font-bold uppercase tracking-wider rounded hover:brightness-110">Save Notes Template</button>
                 <button onClick={() => setNoteTplInput(DEFAULT_NOTE_TEMPLATE)} className="px-4 py-2 bg-transparent border border-[#272d3d] text-[#8a95aa] text-[11px] font-bold uppercase tracking-wider rounded">Reset Form</button>
              </div>

              <div className="bg-[#141820] border border-[#272d3d] p-4 rounded-md">
                <h3 className="text-xs font-bold text-white mb-2">Available Variables</h3>
                <div className="grid grid-cols-2 gap-4 text-[11px] font-mono text-[#8a95aa]">
                  <ul className="space-y-1">
                    <li><code className="text-[#22c55e]">{"{input}"}</code> : Typed one-liner</li>
                    <li><code className="text-[#22c55e]">{"{templates}"}</code> : Matched output</li>
                    <li><code className="text-[#22c55e]">{"{date}"}</code> : Today's Date</li>
                    <li><code className="text-[#22c55e]">{"{time}"}</code> : Current Time</li>
                  </ul>
                  <ul className="space-y-1">
                    <li><code className="text-[#22c55e]">{"{tomorrow}"}</code> : Tomorrow's Date</li>
                    <li><code className="text-[#22c55e]">{"{in_3_days}"}</code> : Date + 3 days</li>
                    <li><code className="text-[#22c55e]">{"{bullet}"}</code> : Inserts '•'</li>
                    <li><code className="text-[#22c55e]">{"{dropdown:NAME}"}</code> : Dropdown result</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {tab === 'templates' && (
            <TemplatesEditor state={state} updateState={updateState} />
          )}

          {tab === 'dropdowns' && (
            <DropdownsEditor state={state} updateState={updateState} />
          )}

          {tab === 'behavior' && (
            <div className="space-y-6 max-w-sm">
               <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={state.behavior.autoCopyEnabled} onChange={e => updateBehavior({ autoCopyEnabled: e.target.checked })} className="accent-[#22c55e] w-4 h-4"/>
                    <span className="text-sm">Auto-copy after typing pause</span>
                  </label>
               </div>
               <div>
                  <label className="block text-xs text-[#8a95aa] mb-2">Auto-copy Delay: {state.behavior.autoCopyDelay / 1000}s</label>
                  <input type="range" min="500" max="5000" step="500" value={state.behavior.autoCopyDelay} onChange={e => updateBehavior({ autoCopyDelay: Number(e.target.value) })} className="w-full accent-[#22c55e]"/>
               </div>
               <div>
                  <label className="block text-xs text-[#8a95aa] mb-2">Auto-clear Delay: {state.behavior.autoClearDelay / 1000}s</label>
                  <input type="range" min="10000" max="180000" step="10000" value={state.behavior.autoClearDelay} onChange={e => updateBehavior({ autoClearDelay: Number(e.target.value) })} className="w-full accent-[#22c55e]"/>
               </div>
               <hr className="border-[#272d3d]"/>
               <div>
                  <button onClick={handleReset} className="px-4 py-2 bg-transparent border border-[#f26b5e]/50 text-[#f26b5e] text-[11px] font-bold uppercase tracking-wider rounded hover:bg-[#f26b5e]/10">Reset ALL to Defaults</button>
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// TEMPLATES EDITOR
// -------------------------------------------------------------
function TemplatesEditor({ state, updateState }: { state: AppState, updateState: any }) {
  const [editing, setEditing] = useState<Template | null>(null);

  const handleSave = (t: Template) => {
    if (editing?.id) {
       updateState({ templates: state.templates.map(x => x.id === editing.id ? t : x) });
    } else {
       updateState({ templates: [...state.templates, { ...t, id: `tpl_${Date.now()}` }] });
    }
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    if(confirm('Delete template?')) {
      updateState({ templates: state.templates.filter(x => x.id !== id) });
    }
  };

  if (editing) {
     return (
       <div className="max-w-2xl space-y-4">
         <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs mb-1 text-[#8a95aa]">Name</label>
              <input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} className="w-full bg-[#0e111a] border border-[#272d3d] p-2 rounded text-sm"/>
            </div>
            <div className="flex-1">
              <label className="block text-xs mb-1 text-[#8a95aa]">Triggers (comma separated)</label>
              <input value={editing.triggers.join(', ')} onChange={e => setEditing({...editing, triggers: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} className="w-full bg-[#0e111a] border border-[#272d3d] p-2 rounded text-sm"/>
            </div>
         </div>
         <div>
            <label className="block text-xs mb-1 text-[#8a95aa]">Markdown Content</label>
            <textarea value={editing.content} onChange={e => setEditing({...editing, content: e.target.value})} className="w-full h-32 bg-[#0e111a] border border-[#272d3d] p-2 rounded text-xs font-mono resize-none"/>
         </div>
         <div className="flex gap-2 pt-2">
            <button onClick={() => handleSave(editing)} className="px-4 py-1.5 bg-[#22c55e] text-black text-xs font-bold rounded">Save</button>
            <button onClick={() => setEditing(null)} className="px-4 py-1.5 border border-[#272d3d] text-xs font-bold rounded">Cancel</button>
         </div>
       </div>
     );
  }

  return (
    <div>
      <button onClick={() => setEditing({ id: '', name: '', triggers: [], content: '', priority: 50 })} className="mb-4 px-4 py-2 bg-[#22c55e] text-black text-xs font-bold rounded flex items-center gap-2"><Plus size={14}/> Add Template</button>
      <div className="space-y-2">
        {state.templates.map(t => (
          <div key={t.id} className="flex items-center justify-between p-3 bg-[#141820] border border-[#272d3d] rounded">
             <div>
               <div className="font-bold text-sm tracking-wide text-white">{t.name}</div>
               <div className="text-xs text-[#8a95aa] font-mono mt-1">{t.triggers.join(', ')}</div>
             </div>
             <div className="flex items-center gap-2">
                <button onClick={() => setEditing(t)} className="p-1.5 text-[#8a95aa] hover:text-white"><Edit2 size={14}/></button>
                <button onClick={() => handleDelete(t.id)} className="p-1.5 text-[#8a95aa] hover:text-[#f26b5e]"><Trash2 size={14}/></button>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// DROPDOWNS EDITOR
// -------------------------------------------------------------
function DropdownsEditor({ state, updateState }: { state: AppState, updateState: any }) {
  const [editing, setEditing] = useState<DropdownConfig | null>(null);

  const handleSave = (c: DropdownConfig) => {
    if (editing?.id) {
       updateState({ dropdowns: state.dropdowns.map(x => x.id === editing.id ? c : x) });
    } else {
       updateState({ dropdowns: [...state.dropdowns, { ...c, id: `dd_${Date.now()}` }] });
    }
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    if(confirm('Delete dropdown?')) {
      updateState({ dropdowns: state.dropdowns.filter(x => x.id !== id) });
    }
  };

  if (editing) {
     return (
       <div className="max-w-2xl space-y-4">
         <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs mb-1 text-[#8a95aa]">Name (used as {'{dropdown:NAME}'})</label>
              <input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} className="w-full bg-[#0e111a] border border-[#272d3d] p-2 rounded text-sm"/>
            </div>
            <div className="flex-1">
              <label className="block text-xs mb-1 text-[#8a95aa]">Join Style</label>
              <select value={editing.joinStyle} onChange={e => setEditing({...editing, joinStyle: e.target.value as JoinStyle})} className="w-full bg-[#0e111a] border border-[#272d3d] p-2 rounded text-sm outline-none">
                <option value="comma_and">Comma + And (A, B, and C)</option>
                <option value="comma_or">Comma + Or (A, B, or C)</option>
                <option value="comma_nor">Comma + Nor (A, B, nor C)</option>
                <option value="comma">Just Commas (A, B, C)</option>
                <option value="newline">Newlines</option>
              </select>
            </div>
         </div>
         <div>
            <label className="block text-xs mb-1 text-[#8a95aa]">Options (comma separated)</label>
            <input value={editing.options.join(', ')} onChange={e => setEditing({...editing, options: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} className="w-full bg-[#0e111a] border border-[#272d3d] p-2 rounded text-sm"/>
         </div>
         <div>
            <label className="block text-xs mb-1 text-[#8a95aa]">Follow-Up Statement (Wrapper)</label>
            <p className="text-[10px] text-[#44505f] mb-1">Use <code className="text-[#22c55e]">{"{selections}"}</code> to place the joined list. E.g. "Patient reports {"{selections}"}."</p>
            <input value={editing.template} onChange={e => setEditing({...editing, template: e.target.value})} className="w-full bg-[#0e111a] border border-[#272d3d] p-2 rounded text-sm"/>
         </div>
         <div className="flex gap-2 pt-2">
            <button onClick={() => handleSave(editing)} className="px-4 py-1.5 bg-[#22c55e] text-black text-xs font-bold rounded">Save</button>
            <button onClick={() => setEditing(null)} className="px-4 py-1.5 border border-[#272d3d] text-xs font-bold rounded">Cancel</button>
         </div>
       </div>
     );
  }

  return (
    <div>
      <button onClick={() => setEditing({ id: '', name: '', options: [], joinStyle: 'comma_and', template: 'Patient reports {selections}.' })} className="mb-4 px-4 py-2 bg-[#22c55e] text-black text-xs font-bold rounded flex items-center gap-2"><Plus size={14}/> Add Dropdown</button>
      <div className="space-y-2">
        {state.dropdowns.map(dd => (
          <div key={dd.id} className="flex items-center justify-between p-3 bg-[#141820] border border-[#272d3d] rounded">
             <div>
               <div className="font-bold text-sm tracking-wide text-white">{dd.name}</div>
               <div className="text-xs text-[#8a95aa] flex gap-3 mt-1">
                 <span>Options: {dd.options.length}</span>
                 <span className="text-[#44505f]">|</span>
                 <span>Template: <code className="font-mono text-[#22c55e]">{dd.template}</code></span>
               </div>
             </div>
             <div className="flex items-center gap-2">
                <button onClick={() => setEditing(dd)} className="p-1.5 text-[#8a95aa] hover:text-white"><Edit2 size={14}/></button>
                <button onClick={() => handleDelete(dd.id)} className="p-1.5 text-[#8a95aa] hover:text-[#f26b5e]"><Trash2 size={14}/></button>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
