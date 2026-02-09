/**
 * Task Builder - Build tasks from gaps
 */

import { Gap, Task, TaskStatus, Priority, RiskLevel } from './types';

/**
 * Build tasks from gaps
 */
export function buildTasksFromGaps(gaps: Gap[]): Task[] {
  const tasks: Task[] = [];

  for (const gap of gaps) {
    const task = buildTaskFromGap(gap);
    tasks.push(task);
  }

  return tasks;
}

/**
 * Build a single task from a gap
 */
export function buildTaskFromGap(gap: Gap): Task {
  const definitionOfDone = generateDefinitionOfDone(gap);
  const subtasks = generateSubtasks(gap);

  return {
    id: gap.id,
    title: gap.title,
    description: gap.description,
    status: 'pending' as TaskStatus,
    priority: gap.priority,
    effort: gap.effort,
    estimatedDays: gap.estimatedDays,
    estimatedWeeks: gap.estimatedWeeks,
    dependencies: gap.dependencies,
    owner: undefined,
    definitionOfDone,
    subtasks,
    riskLevel: gap.riskLevel,
    category: gap.category,
  };
}

/**
 * Generate Definition of Done for a gap
 */
function generateDefinitionOfDone(gap: Gap): string[] {
  const dod: string[] = [];

  if (gap.category === 'Security') {
    dod.push('Security vulnerability fixed');
    dod.push('Security tests passing');
    dod.push('Code review completed');
    dod.push('Security audit passed');
  } else if (gap.category === 'Testing') {
    dod.push('Test coverage target met');
    dod.push('All tests passing');
    dod.push('Coverage report generated');
    dod.push('CI/CD integration verified');
  } else if (gap.category === 'Performance') {
    dod.push('Performance target met');
    dod.push('Performance tests passing');
    dod.push('Metrics documented');
    dod.push('Performance review completed');
  } else if (gap.category === 'Production Readiness') {
    dod.push('Production readiness criteria met');
    dod.push('Deployment tested');
    dod.push('Documentation updated');
    dod.push('Monitoring configured');
  } else {
    dod.push('Task completed');
    dod.push('Code reviewed');
    dod.push('Tests passing');
    dod.push('Documentation updated');
  }

  // Add metric-specific DoD
  if (typeof gap.currentValue === 'number' && typeof gap.targetValue === 'number') {
    dod.push(`Target value of ${gap.targetValue} achieved`);
  }

  return dod;
}

/**
 * Generate subtasks for a gap
 */
function generateSubtasks(gap: Gap): Task[] | undefined {
  const subtasks: Task[] = [];

  if (gap.category === 'Security') {
    if (gap.title.toLowerCase().includes('jwt')) {
      subtasks.push({
        id: `${gap.id}-subtask-1`,
        title: 'Verify JWT algorithm whitelist enforcement',
        description: 'Test that unsigned tokens are rejected',
        status: 'pending',
        priority: 'CRITICAL',
        effort: '1 day',
        estimatedDays: 1,
        estimatedWeeks: 0.14,
        dependencies: [],
        definitionOfDone: ['Algorithm whitelist verified', 'Tests written'],
        riskLevel: 'CRITICAL',
        category: gap.category,
      });
      subtasks.push({
        id: `${gap.id}-subtask-2`,
        title: 'Add security tests',
        description: 'Add integration tests for JWT security',
        status: 'pending',
        priority: 'HIGH',
        effort: '2 days',
        estimatedDays: 2,
        estimatedWeeks: 0.29,
        dependencies: [`${gap.id}-subtask-1`],
        definitionOfDone: ['Security tests added', 'All tests passing'],
        riskLevel: 'HIGH',
        category: gap.category,
      });
    } else if (gap.title.toLowerCase().includes('bcrypt')) {
      subtasks.push({
        id: `${gap.id}-subtask-1`,
        title: 'Upgrade bcrypt to 6.0.0',
        description: 'Update package.json and test compatibility',
        status: 'pending',
        priority: 'HIGH',
        effort: '1 day',
        estimatedDays: 1,
        estimatedWeeks: 0.14,
        dependencies: [],
        definitionOfDone: ['bcrypt upgraded', 'All tests passing'],
        riskLevel: 'HIGH',
        category: gap.category,
      });
    }
  } else if (gap.category === 'Testing') {
    subtasks.push({
      id: `${gap.id}-subtask-1`,
      title: 'Add unit tests',
      description: 'Increase unit test coverage',
      status: 'pending',
      priority: gap.priority,
      effort: '1 week',
      estimatedDays: 7,
      estimatedWeeks: 1,
      dependencies: [],
      definitionOfDone: ['Unit tests added', 'Coverage increased'],
      riskLevel: gap.riskLevel,
      category: gap.category,
    });
    subtasks.push({
      id: `${gap.id}-subtask-2`,
      title: 'Add integration tests',
      description: 'Add integration tests for critical paths',
      status: 'pending',
      priority: gap.priority,
      effort: '1 week',
      estimatedDays: 7,
      estimatedWeeks: 1,
      dependencies: [`${gap.id}-subtask-1`],
      definitionOfDone: ['Integration tests added', 'All tests passing'],
      riskLevel: gap.riskLevel,
      category: gap.category,
    });
  }

  return subtasks.length > 0 ? subtasks : undefined;
}

/**
 * Group tasks by category
 */
export function groupTasksByCategory(tasks: Task[]): {
  [category: string]: Task[];
} {
  const grouped: { [category: string]: Task[] } = {};

  for (const task of tasks) {
    if (!grouped[task.category]) {
      grouped[task.category] = [];
    }
    grouped[task.category].push(task);
  }

  return grouped;
}

/**
 * Sort tasks by priority
 */
export function sortTasksByPriority(tasks: Task[]): Task[] {
  const priorityOrder: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

  return [...tasks].sort((a, b) => {
    const aIndex = priorityOrder.indexOf(a.priority);
    const bIndex = priorityOrder.indexOf(b.priority);
    return aIndex - bIndex;
  });
}
