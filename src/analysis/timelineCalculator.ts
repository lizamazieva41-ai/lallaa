/**
 * Timeline Calculator - Calculate timelines and critical paths
 */

import { WBS, PhasePlan, Task, Milestone, Phase } from './types';
import { ITimelineCalculator } from './interfaces';

export class TimelineCalculator implements ITimelineCalculator {
  /**
   * Calculate timeline from WBS
   */
  calculateTimeline(wbs: WBS, startDate?: Date): {
    startDate: string;
    phase1: { start: string; end: string; duration: number };
    phase2: { start: string; end: string; duration: number };
    phase3: { start: string; end: string; duration: number };
    totalDuration: number;
    milestones: Milestone[];
  } {
    const start = startDate || new Date();
    const startDateStr = start.toISOString().split('T')[0];

    // Calculate phase durations
    const phase1Duration = this.calculatePhaseDuration(wbs.phases[0] || { tasks: [] });
    const phase2Duration = this.calculatePhaseDuration(wbs.phases[1] || { tasks: [] });
    const phase3Duration = this.calculatePhaseDuration(wbs.phases[2] || { tasks: [] });

    // Calculate phase dates
    let currentDate = new Date(start);
    const phase1Start = new Date(currentDate);
    const phase1End = this.addDays(currentDate, phase1Duration);
    currentDate = new Date(phase1End);

    const phase2Start = new Date(currentDate);
    const phase2End = this.addDays(currentDate, phase2Duration);
    currentDate = new Date(phase2End);

    const phase3Start = new Date(currentDate);
    const phase3End = this.addDays(currentDate, phase3Duration);

    // Generate milestones
    const milestones = this.generateMilestones(wbs, start);

    return {
      startDate: startDateStr,
      phase1: {
        start: phase1Start.toISOString().split('T')[0],
        end: phase1End.toISOString().split('T')[0],
        duration: phase1Duration,
      },
      phase2: {
        start: phase2Start.toISOString().split('T')[0],
        end: phase2End.toISOString().split('T')[0],
        duration: phase2Duration,
      },
      phase3: {
        start: phase3Start.toISOString().split('T')[0],
        end: phase3End.toISOString().split('T')[0],
        duration: phase3Duration,
      },
      totalDuration: phase1Duration + phase2Duration + phase3Duration,
      milestones,
    };
  }

  /**
   * Calculate phase duration
   */
  private calculatePhaseDuration(phase: PhasePlan): number {
    if (!phase || !phase.tasks || phase.tasks.length === 0) {
      return 0;
    }

    // Calculate based on critical path
    const criticalPath = this.calculateCriticalPathForPhase(phase.tasks);
    return criticalPath.reduce((sum, taskId) => {
      const task = phase.tasks.find((t) => t.id === taskId);
      return sum + (task?.estimatedDays || 0);
    }, 0);
  }

  /**
   * Calculate critical path for a phase
   */
  private calculateCriticalPathForPhase(tasks: Task[]): string[] {
    if (tasks.length === 0) return [];

    // Simple critical path: longest path through dependencies
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const visited = new Set<string>();
    const path: string[] = [];

    // Find tasks with no dependencies (start nodes)
    const startTasks = tasks.filter((t) => t.dependencies.length === 0);

    if (startTasks.length === 0) {
      // If no start tasks, use the first task
      return tasks.length > 0 ? [tasks[0].id] : [];
    }

    // Use the longest path from start tasks
    let maxPath: string[] = [];
    for (const startTask of startTasks) {
      const path = this.dfsLongestPath(startTask.id, taskMap, visited);
      if (path.length > maxPath.length) {
        maxPath = path;
      }
    }

    return maxPath;
  }

  /**
   * DFS to find longest path
   */
  private dfsLongestPath(
    taskId: string,
    taskMap: Map<string, Task>,
    visited: Set<string>
  ): string[] {
    if (visited.has(taskId)) {
      return [];
    }

    visited.add(taskId);
    const task = taskMap.get(taskId);
    if (!task) return [taskId];

    if (task.dependencies.length === 0) {
      return [taskId];
    }

    let maxPath: string[] = [];
    for (const depId of task.dependencies) {
      const depPath = this.dfsLongestPath(depId, taskMap, new Set(visited));
      if (depPath.length > maxPath.length) {
        maxPath = depPath;
      }
    }

    return [...maxPath, taskId];
  }

  /**
   * Add days to date
   */
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Generate milestones
   */
  private generateMilestones(wbs: WBS, startDate: Date): Milestone[] {
    const milestones: Milestone[] = [];
    let currentDate = new Date(startDate);

    for (let i = 0; i < wbs.phases.length; i++) {
      const phase = wbs.phases[i];
      const phaseDuration = this.calculatePhaseDuration(phase);
      const phaseEnd = this.addDays(currentDate, phaseDuration);

      milestones.push({
        id: `milestone-phase-${i + 1}`,
        name: `${phase.name} Completed`,
        date: phaseEnd.toISOString().split('T')[0],
        description: `Complete all tasks in ${phase.name}`,
        phase: `Phase ${i + 1}` as Phase,
      });

      currentDate = new Date(phaseEnd);
    }

    return milestones;
  }

  /**
   * Identify critical path
   */
  identifyCriticalPath(wbs: WBS): string[] {
    const allTasks: Task[] = [];
    for (const phase of wbs.phases) {
      allTasks.push(...phase.tasks);
    }

    return this.calculateCriticalPathForPhase(allTasks);
  }

  /**
   * Calculate phase durations
   */
  calculatePhaseDurations(phases: PhasePlan[]): Map<string, number> {
    const durations = new Map<string, number>();

    for (const phase of phases) {
      const duration = this.calculatePhaseDuration(phase);
      durations.set(phase.id, duration);
    }

    return durations;
  }
}
