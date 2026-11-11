export interface Task {
  id: string; // display identifier (e.g., "SEED-14")
  uuid: string; // Linear UUID for mutations
  title: string;
  description: string;
  due: string;
  startDate: string | null;
  priorityVal: number;
  priority: string;
  status: string;
  statusType: string;
  assignee: string;
  url: string; // direct Linear URL
  teamId: string; // team UUID for workflow states
  blocks: string[];
  blockedBy: string[];
  progress: number;
  totalChildren: number;
  completedChildren: number;
  completedAt?: string;
  /** True when `due` was derived from project.targetDate (issue has no explicit due date) */
  isDueImplicit?: boolean;
  /** Linear project milestone this issue belongs to, if any */
  milestoneId?: string | null;
  /** Issue labels. Undefined when the data source doesn't include them (e.g. shared views). */
  labels?: TaskLabel[];
}

export interface TaskLabel {
  id: string;
  name: string;
  color: string;
  /** Label group (Linear parent label), or null for ungrouped labels */
  groupId: string | null;
  groupName: string | null;
}

/** A label group with the labels used by the current tasks. Ungrouped labels use groupId ''. */
export interface LabelGroup {
  id: string;
  name: string;
  labels: Array<{ id: string; name: string; color: string }>;
}

export interface Project {
  id: string;
  name: string;
}

export interface Milestone {
  id: string;
  name: string;
  targetDate: string | null;
  description?: string;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowState {
  id: string;
  name: string;
  type: string; // 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'
  position: number;
}

export type GroupBy = 'none' | 'assignee' | 'priority' | 'status';

export const PRIORITY_MAP: Record<number, string> = {
  0: 'None',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
};

export const DEFAULT_DAY_WIDTH = 28;
export const MIN_DAY_WIDTH = 14;
export const MAX_DAY_WIDTH = 56;

export type TimeScale = 'day' | 'week' | 'month';

export const TIME_SCALES: TimeScale[] = ['day', 'week', 'month'];

/** Multiplier applied to dayWidth to get the effective px-per-day at each scale */
export const TIME_SCALE_FACTORS: Record<TimeScale, number> = {
  day: 1,
  week: 0.25, // a week column spans 7 × dayWidth/4 ≈ 1.75 × dayWidth
  month: 0.125, // a month column spans ~30 × dayWidth/8 ≈ 3.75 × dayWidth
};

export interface Filters {
  assignee: string;
  status: string;
  /** Label id, or '' for any label */
  label: string;
  priorities: Set<number>;
  /**
   * When bars are colored by a label group (e.g. Area): label ids whose issues are hidden.
   * '' stands for issues with no label in that group.
   */
  hiddenColorLabels: Set<string>;
  search: string;
  dateFrom: string;
  dateTo: string;
}
