/**
 * Type definitions for Project Analysis System
 */

export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type TaskStatus = 'completed' | 'in_progress' | 'pending' | 'blocked';

export type Phase = 'Phase 1' | 'Phase 2' | 'Phase 3';

export interface Metric {
  name: string;
  current: number | string;
  target: number | string;
  unit?: string;
  status: 'on_target' | 'below_target' | 'above_target' | 'needs_measurement';
}

export interface CompletedItem {
  id: string;
  description: string;
  category: string;
  completedAt?: string;
  evidence?: string;
}

export interface PendingItem {
  id: string;
  description: string;
  category: string;
  priority: Priority;
  effort?: string;
  dependencies?: string[];
  riskLevel?: RiskLevel;
}

export interface Gap {
  id: string;
  title: string;
  description: string;
  category: string;
  currentValue: number | string;
  targetValue: number | string;
  priority: Priority;
  effort: string;
  dependencies: string[];
  riskLevel: RiskLevel;
  estimatedDays: number;
  estimatedWeeks: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  effort: string;
  estimatedDays: number;
  estimatedWeeks: number;
  dependencies: string[];
  owner?: string;
  definitionOfDone: string[];
  subtasks?: Task[];
  riskLevel: RiskLevel;
  category: string;
}

export interface PhasePlan {
  id: string;
  name: string;
  description: string;
  startDay: number;
  endDay: number;
  duration: number;
  tasks: Task[];
  dependencies: string[];
  resourceRequirements: {
    developers: number;
    securityEngineers?: number;
    totalEffort: string;
  };
}

export interface WBS {
  projectName: string;
  targetCompletion: string;
  phases: PhasePlan[];
  totalDuration: number;
  totalEffort: string;
  criticalPath: string[];
}

export interface ReportSection {
  title: string;
  level: number;
  content: string;
  subsections: ReportSection[];
  checkboxes: CheckboxItem[];
  tables: TableData[];
  metrics: Metric[];
}

export interface CheckboxItem {
  checked: boolean;
  text: string;
  lineNumber: number;
}

export interface TableData {
  headers: string[];
  rows: string[][];
  title?: string;
}

export interface ParsedReport {
  filename: string;
  title: string;
  sections: ReportSection[];
  allCheckboxes: CheckboxItem[];
  allTables: TableData[];
  allMetrics: Metric[];
  completedItems: CompletedItem[];
  pendingItems: PendingItem[];
}

export interface CompletionStatus {
  overall: number;
  byCategory: {
    [category: string]: number;
  };
  metrics: Metric[];
  completedCount: number;
  pendingCount: number;
  totalCount: number;
}

export interface AnalysisResult {
  completionStatus: CompletionStatus;
  gaps: Gap[];
  wbs: WBS;
  risks: RiskAssessment[];
  resourceRequirements: ResourceRequirements;
  timeline: Timeline;
}

export interface RiskAssessment {
  id: string;
  title: string;
  description: string;
  severity: RiskLevel;
  probability: 'HIGH' | 'MEDIUM' | 'LOW';
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  mitigation: string;
  relatedTasks: string[];
}

export interface ResourceRequirements {
  phase1: {
    developers: number;
    securityEngineers: number;
    totalWeeks: number;
  };
  phase2: {
    developers: number;
    totalWeeks: number;
  };
  phase3: {
    developers: number;
    totalWeeks: number;
  };
  total: {
    developers: number;
    securityEngineers: number;
    totalWeeks: number;
  };
}

export interface Timeline {
  startDate: string;
  phase1: {
    start: string;
    end: string;
    duration: number;
  };
  phase2: {
    start: string;
    end: string;
    duration: number;
  };
  phase3: {
    start: string;
    end: string;
    duration: number;
  };
  totalDuration: number;
  milestones: Milestone[];
}

export interface Milestone {
  id: string;
  name: string;
  date: string;
  description: string;
  phase: Phase;
}
