import type { LabelGroup, Task } from '@/types';

/** Group id used for labels that don't belong to a label group */
export const UNGROUPED_LABELS_ID = '';

/** Label groups (and their labels) used by the given tasks, sorted by name. Ungrouped labels come last. */
export function buildLabelGroups(tasks: Task[]): LabelGroup[] {
  const groups = new Map<string, LabelGroup>();
  for (const t of tasks) {
    for (const l of t.labels || []) {
      const gid = l.groupId ?? UNGROUPED_LABELS_ID;
      let g = groups.get(gid);
      if (!g) {
        g = { id: gid, name: l.groupName ?? 'Other labels', labels: [] };
        groups.set(gid, g);
      }
      if (!g.labels.some((x) => x.id === l.id)) g.labels.push({ id: l.id, name: l.name, color: l.color });
    }
  }
  for (const g of groups.values()) g.labels.sort((a, b) => a.name.localeCompare(b.name));
  return [...groups.values()].sort((a, b) => {
    if (a.id === UNGROUPED_LABELS_ID) return 1;
    if (b.id === UNGROUPED_LABELS_ID) return -1;
    return a.name.localeCompare(b.name);
  });
}

/** Color of the task's label in the named label group (e.g. "Area"), if it has one */
export function labelColorInGroup(task: Task, groupName: string): string | undefined {
  if (!groupName) return undefined;
  return task.labels?.find((l) => l.groupName === groupName)?.color;
}

/** Find a label and its group by label id */
export function findLabel(groups: LabelGroup[], labelId: string) {
  for (const g of groups) {
    const label = g.labels.find((l) => l.id === labelId);
    if (label) return { group: g, label };
  }
  return null;
}
