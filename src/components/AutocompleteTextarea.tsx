import { useRef, useState, useId } from 'react';
import { Textarea } from './ui/textarea';
import { cn } from '../lib/utils';

interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  suggestions: string[];
  onValueChange?: (value: string) => void;
}

export function AutocompleteTextarea({
  value,
  onChange,
  suggestions,
  onValueChange,
  className,
  ...rest
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const listId = useId();
  const ref = useRef<HTMLTextAreaElement>(null);

  // Filter suggestions: must contain every word typed (case-insensitive)
  const words = value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = words.length === 0
    ? []
    : suggestions.filter(s => {
        const lower = s.toLowerCase();
        return words.every(w => lower.includes(w)) && s !== value;
      }).slice(0, 6);

  const pick = (s: string) => {
    const syntheticEvent = {
      target: { value: s },
    } as React.ChangeEvent<HTMLTextAreaElement>;
    onChange(syntheticEvent);
    onValueChange?.(s);
    setOpen(false);
    setActiveIdx(-1);
    ref.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      pick(filtered[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIdx(-1);
    }
  };

  const showDropdown = open && filtered.length > 0;

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        value={value}
        onChange={e => { onChange(e); setOpen(true); setActiveIdx(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        aria-autocomplete="list"
        aria-controls={showDropdown ? listId : undefined}
        aria-activedescendant={activeIdx >= 0 ? `${listId}-${activeIdx}` : undefined}
        className={className}
        {...rest}
      />

      {showDropdown && (
        <ul
          id={listId}
          role="listbox"
          className={cn(
            'absolute z-50 left-0 right-0 mt-1 rounded-lg border border-border bg-popover shadow-lg',
            'max-h-52 overflow-y-auto py-1',
          )}
        >
          {filtered.map((s, i) => (
            <li
              key={i}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={activeIdx === i}
              onMouseDown={() => pick(s)}
              className={cn(
                'px-3 py-2 text-sm cursor-pointer select-none truncate transition-colors',
                activeIdx === i
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-muted',
              )}
              title={s}
            >
              {s}
            </li>
          ))}
          <li className="px-3 py-1 text-[10px] text-muted-foreground border-t border-border/50 mt-1 select-none">
            ↑↓ navegar · Enter selecionar · Esc fechar
          </li>
        </ul>
      )}
    </div>
  );
}
