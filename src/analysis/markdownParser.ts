/**
 * Markdown parsing utilities for report analysis
 */

import {
  ReportSection,
  CheckboxItem,
  TableData,
  Metric,
} from './types';

/**
 * Parse markdown content into structured sections
 */
export function parseMarkdownSections(content: string): ReportSection[] {
  const lines = content.split('\n');
  const sections: ReportSection[] = [];
  const stack: ReportSection[] = [];

  let currentSection: ReportSection | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for headers
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();

      // Close current section if exists
      if (currentSection) {
        currentSection.content = currentSection.content.trim();
      }

      // Create new section
      const newSection: ReportSection = {
        title,
        level,
        content: '',
        subsections: [],
        checkboxes: [],
        tables: [],
        metrics: [],
      };

      // Find parent section
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (stack.length === 0) {
        sections.push(newSection);
      } else {
        stack[stack.length - 1].subsections.push(newSection);
      }

      stack.push(newSection);
      currentSection = newSection;
      continue;
    }

    // Add content to current section
    if (currentSection) {
      if (currentSection.content) {
        currentSection.content += '\n' + line;
      } else {
        currentSection.content = line;
      }
    }
  }

  // Close last section
  if (currentSection) {
    currentSection.content = currentSection.content.trim();
  }

  return sections;
}

/**
 * Extract checkboxes from content
 */
export function extractCheckboxes(content: string): CheckboxItem[] {
  const lines = content.split('\n');
  const checkboxes: CheckboxItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const checkboxMatch = line.match(/^(\s*)[-*]\s+(\[[\sxX]\])\s+(.+)$/);
    if (checkboxMatch) {
      const checked = checkboxMatch[2].toLowerCase() === '[x]';
      const text = checkboxMatch[3].trim();
      checkboxes.push({
        checked,
        text,
        lineNumber: i + 1,
      });
    }
  }

  return checkboxes;
}

/**
 * Extract tables from content
 */
export function extractTables(content: string): TableData[] {
  const lines = content.split('\n');
  const tables: TableData[] = [];
  let currentTable: TableData | null = null;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if line is a table row (contains |)
    if (trimmed.includes('|') && trimmed.split('|').length > 2) {
      const cells = trimmed
        .split('|')
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);

      // Check if it's a header separator (contains ---)
      if (cells.some((cell) => /^-+$/.test(cell))) {
        inTable = true;
        continue;
      }

      if (!inTable && currentTable === null) {
        // Start new table
        currentTable = {
          headers: cells,
          rows: [],
        };
      } else if (inTable && currentTable) {
        // Add data row
        currentTable.rows.push(cells);
      }
    } else {
      // End of table
      if (currentTable && currentTable.rows.length > 0) {
        tables.push(currentTable);
      }
      currentTable = null;
      inTable = false;
    }
  }

  // Add last table if exists
  if (currentTable && currentTable.rows.length > 0) {
    tables.push(currentTable);
  }

  return tables;
}

/**
 * Extract metrics from content
 */
export function extractMetrics(content: string): Metric[] {
  const metrics: Metric[] = [];

  // Pattern 1: Table format with metrics
  const tablePattern = /\|(.+?)\|/g;
  const lines = content.split('\n');

  for (const line of lines) {
    if (!line.includes('|')) continue;

    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);

  // Look for metric patterns in table rows
  // Only process tables with metric-like headers
  if (cells.length >= 3) {
    const metricName = cells[0].trim();
    const currentValue = cells[1].trim();
    const targetValue = cells[2].trim();
    const status = cells[3] || '';

    // Filter out non-metric rows
    const metricKeywords = [
      'coverage', 'compliance', 'score', 'readiness', 'completion',
      'vulnerabilities', 'errors', 'warnings', 'quality', 'performance'
    ];
    const isMetricRow = metricKeywords.some(keyword => 
      metricName.toLowerCase().includes(keyword)
    );

    if (!isMetricRow) {
      // Skip rows that don't look like metrics
      continue;
    }

    // Try to parse as number
    const currentNum = parseFloat(currentValue.replace(/[%,]/g, ''));
    const targetNum = parseFloat(targetValue.replace(/[%,]/g, ''));

    // Validate values are reasonable
    if (!isNaN(currentNum) && !isNaN(targetNum) && 
        currentNum >= 0 && currentNum <= 1000 &&
        targetNum >= 0 && targetNum <= 1000) {
      
      let statusValue: Metric['status'] = 'needs_measurement';
      if (status.includes('✅') || status.includes('On Target') || status.includes('on_target')) {
        statusValue = 'on_target';
      } else if (status.includes('⚠️') || status.includes('Below Target') || status.includes('below_target')) {
        statusValue = 'below_target';
      } else if (status.includes('Above Target') || status.includes('above_target')) {
        statusValue = 'above_target';
      }

      // Avoid duplicates
      const exists = metrics.some((m) => 
        m.name.toLowerCase() === metricName.toLowerCase()
      );

      if (!exists) {
        metrics.push({
          name: metricName,
          current: currentNum,
          target: targetNum,
          status: statusValue,
        });
      }
    }
  }
  }

  // Pattern 2: Text format like "Test Coverage: 43.5% (target: 80%+)"
  // Only match known metric patterns to avoid false positives
  const knownMetricPatterns = [
    /(?:Test\s+)?Coverage[:\s]+([\d.]+)%?\s*(?:\(target:\s*([\d.]+)%?\))?/gi,
    /OWASP\s+[Cc]ompliance[:\s]+([\d.]+)%?\s*(?:\(target:\s*([\d.]+)%?\))?/gi,
    /Security\s+[Ss]core[:\s]+([A-Z+]+)\s*(?:\(target:\s*([A-Z+]+)\))?/gi,
    /Production\s+[Rr]eadiness[:\s]+([\d.]+)%?\s*(?:\(target:\s*([\d.]+)%?\))?/gi,
    /(?:Overall\s+)?[Cc]ompletion[:\s]+([\d.]+)%?\s*(?:\(target:\s*([\d.]+)%?\))?/gi,
  ];

  for (const pattern of knownMetricPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const currentStr = match[1];
      const targetStr = match[2] || '100';
      
      // Handle letter grades (A+, B, etc.)
      if (/^[A-F][+-]?$/.test(currentStr)) {
        const gradeMap: { [key: string]: number } = {
          'A+': 95, 'A': 90, 'A-': 87,
          'B+': 87, 'B': 83, 'B-': 80,
          'C+': 77, 'C': 73, 'C-': 70,
        };
        const current = gradeMap[currentStr] || 70;
        const target = gradeMap[targetStr] || 90;
        
        if (!metrics.some((m) => m.name.toLowerCase().includes('security score'))) {
          metrics.push({
            name: 'Security Score',
            current,
            target,
            unit: '%',
            status: current >= target ? 'on_target' : 'below_target',
          });
        }
      } else {
        // Handle numeric values
        const current = parseFloat(currentStr);
        const target = parseFloat(targetStr);
        
        if (!isNaN(current) && !isNaN(target) && current >= 0 && current <= 1000) {
          // Filter out obvious false positives
          if (current > 1000 || target > 1000) continue;
          
          let metricName = 'Unknown Metric';
          if (pattern.source.includes('Coverage')) {
            metricName = 'Test Coverage';
          } else if (pattern.source.includes('OWASP')) {
            metricName = 'OWASP Compliance';
          } else if (pattern.source.includes('Production')) {
            metricName = 'Production Readiness';
          } else if (pattern.source.includes('Completion')) {
            metricName = 'Overall Completion';
          }
          
          // Check if metric already exists
          const exists = metrics.some((m) => 
            m.name.toLowerCase() === metricName.toLowerCase()
          );
          if (!exists) {
            metrics.push({
              name: metricName,
              current,
              target,
              unit: '%',
              status: current >= target ? 'on_target' : 'below_target',
            });
          }
        }
      }
    }
  }

  return metrics;
}

/**
 * Extract completed items (✅ or [x])
 */
export function extractCompletedItems(content: string): Array<{
  description: string;
  category: string;
}> {
  const items: Array<{ description: string; category: string }> = [];
  const lines = content.split('\n');

  let currentCategory = 'General';

  for (const line of lines) {
    // Check for category headers
    const categoryMatch = line.match(/^#{2,4}\s+(.+)$/);
    if (categoryMatch) {
      currentCategory = categoryMatch[1].trim();
    }

    // Check for completed items
    if (line.includes('✅') || line.match(/^[-*]\s+\[x\]/i)) {
      const description = line
        .replace(/✅/g, '')
        .replace(/^[-*]\s+\[x\]\s*/i, '')
        .trim();
      if (description) {
        items.push({
          description,
          category: currentCategory,
        });
      }
    }
  }

  return items;
}

/**
 * Extract pending items (⚠️ or [ ])
 */
export function extractPendingItems(content: string): Array<{
  description: string;
  category: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}> {
  const items: Array<{
    description: string;
    category: string;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  }> = [];
  const lines = content.split('\n');

  let currentCategory = 'General';

  for (const line of lines) {
    // Check for category headers
    const categoryMatch = line.match(/^#{2,4}\s+(.+)$/);
    if (categoryMatch) {
      currentCategory = categoryMatch[1].trim();
    }

    // Check for pending items
    if (line.includes('⚠️') || line.match(/^[-*]\s+\[\s\]/)) {
      const description = line
        .replace(/⚠️/g, '')
        .replace(/^[-*]\s+\[\s\]\s*/, '')
        .trim();

      // Determine priority from context
      let priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
      const upperLine = line.toUpperCase();
      if (upperLine.includes('CRITICAL') || upperLine.includes('🔴')) {
        priority = 'CRITICAL';
      } else if (upperLine.includes('HIGH') || upperLine.includes('🟡')) {
        priority = 'HIGH';
      } else if (upperLine.includes('LOW') || upperLine.includes('🟢')) {
        priority = 'LOW';
      }

      if (description) {
        items.push({
          description,
          category: currentCategory,
          priority,
        });
      }
    }
  }

  return items;
}
