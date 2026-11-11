// Draft mode: try out timeline changes without sending them to Linear.
//
// A draft is a set of changes laid over the data from Linear (the "official" timeline).
// Linear data keeps refreshing underneath; the chart shows official data + draft changes.
// Each change remembers the value it replaced (`from`), so we can show where a bar
// officially sits and spot when someone changed the same field in Linear meanwhile.

import type { Milestone, Task } from '@/types';

interface TaskRef {
  uuid: string;
  taskId: string; // display identifier, e.g. FSW-100
  title: string;
}

export type DraftChange =
  | (TaskRef & { kind: 'due'; from: string | null; to: string })
  | (TaskRef & { kind: 'start'; from: string | null; to: string })
  | (TaskRef & { kind: 'status'; from: string; to: string; toType: string; toStateId: string })
  | { kind: 'milestone'; id: string; name: string; from: string | null; to: string }
  | {
      kind: 'relation';
      add: boolean;
      sourceId: string;
      targetId: string;
      sourceUuid: string;
      targetUuid: string;
    };

export interface Draft {
  projectId: string;
  /** Keyed by changeKey() — editing the same field again replaces the change */
  changes: Record<string, DraftChange>;
  /** Row order while drafting (task uuids). null = unchanged from the saved order. */
  order: string[] | null;
}

export function changeKey(c: DraftChange): string {
  switch (c.kind) {
    case 'milestone':
      return `milestone:${c.id}`;
    case 'relation':
      return `relation:${c.sourceId}>${c.targetId}`;
    default:
      return `${c.kind}:${c.uuid}`;
  }
}

/** Key used to group changes in the review list: one row per task, milestone or dependency */
export function changeGroupKey(c: DraftChange): string {
  if (c.kind === 'milestone' || c.kind === 'relation') return changeKey(c);
  return `task:${c.uuid}`;
}

/** The value a task field has in Linear, in the form a change's `from` stores it */
export function officialDue(t: Task): string | null {
  return t.isDueImplicit ? null : t.due;
}

/**
 * Add a change to the draft. Replaces an earlier change to the same field, keeping its
 * original `from`. Drops the change when it puts things back the way Linear has them.
 */
export function addChange(draft: Draft, change: DraftChange): Draft {
  const key = changeKey(change);
  const changes = { ...draft.changes };
  const prev = changes[key];

  if (change.kind === 'relation') {
    // Adding a dependency you removed in this draft (or vice versa) cancels out
    if (prev && prev.kind === 'relation' && prev.add !== change.add) delete changes[key];
    else changes[key] = change;
    return { ...draft, changes };
  }

  const merged = prev && 'from' in prev ? ({ ...change, from: prev.from } as DraftChange) : change;
  if ('from' in merged && merged.from === merged.to) delete changes[key];
  else changes[key] = merged;
  return { ...draft, changes };
}

/** Apply draft changes on top of official data. Returns new arrays; inputs are not modified. */
export function applyDraft(
  draft: Draft | null,
  tasks: Task[],
  unscheduledTasks: Task[],
  milestones: Milestone[],
): { tasks: Task[]; unscheduledTasks: Task[]; milestones: Milestone[] } {
  if (!draft || Object.keys(draft.changes).length === 0) return { tasks, unscheduledTasks, milestones };

  const changes = Object.values(draft.changes);
  const edit = (t: Task): Task => {
    let next = t;
    for (const c of changes) {
      if (c.kind === 'due' && c.uuid === t.uuid) next = { ...next, due: c.to, isDueImplicit: undefined };
      else if (c.kind === 'start' && c.uuid === t.uuid) next = { ...next, startDate: c.to };
      else if (c.kind === 'status' && c.uuid === t.uuid) next = { ...next, status: c.to, statusType: c.toType };
      else if (c.kind === 'relation') {
        if (c.sourceId === t.id) {
          const blocks = next.blocks.filter((id) => id !== c.targetId);
          next = { ...next, blocks: c.add ? [...blocks, c.targetId] : blocks };
        } else if (c.targetId === t.id) {
          const blockedBy = next.blockedBy.filter((id) => id !== c.sourceId);
          next = { ...next, blockedBy: c.add ? [...blockedBy, c.sourceId] : blockedBy };
        }
      }
    }
    return next;
  };

  // An unscheduled task that got a due date in the draft moves onto the chart
  const scheduledInDraft = new Set(changes.filter((c) => c.kind === 'due').map((c) => (c as TaskRef).uuid));
  const nextTasks = tasks.map(edit);
  const nextUnscheduled: Task[] = [];
  for (const t of unscheduledTasks) {
    if (scheduledInDraft.has(t.uuid)) nextTasks.push(edit(t));
    else nextUnscheduled.push(edit(t));
  }

  const nextMilestones = milestones.map((m) => {
    const c = draft.changes[`milestone:${m.id}`];
    return c && c.kind === 'milestone' ? { ...m, targetDate: c.to } : m;
  });

  return { tasks: nextTasks, unscheduledTasks: nextUnscheduled, milestones: nextMilestones };
}

/**
 * Official start/due dates for tasks whose dates are changed in the draft,
 * so the chart can draw a ghost of where the bar sits in Linear.
 */
export function draftOriginalDates(
  draft: Draft | null,
  tasks: Task[],
  unscheduledTasks: Task[],
): Map<string, { startDate: string | null; due: string | null }> {
  const out = new Map<string, { startDate: string | null; due: string | null }>();
  if (!draft) return out;
  const byUuid = new Map([...tasks, ...unscheduledTasks].map((t) => [t.uuid, t]));
  for (const c of Object.values(draft.changes)) {
    if (c.kind !== 'due' && c.kind !== 'start') continue;
    const t = byUuid.get(c.uuid);
    if (!t) continue;
    // Keyed by display id, like baselines
    out.set(t.id, { startDate: t.startDate, due: officialDue(t) });
  }
  return out;
}

/**
 * Describe how Linear differs from what the draft assumed, if someone changed the same
 * field in Linear after it was drafted. Returns null when there's no conflict.
 */
export function conflictFor(c: DraftChange, tasks: Task[], unscheduledTasks: Task[], milestones: Milestone[]): string | null {
  if (c.kind === 'relation') return null; // re-adding or re-removing a dependency is harmless
  if (c.kind === 'milestone') {
    const m = milestones.find((x) => x.id === c.id);
    if (!m) return 'Milestone no longer in this project';
    return m.targetDate !== c.from ? `Now ${formatShort(m.targetDate)} in Linear` : null;
  }
  const t = [...tasks, ...unscheduledTasks].find((x) => x.uuid === c.uuid);
  if (!t) return 'Issue is no longer active in this project';
  if (c.kind === 'due') return officialDue(t) !== c.from ? `Due date is now ${formatShort(officialDue(t))} in Linear` : null;
  if (c.kind === 'start') return t.startDate !== c.from ? `Start date is now ${formatShort(t.startDate)} in Linear` : null;
  return t.status !== c.from ? `Status is now ${t.status} in Linear` : null;
}

export function formatShort(date: string | null): string {
  if (!date) return 'none';
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Human-readable description of one change, e.g. "Due Nov 13 → Nov 20" */
export function describeChange(c: DraftChange): string {
  switch (c.kind) {
    case 'due':
      return `Due ${formatShort(c.from)} → ${formatShort(c.to)}`;
    case 'start':
      return `Start ${formatShort(c.from)} → ${formatShort(c.to)}`;
    case 'status':
      return `Status ${c.from} → ${c.to}`;
    case 'milestone':
      return `Target ${formatShort(c.from)} → ${formatShort(c.to)}`;
    case 'relation':
      return c.add ? `${c.sourceId} now blocks ${c.targetId}` : `${c.sourceId} no longer blocks ${c.targetId}`;
  }
}

/** Title for a review-list row (a task, milestone or dependency) */
export function groupTitle(c: DraftChange): string {
  if (c.kind === 'milestone') return `◆ ${c.name}`;
  if (c.kind === 'relation') return 'Dependency';
  return `${c.taskId} ${c.title}`;
}

/** Number of changes as the user sees them: one per task, milestone or dependency */
export function draftChangeCount(draft: Draft): number {
  return new Set(Object.values(draft.changes).map(changeGroupKey)).size;
}

/**
 * Ask before throwing away a draft that has changes. Returns true when it's OK to discard.
 */
export function confirmDiscardDraft(draft: Draft): boolean {
  const n = draftChangeCount(draft);
  if (n === 0 && !draft.order) return true;
  const what = n > 0 ? `${n} draft change${n === 1 ? '' : 's'}` : 'your drafted row order';
  return window.confirm(`Discard ${what} and go back to Instant Sync Mode? Nothing was sent to Linear.`);
}

const storageKey = (projectId: string) => `gantt_draft_${projectId}`;

export function loadDraft(projectId: string): Draft | null {
  if (!projectId) return null;
  try {
    const d = JSON.parse(localStorage.getItem(storageKey(projectId)) || 'null');
    return d && typeof d === 'object' && d.changes ? (d as Draft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(projectId: string, draft: Draft | null) {
  if (!projectId) return;
  try {
    if (draft) localStorage.setItem(storageKey(projectId), JSON.stringify(draft));
    else localStorage.removeItem(storageKey(projectId));
  } catch {
    // localStorage full/unavailable — draft still works for this session
  }
}
