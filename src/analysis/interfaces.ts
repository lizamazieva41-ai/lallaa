/**
 * Interfaces for Project Analysis System
 */

import {
  ParsedReport,
  CompletionStatus,
  Gap,
  WBS,
  AnalysisResult,
  Task,
  PhasePlan,
  Metric,
  Priority,
  RiskLevel,
} from './types';

/**
 * Report Parser Interface
 */
export interface IReportParser {
  /**
   * Parse a markdown report file
   */
  parseReport(filePath: string): Promise<ParsedReport>;

  /**
   * Parse markdown content
   */
  parseMarkdown(content: string, filename: string): ParsedReport;
}

/**
 * Data Extractor Interface
 */
export interface IDataExtractor {
  /**
   * Extract completion status from parsed reports
   */
  extractCompletionStatus(reports: ParsedReport[]): CompletionStatus;

  /**
   * Extract metrics from parsed reports
   */
  extractMetrics(reports: ParsedReport[]): Metric[];

  /**
   * Extract completed items from parsed reports
   */
  extractCompletedItems(reports: ParsedReport[]): Array<{
    id: string;
    description: string;
    category: string;
  }>;

  /**
   * Extract pending items from parsed reports
   */
  extractPendingItems(reports: ParsedReport[]): Array<{
    id: string;
    description: string;
    category: string;
    priority: Priority;
  }>;
}

/**
 * Gap Analyzer Interface
 */
export interface IGapAnalyzer {
  /**
   * Analyze gaps between current and target states
   */
  analyzeGaps(
    completionStatus: CompletionStatus,
    metrics: Metric[],
    pendingItems: Array<{
      id: string;
      description: string;
      category: string;
      priority: Priority;
    }>
  ): Gap[];

  /**
   * Classify gaps by priority
   */
  classifyByPriority(gaps: Gap[]): {
    CRITICAL: Gap[];
    HIGH: Gap[];
    MEDIUM: Gap[];
    LOW: Gap[];
  };

  /**
   * Estimate effort for gaps
   */
  estimateEffort(gap: Gap): {
    days: number;
    weeks: number;
    description: string;
  };
}

/**
 * WBS Generator Interface
 */
export interface IWBSGenerator {
  /**
   * Generate Work Breakdown Structure from gaps
   */
  generateWBS(gaps: Gap[]): WBS;

  /**
   * Build tasks from gaps
   */
  buildTasks(gaps: Gap[]): Task[];

  /**
   * Build phases from tasks
   */
  buildPhases(tasks: Task[]): PhasePlan[];

  /**
   * Calculate dependencies between tasks
   */
  calculateDependencies(tasks: Task[]): Map<string, string[]>;
}

/**
 * Report Generator Interface
 */
export interface IReportGenerator {
  /**
   * Generate completion status report
   */
  generateCompletionStatusReport(
    completionStatus: CompletionStatus
  ): string;

  /**
   * Generate gap analysis report
   */
  generateGapAnalysisReport(gaps: Gap[]): string;

  /**
   * Generate WBS report
   */
  generateWBSReport(wbs: WBS): string;

  /**
   * Generate complete action plan report
   */
  generateActionPlanReport(result: AnalysisResult): string;

  /**
   * Generate all reports
   */
  generateAllReports(result: AnalysisResult): {
    completionStatus: string;
    gapAnalysis: string;
    wbs: string;
    actionPlan: string;
  };
}

/**
 * Timeline Calculator Interface
 */
export interface ITimelineCalculator {
  /**
   * Calculate timeline from WBS
   */
  calculateTimeline(wbs: WBS, startDate?: Date): {
    startDate: string;
    phase1: { start: string; end: string; duration: number };
    phase2: { start: string; end: string; duration: number };
    phase3: { start: string; end: string; duration: number };
    totalDuration: number;
    milestones: Array<{
      id: string;
      name: string;
      date: string;
      description: string;
      phase: 'Phase 1' | 'Phase 2' | 'Phase 3';
    }>;
  };

  /**
   * Identify critical path
   */
  identifyCriticalPath(wbs: WBS): string[];

  /**
   * Calculate phase durations
   */
  calculatePhaseDurations(phases: PhasePlan[]): Map<string, number>;
}

/**
 * Priority Calculator Interface
 */
export interface IPriorityCalculator {
  /**
   * Calculate priority based on multiple factors
   */
  calculatePriority(
    category: string,
    riskLevel: RiskLevel,
    impact: string
  ): Priority;

  /**
   * Determine risk level
   */
  determineRiskLevel(
    severity: string,
    probability: string,
    impact: string
  ): RiskLevel;
}
