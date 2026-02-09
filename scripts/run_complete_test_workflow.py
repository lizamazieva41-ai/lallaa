#!/usr/bin/env python3
"""
Complete Test Execution Workflow
Integrate tất cả components: test execution, logging, bug analysis, và reporting
"""

import sys
import argparse
from pathlib import Path
from datetime import datetime
import json

# Add scripts directory to path
scripts_dir = Path(__file__).parent
sys.path.insert(0, str(scripts_dir))

from execute_tests_with_logging import EnhancedTestExecutor, setup_test_logging
from bug_analyzer import analyze_test_results
from log_aggregator import aggregate_logs
from generate_comprehensive_report import ComprehensiveReportGenerator


def run_complete_workflow(
    project_root: Path,
    phases: list,
    fail_fast: bool = False,
    generate_reports: bool = True,
    log_dir: str = './logs/test_execution'
) -> dict:
    """Run complete test workflow"""
    print("="*80)
    print("COMPLETE TEST EXECUTION WORKFLOW")
    print("="*80)
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Step 1: Setup logging
    print("Step 1: Setting up logging...")
    logger = setup_test_logging(
        log_dir=str(project_root / log_dir),
        service_name='test_workflow'
    )
    logger.get_logger().info("Starting complete test workflow")
    
    # Step 2: Execute tests
    print("\nStep 2: Executing tests...")
    executor = EnhancedTestExecutor(project_root, logger)
    test_results = executor.run_all_phases(phases, fail_fast=fail_fast)
    
    # Save test results
    results_file = project_root / 'reports' / 'test_results' / 'test_execution_results.json'
    results_file.parent.mkdir(parents=True, exist_ok=True)
    with open(results_file, 'w') as f:
        json.dump(test_results, f, indent=2, default=str)
    
    print(f"Test execution completed. Results saved to {results_file}")
    
    # Step 3: Analyze bugs
    print("\nStep 3: Analyzing bugs...")
    try:
        bug_report = analyze_test_results(str(results_file))
        
        # Save bug report
        bug_report_file = project_root / 'reports' / 'bug_analysis' / 'bug_report.json'
        bug_report_file.parent.mkdir(parents=True, exist_ok=True)
        with open(bug_report_file, 'w') as f:
            json.dump(bug_report, f, indent=2, default=str)
        
        print(f"Bug analysis completed. Report saved to {bug_report_file}")
        print(f"Total bugs found: {bug_report.get('total_bugs', 0)}")
    except Exception as e:
        print(f"Error analyzing bugs: {e}")
        bug_report = None
        bug_report_file = None
    
    # Step 4: Aggregate logs
    print("\nStep 4: Aggregating logs...")
    try:
        log_summary = aggregate_logs(
            log_dir=str(project_root / log_dir),
            output_file=str(project_root / 'reports' / 'log_analysis' / 'log_summary.json')
        )
        log_summary_file = project_root / 'reports' / 'log_analysis' / 'log_summary.json'
        print(f"Log aggregation completed. Summary saved to {log_summary_file}")
    except Exception as e:
        print(f"Error aggregating logs: {e}")
        log_summary = None
        log_summary_file = None
    
    # Step 5: Generate comprehensive reports
    if generate_reports:
        print("\nStep 5: Generating comprehensive reports...")
        try:
            generator = ComprehensiveReportGenerator(project_root)
            generator.generate_report(
                test_results_file=str(results_file),
                bug_report_file=str(bug_report_file) if bug_report_file else None,
                log_summary_file=str(log_summary_file) if log_summary_file else None
            )
            print("Comprehensive reports generated successfully")
        except Exception as e:
            print(f"Error generating reports: {e}")
    
    # Summary
    print("\n" + "="*80)
    print("WORKFLOW SUMMARY")
    print("="*80)
    print(f"Total Phases: {test_results['summary']['total']}")
    print(f"Passed: {test_results['summary']['passed']}")
    print(f"Failed: {test_results['summary']['failed']}")
    print(f"Total Tests: {test_results['summary'].get('total_tests', 0)}")
    if bug_report:
        print(f"Total Bugs: {bug_report.get('total_bugs', 0)}")
        severity = bug_report.get('severity_distribution', {})
        print(f"  - Critical: {severity.get('critical', 0)}")
        print(f"  - High: {severity.get('high', 0)}")
        print(f"  - Medium: {severity.get('medium', 0)}")
        print(f"  - Low: {severity.get('low', 0)}")
    print(f"Duration: {test_results['summary'].get('duration', 0):.2f}s")
    print("="*80)
    
    return {
        'test_results': test_results,
        'bug_report': bug_report,
        'log_summary': log_summary,
        'success': test_results['summary']['failed'] == 0
    }


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Run complete test execution workflow')
    parser.add_argument('--all', action='store_true', help='Run all phases')
    parser.add_argument('--phase', type=int, help='Run specific phase only')
    parser.add_argument('--fail-fast', action='store_true', help='Stop on first failure')
    parser.add_argument('--no-reports', action='store_true', help='Skip report generation')
    parser.add_argument('--log-dir', type=str, default='./logs/test_execution', help='Log directory')
    
    args = parser.parse_args()
    
    project_root = Path(__file__).parent.parent
    
    # Define test phases
    phases = [
        {'number': 1, 'name': 'Infrastructure & Core Services', 'path': 'unit'},
        {'number': 2, 'name': 'Authentication & Authorization', 'path': 'integration'},
        {'number': 3, 'name': 'Security Scanning', 'path': 'integration/security'},
        {'number': 4, 'name': 'Card Verification & Data Processing', 'path': 'integration'},
        {'number': 5, 'name': 'Multi-Platform Integration', 'path': 'integration'},
        {'number': 6, 'name': 'Web Automation & AI', 'path': 'integration'},
        {'number': 7, 'name': 'Monitoring & Observability', 'path': 'performance'},
        {'number': 8, 'name': 'API Endpoints & E2E Workflows', 'path': 'integration'},
    ]
    
    if args.phase:
        # Run specific phase
        phase_info = next((p for p in phases if p['number'] == args.phase), None)
        if phase_info:
            phases = [phase_info]
        else:
            print(f"Error: Phase {args.phase} not found")
            sys.exit(1)
    elif not args.all:
        parser.print_help()
        sys.exit(1)
    
    try:
        result = run_complete_workflow(
            project_root=project_root,
            phases=phases,
            fail_fast=args.fail_fast,
            generate_reports=not args.no_reports,
            log_dir=args.log_dir
        )
        
        sys.exit(0 if result['success'] else 1)
    except Exception as e:
        print(f"Error in workflow: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
