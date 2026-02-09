/**
 * Template Engine - Generate markdown reports from templates
 */

import {
  CompletionStatus,
  Gap,
  WBS,
  AnalysisResult,
  Task,
  PhasePlan,
  Metric,
} from './types';

/**
 * Generate completion status report
 */
export function generateCompletionStatusTemplate(
  completionStatus: CompletionStatus
): string {
  const overallPercent = completionStatus.overall.toFixed(1);
  const progressBar = generateProgressBar(completionStatus.overall);

  let report = `# Trạng Thái Hoàn Thành Dự Án\n\n`;
  report += `**Ngày tạo**: ${new Date().toISOString().split('T')[0]}\n\n`;
  report += `## Tổng Quan\n\n`;
  report += `**Tỷ lệ hoàn thành tổng thể**: **${overallPercent}%**\n\n`;
  report += `${progressBar}\n\n`;

  report += `### Thống Kê\n\n`;
  report += `- **Đã hoàn thành**: ${completionStatus.completedCount} hạng mục\n`;
  report += `- **Đang chờ**: ${completionStatus.pendingCount} hạng mục\n`;
  report += `- **Tổng cộng**: ${completionStatus.totalCount} hạng mục\n\n`;

  report += `## Hoàn Thành Theo Danh Mục\n\n`;
  report += `| Danh Mục | Tỷ Lệ Hoàn Thành | Trạng Thái |\n`;
  report += `|----------|------------------|------------|\n`;

  for (const [category, percent] of Object.entries(
    completionStatus.byCategory
  )) {
    const status = percent >= 80 ? '✅ On Target' : percent >= 60 ? '⚠️ Below Target' : '❌ Needs Improvement';
    report += `| ${category} | ${percent.toFixed(1)}% | ${status} |\n`;
  }

  report += `\n## Metrics Chi Tiết\n\n`;
  report += `| Metric | Hiện Tại | Mục Tiêu | Trạng Thái |\n`;
  report += `|--------|----------|-----------|------------|\n`;

  for (const metric of completionStatus.metrics) {
    const current = typeof metric.current === 'number' 
      ? `${metric.current}${metric.unit || ''}` 
      : metric.current;
    const target = typeof metric.target === 'number' 
      ? `${metric.target}${metric.unit || ''}` 
      : metric.target;
    
    let status = '⚠️';
    if (metric.status === 'on_target') status = '✅';
    else if (metric.status === 'above_target') status = '✅✅';
    else if (metric.status === 'needs_measurement') status = '❓';

    report += `| ${metric.name} | ${current} | ${target} | ${status} |\n`;
  }

  return report;
}

/**
 * Generate gap analysis report
 */
export function generateGapAnalysisTemplate(gaps: Gap[]): string {
  let report = `# Phân Tích Khoảng Trống Chi Tiết\n\n`;
  report += `**Ngày tạo**: ${new Date().toISOString().split('T')[0]}\n\n`;
  report += `**Tổng số khoảng trống**: ${gaps.length}\n\n`;

  // Group by priority
  const byPriority = {
    CRITICAL: gaps.filter((g) => g.priority === 'CRITICAL'),
    HIGH: gaps.filter((g) => g.priority === 'HIGH'),
    MEDIUM: gaps.filter((g) => g.priority === 'MEDIUM'),
    LOW: gaps.filter((g) => g.priority === 'LOW'),
  };

  const priorityLabels = {
    CRITICAL: '🔴 CRITICAL',
    HIGH: '🟡 HIGH',
    MEDIUM: '🟠 MEDIUM',
    LOW: '🟢 LOW',
  };

  for (const [priority, priorityGaps] of Object.entries(byPriority)) {
    if (priorityGaps.length === 0) continue;

    report += `## ${priorityLabels[priority as keyof typeof priorityLabels]} (${priorityGaps.length})\n\n`;

    for (const gap of priorityGaps) {
      report += `### ${gap.title}\n\n`;
      report += `**Danh mục**: ${gap.category}\n\n`;
      report += `**Mô tả**: ${gap.description}\n\n`;
      
      if (typeof gap.currentValue === 'number' && typeof gap.targetValue === 'number') {
        report += `**Hiện tại**: ${gap.currentValue}\n\n`;
        report += `**Mục tiêu**: ${gap.targetValue}\n\n`;
        report += `**Khoảng trống**: ${(gap.targetValue - gap.currentValue).toFixed(2)}\n\n`;
      }

      report += `**Ước lượng**: ${gap.effort} (${gap.estimatedDays} ngày, ${gap.estimatedWeeks.toFixed(1)} tuần)\n\n`;
      report += `**Mức độ rủi ro**: ${gap.riskLevel}\n\n`;
      
      if (gap.dependencies.length > 0) {
        report += `**Phụ thuộc**: ${gap.dependencies.join(', ')}\n\n`;
      }

      report += `---\n\n`;
    }
  }

  return report;
}

/**
 * Generate WBS report
 */
export function generateWBSReportTemplate(wbs: WBS): string {
  let report = `# Work Breakdown Structure (WBS)\n\n`;
  report += `**Dự án**: ${wbs.projectName}\n\n`;
  report += `**Mục tiêu**: ${wbs.targetCompletion}\n\n`;
  report += `**Tổng thời gian**: ${wbs.totalEffort}\n\n`;
  report += `**Đường dẫn quan trọng**: ${wbs.criticalPath.join(' → ')}\n\n`;

  for (const phase of wbs.phases) {
    report += `## ${phase.name}\n\n`;
    report += `**Mô tả**: ${phase.description}\n\n`;
    report += `**Thời gian**: ${phase.startDay} - ${phase.endDay} ngày (${phase.duration} ngày)\n\n`;
    report += `**Nguồn lực**:\n`;
    report += `- Developers: ${phase.resourceRequirements.developers}\n`;
    if (phase.resourceRequirements.securityEngineers) {
      report += `- Security Engineers: ${phase.resourceRequirements.securityEngineers}\n`;
    }
    report += `- Tổng effort: ${phase.resourceRequirements.totalEffort}\n\n`;

    report += `### Tasks\n\n`;
    for (const task of phase.tasks) {
      report += `#### ${task.title}\n\n`;
      report += `**ID**: ${task.id}\n\n`;
      report += `**Mô tả**: ${task.description}\n\n`;
      report += `**Ưu tiên**: ${task.priority}\n\n`;
      report += `**Ước lượng**: ${task.effort} (${task.estimatedDays} ngày)\n\n`;
      report += `**Mức độ rủi ro**: ${task.riskLevel}\n\n`;

      if (task.dependencies.length > 0) {
        report += `**Phụ thuộc**: ${task.dependencies.join(', ')}\n\n`;
      }

      report += `**Definition of Done**:\n`;
      for (const dod of task.definitionOfDone) {
        report += `- [ ] ${dod}\n`;
      }
      report += `\n`;

      if (task.subtasks && task.subtasks.length > 0) {
        report += `**Subtasks**:\n`;
        for (const subtask of task.subtasks) {
          report += `- ${subtask.title} (${subtask.effort})\n`;
        }
        report += `\n`;
      }

      report += `---\n\n`;
    }
  }

  return report;
}

/**
 * Generate action plan report
 */
export function generateActionPlanTemplate(result: AnalysisResult): string {
  let report = `# Kế Hoạch Hành Động - Đạt 100/100\n\n`;
  report += `**Ngày tạo**: ${new Date().toISOString().split('T')[0]}\n\n`;
  report += `## Executive Summary\n\n`;
  report += `Tỷ lệ hoàn thành hiện tại: **${result.completionStatus.overall.toFixed(1)}%**\n\n`;
  report += `Mục tiêu: **100%**\n\n`;
  report += `Khoảng trống cần lấp đầy: **${result.gaps.length}** hạng mục\n\n`;

  report += `## Phân Tích Rủi Ro\n\n`;
  for (const risk of result.risks) {
    report += `### ${risk.title}\n\n`;
    report += `**Mức độ nghiêm trọng**: ${risk.severity}\n\n`;
    report += `**Xác suất**: ${risk.probability}\n\n`;
    report += `**Tác động**: ${risk.impact}\n\n`;
    report += `**Giảm thiểu**: ${risk.mitigation}\n\n`;
    report += `---\n\n`;
  }

  report += `## Yêu Cầu Nguồn Lực\n\n`;
  report += `### Phase 1\n`;
  report += `- Developers: ${result.resourceRequirements.phase1.developers}\n`;
  report += `- Security Engineers: ${result.resourceRequirements.phase1.securityEngineers}\n`;
  report += `- Tổng thời gian: ${result.resourceRequirements.phase1.totalWeeks} tuần\n\n`;

  report += `### Phase 2\n`;
  report += `- Developers: ${result.resourceRequirements.phase2.developers}\n`;
  report += `- Tổng thời gian: ${result.resourceRequirements.phase2.totalWeeks} tuần\n\n`;

  report += `### Phase 3\n`;
  report += `- Developers: ${result.resourceRequirements.phase3.developers}\n`;
  report += `- Tổng thời gian: ${result.resourceRequirements.phase3.totalWeeks} tuần\n\n`;

  report += `### Tổng Cộng\n`;
  report += `- Developers: ${result.resourceRequirements.total.developers}\n`;
  report += `- Security Engineers: ${result.resourceRequirements.total.securityEngineers}\n`;
  report += `- Tổng thời gian: ${result.resourceRequirements.total.totalWeeks} tuần\n\n`;

  report += `## Timeline\n\n`;
  report += `**Bắt đầu**: ${result.timeline.startDate}\n\n`;
  report += `**Phase 1**: ${result.timeline.phase1.start} - ${result.timeline.phase1.end} (${result.timeline.phase1.duration} ngày)\n\n`;
  report += `**Phase 2**: ${result.timeline.phase2.start} - ${result.timeline.phase2.end} (${result.timeline.phase2.duration} ngày)\n\n`;
  report += `**Phase 3**: ${result.timeline.phase3.start} - ${result.timeline.phase3.end} (${result.timeline.phase3.duration} ngày)\n\n`;
  report += `**Tổng thời gian**: ${result.timeline.totalDuration} ngày\n\n`;

  report += `## Milestones\n\n`;
  for (const milestone of result.timeline.milestones) {
    report += `### ${milestone.name}\n\n`;
    report += `**Ngày**: ${milestone.date}\n\n`;
    report += `**Mô tả**: ${milestone.description}\n\n`;
    report += `**Phase**: ${milestone.phase}\n\n`;
    report += `---\n\n`;
  }

  return report;
}

/**
 * Generate progress bar
 */
function generateProgressBar(percentage: number, length: number = 20): string {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage.toFixed(1)}%`;
}
