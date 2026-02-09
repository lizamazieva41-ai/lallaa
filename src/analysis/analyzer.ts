/**
 * Main Analyzer - Orchestrate the analysis process
 */

import * as path from 'path';
import {
  ParsedReport,
  CompletionStatus,
  Gap,
  WBS,
  AnalysisResult,
  RiskAssessment,
  ResourceRequirements,
  Timeline,
} from './types';
import { ReportParser } from './reportParser';
import { DataExtractor } from './dataExtractor';
import { GapAnalyzer } from './gapAnalyzer';
import { WBSGenerator } from './wbsGenerator';
import { TimelineCalculator } from './timelineCalculator';
import { ReportGenerator } from './reportGenerator';

export class ProjectAnalyzer {
  private reportParser: ReportParser;
  private dataExtractor: DataExtractor;
  private gapAnalyzer: GapAnalyzer;
  private wbsGenerator: WBSGenerator;
  private timelineCalculator: TimelineCalculator;
  private reportGenerator: ReportGenerator;

  constructor() {
    this.reportParser = new ReportParser();
    this.dataExtractor = new DataExtractor();
    this.gapAnalyzer = new GapAnalyzer();
    this.wbsGenerator = new WBSGenerator();
    this.timelineCalculator = new TimelineCalculator();
    this.reportGenerator = new ReportGenerator();
  }

  /**
   * Analyze project reports and generate analysis result
   */
  async analyze(reportFiles: string[]): Promise<AnalysisResult> {
    // Step 1: Parse all reports
    console.log('📖 Parsing reports...');
    const reports = await this.reportParser.parseReports(reportFiles);

    // Step 2: Extract completion status
    console.log('📊 Extracting completion status...');
    const completionStatus = this.dataExtractor.extractCompletionStatus(reports);

    // Step 3: Extract metrics and pending items
    console.log('🔍 Extracting metrics and pending items...');
    const metrics = this.dataExtractor.extractMetrics(reports);
    const pendingItems = this.dataExtractor.extractPendingItems(reports);

    // Step 4: Analyze gaps
    console.log('🎯 Analyzing gaps...');
    const gaps = this.gapAnalyzer.analyzeGaps(
      completionStatus,
      metrics,
      pendingItems
    );

    // Step 5: Generate WBS
    console.log('📋 Generating WBS...');
    const wbs = this.wbsGenerator.generateWBS(gaps);

    // Step 6: Calculate timeline
    console.log('📅 Calculating timeline...');
    const timeline = this.timelineCalculator.calculateTimeline(wbs);

    // Step 7: Generate risk assessments
    console.log('⚠️ Generating risk assessments...');
    const risks = this.generateRiskAssessments(gaps, wbs);

    // Step 8: Calculate resource requirements
    console.log('👥 Calculating resource requirements...');
    const resourceRequirements = this.calculateResourceRequirements(wbs);

    return {
      completionStatus,
      gaps,
      wbs,
      risks,
      resourceRequirements,
      timeline,
    };
  }

  /**
   * Generate risk assessments
   */
  private generateRiskAssessments(gaps: Gap[], wbs: WBS): RiskAssessment[] {
    const risks: RiskAssessment[] = [];

    // Security risks
    const securityGaps = gaps.filter((g) => g.category === 'Security');
    if (securityGaps.length > 0) {
      risks.push({
        id: 'risk-security',
        title: 'Security Vulnerabilities',
        description: `Có ${securityGaps.length} lỗ hổng bảo mật cần được xử lý ngay lập tức`,
        severity: 'CRITICAL',
        probability: 'HIGH',
        impact: 'HIGH',
        mitigation: 'Ưu tiên xử lý các lỗ hổng CRITICAL và HIGH trong Phase 1',
        relatedTasks: securityGaps.map((g) => g.id),
      });
    }

    // Test coverage risks
    const testGaps = gaps.filter((g) => g.category === 'Testing');
    if (testGaps.length > 0) {
      risks.push({
        id: 'risk-test-coverage',
        title: 'Low Test Coverage',
        description: `Test coverage hiện tại thấp, có thể dẫn đến bugs trong production`,
        severity: 'HIGH',
        probability: 'MEDIUM',
        impact: 'HIGH',
        mitigation: 'Tăng test coverage lên 80%+ trong Phase 2',
        relatedTasks: testGaps.map((g) => g.id),
      });
    }

    // Timeline risks
    risks.push({
      id: 'risk-timeline',
      title: 'Timeline Overrun Risk',
      description: 'Có thể vượt quá timeline nếu không quản lý tốt dependencies',
      severity: 'MEDIUM',
      probability: 'MEDIUM',
      impact: 'MEDIUM',
      mitigation: 'Theo dõi critical path và điều chỉnh resources khi cần',
      relatedTasks: wbs.criticalPath,
    });

    return risks;
  }

  /**
   * Calculate resource requirements
   */
  private calculateResourceRequirements(wbs: WBS): ResourceRequirements {
    return {
      phase1: {
        developers: wbs.phases[0]?.resourceRequirements.developers || 2,
        securityEngineers: wbs.phases[0]?.resourceRequirements.securityEngineers || 1,
        totalWeeks: Math.ceil((wbs.phases[0]?.duration || 0) / 7),
      },
      phase2: {
        developers: wbs.phases[1]?.resourceRequirements.developers || 2,
        totalWeeks: Math.ceil((wbs.phases[1]?.duration || 0) / 7),
      },
      phase3: {
        developers: wbs.phases[2]?.resourceRequirements.developers || 2,
        totalWeeks: Math.ceil((wbs.phases[2]?.duration || 0) / 7),
      },
      total: {
        developers: 2,
        securityEngineers: 1,
        totalWeeks: Math.ceil(wbs.totalDuration / 7),
      },
    };
  }

  /**
   * Generate all reports
   */
  generateReports(result: AnalysisResult): {
    completionStatus: string;
    gapAnalysis: string;
    wbs: string;
    actionPlan: string;
  } {
    return this.reportGenerator.generateAllReports(result);
  }
}
