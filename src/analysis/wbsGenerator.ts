/**
 * WBS Generator - Generate Work Breakdown Structure
 */

import { Gap, WBS, Task, PhasePlan } from './types';
import { IWBSGenerator } from './interfaces';
import {
  buildTasksFromGaps,
  groupTasksByCategory,
  sortTasksByPriority,
} from './taskBuilder';

export class WBSGenerator implements IWBSGenerator {
  /**
   * Generate Work Breakdown Structure from gaps
   */
  generateWBS(gaps: Gap[]): WBS {
    // Build tasks from gaps
    const tasks = this.buildTasks(gaps);

    // Build phases from tasks
    const phases = this.buildPhases(tasks);

    // Calculate dependencies
    const dependencies = this.calculateDependencies(tasks);

    // Calculate total duration
    const totalDuration = phases.reduce(
      (sum, phase) => sum + (phase.endDay - phase.startDay),
      0
    );

    // Calculate total effort
    const totalEffort = this.calculateTotalEffort(phases);

    // Identify critical path
    const criticalPath = this.identifyCriticalPath(phases);

    return {
      projectName: 'BIN Check API - 100/100 Completion',
      targetCompletion: '100/100',
      phases,
      totalDuration,
      totalEffort,
      criticalPath,
    };
  }

  /**
   * Build tasks from gaps
   */
  buildTasks(gaps: Gap[]): Task[] {
    return buildTasksFromGaps(gaps);
  }

  /**
   * Build phases from tasks
   */
  buildPhases(tasks: Task[]): PhasePlan[] {
    // Group tasks by priority and category
    const criticalTasks = tasks.filter((t) => t.priority === 'CRITICAL');
    const highTasks = tasks.filter((t) => t.priority === 'HIGH');
    const mediumTasks = tasks.filter((t) => t.priority === 'MEDIUM');
    const lowTasks = tasks.filter((t) => t.priority === 'LOW');

    // Phase 1: Critical Security Fixes (0-30 days)
    const phase1Tasks = [
      ...criticalTasks.filter((t) => t.category === 'Security'),
      ...criticalTasks.filter((t) => t.category !== 'Security').slice(0, 2),
    ];

    // Phase 2: Test Coverage & Quality (30-90 days)
    const phase2Tasks = [
      ...highTasks.filter((t) => t.category === 'Testing'),
      ...highTasks.filter((t) => t.category !== 'Testing'),
      ...mediumTasks.slice(0, 5),
    ];

    // Phase 3: Performance & Optimization (90+ days)
    const phase3Tasks = [
      ...mediumTasks.slice(5),
      ...lowTasks,
    ];

    // Calculate phase durations
    const phase1Duration = this.calculatePhaseDuration(phase1Tasks);
    const phase2Duration = this.calculatePhaseDuration(phase2Tasks);
    const phase3Duration = this.calculatePhaseDuration(phase3Tasks);

    const phases: PhasePlan[] = [
      {
        id: 'phase-1',
        name: 'Phase 1: Critical Security Fixes',
        description: 'Fix critical security vulnerabilities and high-priority issues',
        startDay: 0,
        endDay: phase1Duration,
        duration: phase1Duration,
        tasks: sortTasksByPriority(phase1Tasks),
        dependencies: [],
        resourceRequirements: {
          developers: 2,
          securityEngineers: 1,
          totalEffort: `${phase1Duration} days`,
        },
      },
      {
        id: 'phase-2',
        name: 'Phase 2: Test Coverage & Quality Enhancement',
        description: 'Increase test coverage and improve OWASP compliance',
        startDay: phase1Duration,
        endDay: phase1Duration + phase2Duration,
        duration: phase2Duration,
        tasks: sortTasksByPriority(phase2Tasks),
        dependencies: ['phase-1'],
        resourceRequirements: {
          developers: 2,
          totalEffort: `${phase2Duration} days`,
        },
      },
      {
        id: 'phase-3',
        name: 'Phase 3: Performance & Strategic Improvements',
        description: 'Performance optimization and strategic enhancements',
        startDay: phase1Duration + phase2Duration,
        endDay: phase1Duration + phase2Duration + phase3Duration,
        duration: phase3Duration,
        tasks: sortTasksByPriority(phase3Tasks),
        dependencies: ['phase-2'],
        resourceRequirements: {
          developers: 2,
          totalEffort: `${phase3Duration} days`,
        },
      },
    ];

    return phases;
  }

  /**
   * Calculate dependencies between tasks
   */
  calculateDependencies(tasks: Task[]): Map<string, string[]> {
    const dependencies = new Map<string, string[]>();

    for (const task of tasks) {
      const taskDeps: string[] = [];

      // Security tasks depend on each other in order
      if (task.category === 'Security') {
        const securityTasks = tasks.filter((t) => t.category === 'Security');
        const currentIndex = securityTasks.findIndex((t) => t.id === task.id);
        if (currentIndex > 0) {
          taskDeps.push(securityTasks[currentIndex - 1].id);
        }
      }

      // Testing tasks may depend on security fixes
      if (task.category === 'Testing') {
        const securityTasks = tasks.filter(
          (t) => t.category === 'Security' && t.priority === 'CRITICAL'
        );
        if (securityTasks.length > 0) {
          taskDeps.push(securityTasks[0].id);
        }
      }

      // Add explicit dependencies from task
      taskDeps.push(...task.dependencies);

      dependencies.set(task.id, taskDeps);
    }

    return dependencies;
  }

  /**
   * Calculate phase duration
   */
  private calculatePhaseDuration(tasks: Task[]): number {
    if (tasks.length === 0) return 0;

    // Calculate based on critical path
    const dependencies = this.calculateDependencies(tasks);
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    // Find longest path
    let maxDuration = 0;
    for (const task of tasks) {
      const duration = this.calculateTaskDurationWithDeps(
        task.id,
        taskMap,
        dependencies,
        new Set()
      );
      maxDuration = Math.max(maxDuration, duration);
    }

    return Math.ceil(maxDuration);
  }

  /**
   * Calculate task duration including dependencies
   */
  private calculateTaskDurationWithDeps(
    taskId: string,
    taskMap: Map<string, Task>,
    dependencies: Map<string, string[]>,
    visited: Set<string>
  ): number {
    if (visited.has(taskId)) {
      return 0;
    }

    visited.add(taskId);
    const task = taskMap.get(taskId);
    if (!task) return 0;

    const deps = dependencies.get(taskId) || [];
    let maxDepDuration = 0;

    for (const depId of deps) {
      const depDuration = this.calculateTaskDurationWithDeps(
        depId,
        taskMap,
        dependencies,
        new Set(visited)
      );
      maxDepDuration = Math.max(maxDepDuration, depDuration);
    }

    return maxDepDuration + task.estimatedDays;
  }

  /**
   * Calculate total effort
   */
  private calculateTotalEffort(phases: PhasePlan[]): string {
    const totalDays = phases.reduce((sum, phase) => sum + phase.duration, 0);
    const weeks = Math.ceil(totalDays / 7);
    return `${weeks} weeks (${totalDays} days)`;
  }

  /**
   * Identify critical path
   */
  private identifyCriticalPath(phases: PhasePlan[]): string[] {
    const criticalPath: string[] = [];

    for (const phase of phases) {
      // Find the longest task chain in each phase
      const dependencies = this.calculateDependencies(phase.tasks);
      const taskMap = new Map(phase.tasks.map((t) => [t.id, t]));

      let maxPath: string[] = [];
      for (const task of phase.tasks) {
        const path = this.findLongestPath(
          task.id,
          taskMap,
          dependencies,
          new Set()
        );
        if (path.length > maxPath.length) {
          maxPath = path;
        }
      }

      criticalPath.push(...maxPath);
    }

    return criticalPath;
  }

  /**
   * Find longest path from a task
   */
  private findLongestPath(
    taskId: string,
    taskMap: Map<string, Task>,
    dependencies: Map<string, string[]>,
    visited: Set<string>
  ): string[] {
    if (visited.has(taskId)) {
      return [];
    }

    visited.add(taskId);
    const task = taskMap.get(taskId);
    if (!task) return [taskId];

    const deps = dependencies.get(taskId) || [];
    if (deps.length === 0) {
      return [taskId];
    }

    let maxPath: string[] = [];
    for (const depId of deps) {
      const path = this.findLongestPath(
        depId,
        taskMap,
        dependencies,
        new Set(visited)
      );
      if (path.length > maxPath.length) {
        maxPath = path;
      }
    }

    return [...maxPath, taskId];
  }
}
