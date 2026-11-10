import { useEffect, useRef, useState } from 'react';
import type { LabelGroup } from '@/types';
import { findLabel } from '@/utils/labels';

interface Props {
  /** Selected label id, or '' for any label */
  value: string;
  groups: LabelGroup[];
  onChange: (labelId: string) => void;
}

const selectBgImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%238b949e' d='M1 1l4 4 4-4'/%3E%3C/svg%3E")`;

function TagIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
      <polyline points={dir === 'right' ? '9 18 15 12 9 6' : '15 18 9 12 15 6'} />
    </svg>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />;
}

/** Two-step dropdown: pick a label group, then a label in it. */
export default function LabelFilter({ value, groups, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = value ? findLabel(groups, value) : null;
  const activeGroup = groupId !== null ? groups.find((g) => g.id === groupId) : undefined;

  const toggle = () => {
    // Open on the selected label's group, or the group list when nothing is selected
    if (!open) setGroupId(selected ? selected.group.id : null);
    setOpen(!open);
  };

  const pick = (labelId: string) => {
    onChange(labelId);
    setOpen(false);
  };

  const itemCls = (active: boolean) =>
    `w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left cursor-pointer transition-colors ${
      active ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-hover'
    }`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="flex items-center gap-2 py-[7px] pl-2.5 pr-7 bg-bg-card border border-border-secondary rounded-md text-text-primary text-xs font-medium cursor-pointer outline-none transition-colors hover:border-text-muted focus:border-accent max-w-[180px] bg-no-repeat bg-[right_10px_center] bg-[length:10px_6px] w-full"
        style={{ backgroundImage: selectBgImage }}
      >
        {selected ? (
          <>
            <Dot color={selected.label.color} />
            <span className="truncate">
              {selected.group.id ? `${selected.group.name}: ` : ''}
              {selected.label.name}
            </span>
          </>
        ) : (
          <>
            <TagIcon />
            <span className="text-text-secondary truncate">Label</span>
          </>
        )}
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-bg-card border border-border-secondary rounded-lg shadow-xl z-50 min-w-[220px] max-h-[320px] overflow-y-auto py-1">
          {activeGroup ? (
            <>
              <button
                onClick={() => setGroupId(null)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted text-left cursor-pointer hover:bg-bg-hover border-b border-border-primary/60 mb-1"
              >
                <ChevronIcon dir="left" />
                {activeGroup.name}
              </button>
              {activeGroup.labels.map((l) => (
                <button key={l.id} onClick={() => pick(l.id)} className={itemCls(value === l.id)}>
                  <Dot color={l.color} />
                  {l.name}
                </button>
              ))}
            </>
          ) : (
            <>
              <button onClick={() => pick('')} className={itemCls(!value)}>
                <TagIcon />
                Any label
              </button>
              {groups.map((g) => (
                <button key={g.id || 'ungrouped'} onClick={() => setGroupId(g.id)} className={itemCls(selected?.group.id === g.id)}>
                  <span className="flex-1 truncate">{g.name}</span>
                  <span className="text-[10.5px] text-text-muted tabular-nums">{g.labels.length}</span>
                  <ChevronIcon dir="right" />
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
