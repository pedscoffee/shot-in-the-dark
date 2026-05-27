import { AppState, DropdownConfig, Template } from '../types';
import { addDays, format } from 'date-fns';

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchTemplates(input: string, templates: Template[]): Template[] {
  if (!input || !input.trim()) return [];
  return templates
    .filter(t => {
      if (!t.triggers || !Array.isArray(t.triggers)) return false;
      return t.triggers.some(trigger => {
        const escapedTrigger = escapeRegExp(trigger);
        const regex = new RegExp(`(^|\\W)${escapedTrigger}(\\W|$)`, 'i');
        return regex.test(input);
      });
    })
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

function processDates(text: string): string {
  const now = new Date();
  
  let out = text.replace(/\{date\}/gi, format(now, 'MM/dd/yyyy'));
  out = out.replace(/\{time\}/gi, format(now, 'h:mm a'));
  out = out.replace(/\{tomorrow\}/gi, format(addDays(now, 1), 'MM/dd/yyyy'));
  
  // {in_3_days}
  out = out.replace(/\{in_(\d+)_days?\}/gi, (match, daysStr) => {
    const days = parseInt(daysStr, 10);
    if (isNaN(days)) return match;
    return format(addDays(now, days), 'MM/dd/yyyy');
  });
  
  return out;
}

function formatList(items: string[], joinStyle: string): string {
  if (!items || items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) {
    if (joinStyle === 'comma_and') return `${items[0]} and ${items[1]}`;
    if (joinStyle === 'comma_or') return `${items[0]} or ${items[1]}`;
    if (joinStyle === 'comma_nor') return `${items[0]} nor ${items[1]}`;
  }
  
  if (joinStyle === 'newline') return items.join('\n');
  if (joinStyle === 'comma') return items.join(', ');
  
  const last = items.pop();
  let conjunction = 'and';
  if (joinStyle === 'comma_or') conjunction = 'or';
  if (joinStyle === 'comma_nor') conjunction = 'nor';
  
  return `${items.join(', ')}, ${conjunction} ${last}`;
}

export function renderNote(
  input: string,
  matchedTemplates: Template[],
  state: AppState,
  dropdownSelections: Record<string, string[]>
): string {
  const { noteTemplate, dropdowns, behavior } = state;
  
  const templatesStr = matchedTemplates.map(t => {
    const label = behavior.sourceLabels ? `**[${t.name}]**\n` : '';
    return label + t.content;
  }).join('\n\n');

  let out = noteTemplate
    .replace(/\{input\}/g, input)
    .replace(/\{templates\}/g, templatesStr)
    .replace(/\{bullet\}/gi, '- ');

  // Replace static blocks {static:text}
  out = out.replace(/\{static:([^}]*)\}/g, (_, content) => {
    return content.replace(/\\n/g, '\n');
  });

  out = processDates(out);

  // Replace {dropdown:DropdownName}
  const dropdownRegex = /\{dropdown:([^}]+)\}/gi;
  out = out.replace(dropdownRegex, (match, ddName) => {
    const config = dropdowns.find(d => d.name.toLowerCase() === ddName.toLowerCase().trim());
    if (!config) return match; // Not found

    const selections = dropdownSelections[config.id] || [];
    if (selections.length === 0) return ''; // Hide if no selections
    
    const formattedList = formatList([...selections], config.joinStyle);
    
    // Inject the list into the follow up template
    let block = config.template || '{selections}';
    block = block.replace(/\{selections\}/gi, formattedList);
    return block;
  });

  // Also replace any remaining literal {dropdowns} macro with ALL dropdown blocks sequentially if the user prefers that
  // Or just leave them isolated.
  
  // Clean up excessive newlines
  out = out
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return out;
}

export function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, '')          // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')  // bold
    .replace(/\*(.+?)\*/g, '$1')        // italic
    .replace(/~~(.+?)~~/g, '$1')          // strikethrough
    .replace(/`(.+?)`/g, '$1')            // inline code
    .replace(/^\s*[-*+]\s+/gm, '• ')   // unordered lists
    .replace(/^\s*\d+\.\s+/gm, '')    // ordered lists
    .replace(/^>\s+/gm, '')              // blockquotes
    .replace(/!\[.*?\]\(.*?\)/g, '')  // images
    .replace(/\[(.+?)\]\(.*?\)/g, '$1') // links
    .replace(/_{1,2}(.+?)_{1,2}/g, '$1') // underscore bold/italic
    .trim();
}
