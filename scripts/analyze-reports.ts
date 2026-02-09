#!/usr/bin/env ts-node

/**
 * Main script to analyze project reports
 */

import { CLI } from '../src/analysis/cli';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options: {
    inputDir?: string;
    outputDir?: string;
    reports?: string[];
    verbose?: boolean;
  } = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--input' || arg === '-i') {
      options.inputDir = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      options.outputDir = args[++i];
    } else if (arg === '--reports' || arg === '-r') {
      options.reports = args[++i].split(',');
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  const cli = new CLI();
  await cli.run(options);
}

function printHelp(): void {
  console.log(`
Hệ thống Phân tích Tự động Báo cáo Dự án

Usage:
  npm run analyze-reports [options]

Options:
  -i, --input <dir>     Thư mục chứa các báo cáo (default: current directory)
  -o, --output <dir>    Thư mục lưu kết quả (default: reports/analysis)
  -r, --reports <files> Danh sách file báo cáo, phân cách bởi dấu phẩy
  -v, --verbose         Hiển thị thông tin chi tiết
  -h, --help            Hiển thị help này

Examples:
  npm run analyze-reports
  npm run analyze-reports -- --input ./docs --output ./reports
  npm run analyze-reports -- --reports REPORT1.md,REPORT2.md
`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}
