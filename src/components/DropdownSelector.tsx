import { DropdownConfig } from '../types';
import { cn } from '../lib/utils';
import { Plus } from 'lucide-react';

interface Props {
  config: DropdownConfig;
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function DropdownSelector({ config, selected, onChange }: Props) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(x => x !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  return (
    <div className="bg-[#141820] border border-[#272d3d] rounded-md p-3 mb-3">
      <div className="text-[10px] font-bold text-[#8a95aa] uppercase tracking-wider mb-2">
        {config.name}
      </div>
      <div className="flex flex-wrap gap-2">
        {config.options.map(opt => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-md border transition-colors relative flex items-center gap-1",
                isSelected 
                  ? "bg-[#22c55e]/10 border-[#22c55e] text-[#22c55e]" 
                  : "bg-transparent border-[#272d3d] text-[#8a95aa] hover:border-[#8a95aa] hover:text-[#e8edf5]"
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
