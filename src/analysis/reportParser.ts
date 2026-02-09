/**
 * Report Parser - Main parser for project reports
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ParsedReport,
  ReportSection,
  CheckboxItem,
  TableData,
  Metric,
  CompletedItem,
  PendingItem,
  Priority,
} from './types';
import { IReportParser } from './interfaces';
import {
  parseMarkdownSections,
  extractCheckboxes,
  extractTables,
  extractMetrics,
  extractCompletedItems,
  extractPendingItems,
} from './markdownParser';

export class ReportParser implements IReportParser {
  /**
   * Parse a markdown report file
   */
  async parseReport(filePath: string): Promise<ParsedReport> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const filename = path.basename(filePath);
    return this.parseMarkdown(content, filename);
  }

  /**
   * Parse markdown content
   */
  parseMarkdown(content: string, filename: string): ParsedReport {
    // Extract title from first H1 or filename
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : filename.replace('.md', '');

    // Remove the title line from content for section parsing
    const contentWithoutTitle = content.replace(/^#\s+(.+)$/m, '');

    // Parse sections
    const sections = parseMarkdownSections(contentWithoutTitle);

    // Extract all checkboxes from entire content
    const allCheckboxes = extractCheckboxes(contentWithoutTitle);

    // Extract all tables from entire content
    const allTables = extractTables(contentWithoutTitle);

    // Extract all metrics from entire content
    const allMetrics = extractMetrics(contentWithoutTitle);

    // Set checkboxes, tables, metrics for sections
    const setSectionData = (section: ReportSection): void => {
      section.checkboxes = extractCheckboxes(section.content);
      section.tables = extractTables(section.content);
      section.metrics = extractMetrics(section.content);
      section.subsections.forEach(setSectionData);
    };
    sections.forEach(setSectionData);

    // Extract completed items
    const completedItemsRaw = extractCompletedItems(content);
    const completedItems: CompletedItem[] = completedItemsRaw.map((item, index) => ({
      id: `completed-${index + 1}`,
      description: item.description,
      category: item.category,
    }));

    // Extract pending items
    const pendingItemsRaw = extractPendingItems(content);
    const pendingItems: PendingItem[] = pendingItemsRaw.map((item, index) => ({
      id: `pending-${index + 1}`,
      description: item.description,
      category: item.category,
      priority: item.priority,
    }));

    return {
      filename,
      title,
      sections,
      allCheckboxes,
      allTables,
      allMetrics,
      completedItems,
      pendingItems,
    };
  }

  /**
   * Parse multiple report files
   */
  async parseReports(filePaths: string[]): Promise<ParsedReport[]> {
    const reports: ParsedReport[] = [];
    for (const filePath of filePaths) {
      try {
        const report = await this.parseReport(filePath);
        reports.push(report);
      } catch (error) {
        console.error(`Error parsing ${filePath}:`, error);
      }
    }
    return reports;
  }

  /**
   * Find all report files in a directory
   */
  async findReportFiles(directory: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isFile() && entry.name.endsWith('.md')) {
        // Check if it's a report file (contains common report patterns)
        const content = await fs.promises.readFile(fullPath, 'utf-8');
        if (
          content.includes('Báo Cáo') ||
          content.includes('Report') ||
          content.includes('Analysis') ||
          content.includes('Assessment') ||
          entry.name.toUpperCase().includes('REPORT') ||
          entry.name.toUpperCase().includes('ANALYSIS')
        ) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }
}
