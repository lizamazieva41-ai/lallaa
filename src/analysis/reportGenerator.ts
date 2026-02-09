/**
 * Report Generator - Generate comprehensive reports
 */

import {
  CompletionStatus,
  Gap,
  WBS,
  AnalysisResult,
} from './types';
import { IReportGenerator } from './interfaces';
import {
  generateCompletionStatusTemplate,
  generateGapAnalysisTemplate,
  generateWBSReportTemplate,
  generateActionPlanTemplate,
} from './templateEngine';

export class ReportGenerator implements IReportGenerator {
  /**
   * Generate completion status report
   */
  generateCompletionStatusReport(
    completionStatus: CompletionStatus
  ): string {
    return generateCompletionStatusTemplate(completionStatus);
  }

  /**
   * Generate gap analysis report
   */
  generateGapAnalysisReport(gaps: Gap[]): string {
    return generateGapAnalysisTemplate(gaps);
  }

  /**
   * Generate WBS report
   */
  generateWBSReport(wbs: WBS): string {
    return generateWBSReportTemplate(wbs);
  }

  /**
   * Generate complete action plan report
   */
  generateActionPlanReport(result: AnalysisResult): string {
    return generateActionPlanTemplate(result);
  }

  /**
   * Generate all reports
   */
  generateAllReports(result: AnalysisResult): {
    completionStatus: string;
    gapAnalysis: string;
    wbs: string;
    actionPlan: string;
  } {
    return {
      completionStatus: this.generateCompletionStatusReport(
        result.completionStatus
      ),
      gapAnalysis: this.generateGapAnalysisReport(result.gaps),
      wbs: this.generateWBSReport(result.wbs),
      actionPlan: this.generateActionPlanReport(result),
    };
  }
}
