import { useEffect, useMemo, useRef, useState } from 'react';
import type { Milestone, Task } from '@/types';
import {
  changeGroupKey,
  changeKey,
  confirmDiscardDraft,
  conflictFor,
  describeChange,
  groupTitle,
  type Draft,
  type DraftChange,
} from '@/hooks/draft';

interface Props {
  draft: Draft;
  /** Linear's data, used to spot conflicts */
  officialTasks: Task[];
  officialUnscheduledTasks: Task[];
  officialMilestones: Milestone[];
  onApply: (keys: string[]) => Promise<unknown>;
  onRevert: (keys: string[]) => void;
  onDiscard: () => void;
}

interface Group {
  key: string;
  title: string;
  changes: DraftChange[];
  conflicts: string[];
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
        checked ? 'bg-accent border-accent text-white' : 'border-border-secondary bg-bg-card'
      }`}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  );
}

/** Banner shown while drafting, with a review panel to apply changes to Linear. */
export default function DraftBar({
  draft,
  officialTasks,
  officialUnscheduledTasks,
  officialMilestones,
  onApply,
  onRevert,
  onDiscard,
}: Props) {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  // Rows the user un-ticked. Everything else is applied, so the usual case is one click.
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const groups: Group[] = useMemo(() => {
    const map = new Map<string, Group>();
    for (const c of Object.values(draft.changes)) {
      const key = changeGroupKey(c);
      let g = map.get(key);
      if (!g) {
        g = { key, title: groupTitle(c), changes: [], conflicts: [] };
        map.set(key, g);
      }
      g.changes.push(c);
      const conflict = conflictFor(c, officialTasks, officialUnscheduledTasks, officialMilestones);
      if (conflict) g.conflicts.push(conflict);
    }
    // Show start before due within a task
    const rank: Record<string, number> = { start: 0, due: 1, status: 2 };
    for (const g of map.values()) g.changes.sort((a, b) => (rank[a.kind] ?? 3) - (rank[b.kind] ?? 3));
    return [...map.values()];
  }, [draft.changes, officialTasks, officialUnscheduledTasks, officialMilestones]);

  // Rows that conflict with Linear start un-ticked, so they're only applied on purpose
  const isSelected = (g: Group) => (g.conflicts.length > 0 ? skipped.has(`force:${g.key}`) : !skipped.has(g.key));
  const toggle = (g: Group) => {
    const k = g.conflicts.length > 0 ? `force:${g.key}` : g.key;
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const selectedGroups = groups.filter(isSelected);
  const selectedKeys = selectedGroups.flatMap((g) => g.changes.map(changeKey));
  // One "change" per task, milestone or dependency (moving a bar edits both start and due)
  const changeCount = groups.length;
  const orderChanged = !!draft.order;

  const apply = async () => {
    setApplying(true);
    try {
      await onApply(selectedKeys);
      setSkipped(new Set());
      setOpen(false);
    } finally {
      setApplying(false);
    }
  };

  const discard = () => {
    if (confirmDiscardDraft(draft)) onDiscard();
  };

  return (
    <div className="shrink-0 border-b border-amber-400/40 bg-amber-400/10 print:hidden relative z-30" ref={ref}>
      <div className="h-10 flex items-center gap-3 px-4 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
          <PencilIcon />
          Draft Mode
        </span>
        <span className="text-text-secondary truncate">
          Changes stay on this screen and aren't sent to Linear until you apply them. Dashed outlines show the
          official dates.
        </span>
        <div className="flex-1" />
        <span className="text-text-muted tabular-nums shrink-0">
          {changeCount} change{changeCount === 1 ? '' : 's'}
          {orderChanged ? ' · rows reordered' : ''}
        </span>
        <button
          onClick={discard}
          className="h-7 px-2.5 rounded-md text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer shrink-0"
        >
          {changeCount === 0 && !orderChanged ? 'Exit draft' : 'Discard draft'}
        </button>
        {changeCount > 0 && (
          <button
            onClick={() => setOpen(!open)}
            className="h-7 px-3 rounded-md text-[11px] font-semibold bg-accent text-white hover:brightness-110 cursor-pointer shrink-0"
          >
            Review & apply
          </button>
        )}
      </div>

      {open && (
        <div className="absolute right-4 top-full mt-1 w-[440px] max-w-[calc(100vw-32px)] bg-bg-card border border-border-secondary rounded-lg shadow-xl z-50 flex flex-col max-h-[70vh]">
          <div className="px-4 py-3 border-b border-border-primary text-xs text-text-secondary">
            Ticked changes are applied to Linear. Click a row to skip it. Skipped changes stay in your draft.
          </div>
          <div className="overflow-y-auto py-1">
            {groups.map((g) => {
              const selected = isSelected(g);
              return (
                <div
                  key={g.key}
                  onClick={() => toggle(g)}
                  className={`group flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-bg-hover ${selected ? '' : 'opacity-60'}`}
                >
                  <CheckBox checked={selected} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text-primary truncate">{g.title}</div>
                    {g.changes.map((c) => (
                      <div key={changeKey(c)} className="text-[11px] text-text-secondary">
                        {describeChange(c)}
                      </div>
                    ))}
                    {g.conflicts.map((msg) => (
                      <div key={msg} className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                        ⚠ {msg}. Applying overwrites it.
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRevert(g.changes.map(changeKey));
                    }}
                    title="Undo this change in the draft"
                    className="opacity-0 group-hover:opacity-100 text-[11px] text-text-muted hover:text-text-primary cursor-pointer px-1.5 py-0.5 rounded hover:bg-bg-primary shrink-0"
                  >
                    Revert
                  </button>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-3 border-t border-border-primary flex items-center gap-2">
            <span className="text-[11px] text-text-muted">
              {selectedGroups.length} of {groups.length} selected
            </span>
            <div className="flex-1" />
            <button
              onClick={apply}
              disabled={applying || selectedKeys.length === 0}
              className="h-8 px-3 rounded-md text-xs font-semibold bg-accent text-white hover:brightness-110 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applying ? 'Applying…' : `Apply ${selectedGroups.length} change${selectedGroups.length === 1 ? '' : 's'} to Linear`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
