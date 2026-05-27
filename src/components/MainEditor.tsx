import { useState, useEffect, useRef } from 'react';
import { AppState, Template, DropdownConfig } from '../types';
import { matchTemplates, renderNote, stripMarkdown } from '../lib/formatter';
import ReactMarkdown from 'react-markdown';
import { marked } from 'marked';
import { Maximize2, Minimize2, Copy, Settings, UserPlus, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { DropdownSelector } from './DropdownSelector';

interface Props {
  state: AppState;
  openSettings: () => void;
}

export function MainEditor({ state, openSettings }: Props) {
  const [input, setInput] = useState('');
  const [dropdownSelections, setDropdownSelections] = useState<Record<string, string[]>>({});
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'source'>('preview');
  
  const [matched, setMatched] = useState<Template[]>([]);
  const [renderedNote, setRenderedNote] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'pending' | 'copied' | 'error'>('idle');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const autoCopyTimer = useRef<NodeJS.Timeout | null>(null);
  const autoClearTimer = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const processCopy = async (noteHtml: string, forceText = false) => {
    if (!noteHtml.trim()) return;
    try {
      const usePlainText = forceText || state.behavior.plainTextCopy;
      const textToCopy = usePlainText ? stripMarkdown(noteHtml) : noteHtml;

      if (!usePlainText && navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
        const htmlToCopy = await marked.parse(noteHtml, { async: true });
        
        const typeText = 'text/plain';
        const typeHtml = 'text/html';
        const blobText = new Blob([textToCopy], { type: typeText });
        const blobHtml = new Blob([htmlToCopy], { type: typeHtml });

        const data = [
          new ClipboardItem({
            [typeText]: blobText,
            [typeHtml]: blobHtml
          })
        ];

        await navigator.clipboard.write(data);
        setCopyStatus('copied');
        showToast('✓ Copied to clipboard');
        setTimeout(() => setCopyStatus('idle'), 2000);
        return;
      }
      
      await navigator.clipboard.writeText(textToCopy);
      setCopyStatus('copied');
      showToast('✓ Copied to clipboard');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      showToast('Failed to copy');
      setCopyStatus('error');
    }
  };

  useEffect(() => {
    // Process render
    if (!input.trim() && Object.values(dropdownSelections).every(arr => arr.length === 0)) {
      setMatched([]);
      setRenderedNote('');
      setCopyStatus('idle');
      if (autoCopyTimer.current) clearTimeout(autoCopyTimer.current);
      return;
    }

    const matchedTpls = matchTemplates(input, state.templates);
    setMatched(matchedTpls);
    
    const finalNote = renderNote(input, matchedTpls, state, dropdownSelections);
    setRenderedNote(finalNote);

    // Auto copy logic
    if (autoCopyTimer.current) clearTimeout(autoCopyTimer.current);
    if (state.behavior.autoCopyEnabled && finalNote.trim()) {
      setCopyStatus('pending');
      autoCopyTimer.current = setTimeout(() => {
        processCopy(finalNote);
      }, state.behavior.autoCopyDelay);
    } else {
      setCopyStatus('idle');
    }

    // Auto clear logic
    if (autoClearTimer.current) clearTimeout(autoClearTimer.current);
    if (input.trim() || Object.values(dropdownSelections).some(arr => arr.length > 0)) {
       autoClearTimer.current = setTimeout(() => {
         setInput('');
         setDropdownSelections({});
         showToast('Input cleared (inactivity)');
       }, state.behavior.autoClearDelay);
    }

    return () => {
      if (autoCopyTimer.current) clearTimeout(autoCopyTimer.current);
      if (autoClearTimer.current) clearTimeout(autoClearTimer.current);
    };
  }, [input, dropdownSelections, state]);

  // Command Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        processCopy(renderedNote);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setInput('');
        setDropdownSelections({});
        showToast('New patient - Input cleared');
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
         e.preventDefault();
         setIsFocusMode(v => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [renderedNote]);

  const handleDropdownChange = (id: string, opts: string[]) => {
    setDropdownSelections(prev => ({ ...prev, [id]: opts }));
  };

  const handleClear = () => {
    setInput('');
    setDropdownSelections({});
  };

  return (
    <div className="flex flex-col h-screen bg-[#0b0e14] text-[#e8edf5] font-sans">
      
      {/* Header */}
      <header className="flex items-center justify-between h-12 px-4 bg-[#1a1f2c] border-b border-[#272d3d] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[#22c55e] text-lg font-bold leading-none">✚</span>
          <span className="text-[13px] font-bold tracking-widest uppercase">SmartChart</span>
          {!isFocusMode && matched.length > 0 && (
            <span className="bg-[#22c55e]/10 border border-[#22c55e] text-[#22c55e] rounded-full text-[10px] font-mono px-2 py-0.5 ml-2">
              {matched.length} matched
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <button onClick={() => { setInput(''); setDropdownSelections({}); }} className="p-1.5 text-[#8a95aa] hover:text-[#e8edf5] hover:bg-[#1f2535] rounded" title="New Patient (Cmd+Shift+N)">
            <UserPlus size={16} />
          </button>
          <button onClick={() => processCopy(renderedNote)} className="p-1.5 text-[#8a95aa] hover:text-[#e8edf5] hover:bg-[#1f2535] rounded" title="Copy (Cmd+Shift+C)">
            <Copy size={16} />
          </button>
          <button onClick={() => setIsFocusMode(!isFocusMode)} className="p-1.5 text-[#8a95aa] hover:text-[#e8edf5] hover:bg-[#1f2535] rounded" title="Toggle Focus Mode (Cmd+Shift+F)">
             {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button onClick={openSettings} className="p-1.5 text-[#8a95aa] hover:text-[#e8edf5] hover:bg-[#1f2535] rounded" title="Settings">
            <Settings size={16} />
          </button>
        </div>
      </header>
      
      {/* Primary Layout Block */}
      <main className={cn(
        "flex-1 overflow-hidden transition-all duration-300",
        isFocusMode ? "flex justify-center p-6 bg-[#0b0e14]" : "grid grid-cols-1 md:grid-cols-2"
      )}>
        
        {/* Left Column (Input) */}
        <section className={cn(
          "flex flex-col border-r border-[#272d3d] h-full",
          isFocusMode ? "w-full max-w-2xl border-none shadow-2xl rounded-xl bg-[#141820]" : ""
        )}>
          {/* Editor Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#1a1f2c]/50">
            <span className="text-[10px] font-bold tracking-widest text-[#8a95aa] uppercase">Clinical One-Liner</span>
            <div className="flex items-center gap-2">
              {copyStatus === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" title="Auto-copy pending..." />}
              <button onClick={handleClear} className="text-[10px] font-bold tracking-widest uppercase text-[#8a95aa] hover:text-[#f26b5e]">Clear</button>
            </div>
          </div>
          
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className={cn(
              "w-full shrink-0 flex-1 bg-[#0e111a] text-[#e8edf5] font-mono text-[13px] leading-relaxed p-4 resize-none outline-none focus:ring-1 focus:ring-inset focus:ring-[#22c55e]",
              isFocusMode ? "rounded-b border-none" : "border-b border-[#272d3d]"
            )}
            placeholder="e.g. 2yo with fever and vomiting x1 day..."
            autoFocus
          />

          {!isFocusMode && (
            <div className="p-4 flex-1 overflow-y-auto bg-[#0b0e14]">
              {state.dropdowns.map(dd => (
                 <DropdownSelector 
                   key={dd.id} 
                   config={dd} 
                   selected={dropdownSelections[dd.id] || []}
                   onChange={(opts) => handleDropdownChange(dd.id, opts)}
                 />
              ))}
            </div>
          )}
        </section>

        {/* Right Column (Preview) */}
        {!isFocusMode && (
          <section className="flex flex-col h-full bg-[#141820]">
            <div className="flex items-center bg-[#1a1f2c] border-b border-[#272d3d] px-2 shrink-0 h-[33px]">
              <button 
                onClick={() => setActiveTab('preview')} 
                className={cn("px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase border-b-2 transition-colors", activeTab === 'preview' ? "text-[#22c55e] border-[#22c55e]" : "text-[#8a95aa] border-transparent")}
              >
                Preview
              </button>
              <button 
                onClick={() => setActiveTab('source')} 
                className={cn("px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase border-b-2 transition-colors", activeTab === 'source' ? "text-[#22c55e] border-[#22c55e]" : "text-[#8a95aa] border-transparent")}
              >
                Markdown
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {!renderedNote ? (
                 <div className="h-full flex flex-col items-center justify-center text-[#44505f] gap-3">
                   <div className="text-[12px] font-mono italic">Type a clinical one-liner to begin</div>
                   <div className="text-[11px]">Try: "fever", "vomiting", "rash"</div>
                 </div>
              ) : activeTab === 'preview' ? (
                <div className="prose prose-invert prose-sm max-w-none 
                                prose-headings:font-sans prose-headings:font-bold prose-headings:mt-3 prose-headings:mb-1
                                prose-p:font-mono prose-p:text-[12px] prose-p:leading-relaxed prose-p:mb-2
                                prose-ul:font-mono prose-ul:text-[12px]
                                prose-strong:text-white">
                  <ReactMarkdown>{renderedNote}</ReactMarkdown>
                </div>
              ) : (
                <pre className="font-mono text-[11px] leading-relaxed text-[#8a95aa] whitespace-pre-wrap break-words">
                  {renderedNote}
                </pre>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1a1f2c] border-l-4 border border-l-[#22c55e] border-[#272d3d] shadow-xl rounded py-2 px-4 animate-in fade-in slide-in-from-bottom-4">
          <span className="font-mono text-xs">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
