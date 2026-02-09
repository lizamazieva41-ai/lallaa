#!/usr/bin/env python3
"""
Comprehensive Report Generator
Generate detailed reports với bug analysis, performance metrics, và recommendations
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
import argparse

# Add scripts directory to path
scripts_dir = Path(__file__).parent
sys.path.insert(0, str(scripts_dir))

from bug_analyzer import analyze_test_results
from log_aggregator import aggregate_logs


class ComprehensiveReportGenerator:
    """Generate comprehensive test reports"""
    
    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.reports_dir = project_root / 'reports' / 'comprehensive'
        self.reports_dir.mkdir(parents=True, exist_ok=True)
    
    def load_test_results(self, results_file: str) -> Dict[str, Any]:
        """Load test results từ file"""
        results_path = Path(results_file)
        if not results_path.exists():
            raise FileNotFoundError(f"Test results file not found: {results_file}")
        
        with open(results_path, 'r') as f:
            return json.load(f)
    
    def generate_executive_summary(
        self,
        test_results: Dict[str, Any],
        bug_report: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate executive summary"""
        summary = test_results.get('summary', {})
        total_phases = summary.get('total', 0)
        passed_phases = summary.get('passed', 0)
        failed_phases = summary.get('failed', 0)
        total_tests = summary.get('total_tests', 0)
        
        total_bugs = bug_report.get('total_bugs', 0)
        severity_dist = bug_report.get('severity_distribution', {})
        critical_bugs = severity_dist.get('critical', 0)
        high_bugs = severity_dist.get('high', 0)
        
        # Calculate pass rate
        pass_rate = (passed_phases / total_phases * 100) if total_phases > 0 else 0
        
        # Overall status
        if failed_phases == 0 and total_bugs == 0:
            overall_status = 'PASSED'
        elif critical_bugs > 0 or high_bugs > 5:
            overall_status = 'CRITICAL'
        elif failed_phases > 0 or total_bugs > 0:
            overall_status = 'FAILED'
        else:
            overall_status = 'WARNING'
        
        return {
            'overall_status': overall_status,
            'total_phases': total_phases,
            'passed_phases': passed_phases,
            'failed_phases': failed_phases,
            'pass_rate': f'{pass_rate:.1f}%',
            'total_tests': total_tests,
            'total_bugs': total_bugs,
            'critical_bugs': critical_bugs,
            'high_bugs': high_bugs,
            'medium_bugs': severity_dist.get('medium', 0),
            'low_bugs': severity_dist.get('low', 0),
            'execution_time': test_results.get('total_duration', 0),
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def generate_bug_analysis_report(self, bug_report: Dict[str, Any]) -> Dict[str, Any]:
        """Generate detailed bug analysis report"""
        bugs = bug_report.get('bugs', [])
        stack_traces = bug_report.get('stack_traces', [])
        classified_bugs = bug_report.get('classified_bugs', {})
        patterns = bug_report.get('patterns', {})
        severity_dist = bug_report.get('severity_distribution', {})
        
        # Group bugs by phase
        bugs_by_phase = {}
        for bug in bugs:
            phase = bug.get('phase', 0)
            if phase not in bugs_by_phase:
                bugs_by_phase[phase] = []
            bugs_by_phase[phase].append(bug)
        
        # Top bugs by severity
        critical_bugs = [b for b in bugs if b.get('severity') == 'critical']
        high_bugs = [b for b in bugs if b.get('severity') == 'high']
        
        return {
            'total_bugs': len(bugs),
            'severity_distribution': severity_dist,
            'bugs_by_phase': bugs_by_phase,
            'critical_bugs': critical_bugs[:10],  # Top 10 critical
            'high_bugs': high_bugs[:10],  # Top 10 high
            'classified_bugs': classified_bugs,
            'patterns': patterns,
            'stack_traces': stack_traces,
            'bug_details': bugs
        }
    
    def generate_performance_analysis(
        self,
        test_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate performance analysis"""
        phases = test_results.get('phases', [])
        
        performance_data = {
            'total_duration': test_results.get('total_duration', 0),
            'phase_performance': [],
            'average_phase_duration': 0,
            'slowest_phase': None,
            'fastest_phase': None,
            'memory_usage': [],
            'cpu_usage': []
        }
        
        phase_durations = []
        
        for phase in phases:
            phase_num = phase.get('phase', 0)
            duration = phase.get('duration', 0)
            metrics = phase.get('performance_metrics', {})
            
            phase_durations.append(duration)
            
            phase_perf = {
                'phase': phase_num,
                'name': phase.get('name', 'Unknown'),
                'duration': duration,
                'test_count': phase.get('test_count', 0),
                'memory_mb': metrics.get('final', {}).get('memory_mb', 0),
                'cpu_percent': metrics.get('final', {}).get('cpu_percent', 0)
            }
            
            performance_data['phase_performance'].append(phase_perf)
            
            # Track memory and CPU
            if metrics.get('final'):
                performance_data['memory_usage'].append({
                    'phase': phase_num,
                    'memory_mb': metrics['final'].get('memory_mb', 0)
                })
                performance_data['cpu_usage'].append({
                    'phase': phase_num,
                    'cpu_percent': metrics['final'].get('cpu_percent', 0)
                })
        
        if phase_durations:
            performance_data['average_phase_duration'] = sum(phase_durations) / len(phase_durations)
            
            # Find slowest and fastest
            slowest = max(performance_data['phase_performance'], key=lambda x: x['duration'])
            fastest = min(performance_data['phase_performance'], key=lambda x: x['duration'])
            
            performance_data['slowest_phase'] = {
                'phase': slowest['phase'],
                'name': slowest['name'],
                'duration': slowest['duration']
            }
            performance_data['fastest_phase'] = {
                'phase': fastest['phase'],
                'name': fastest['name'],
                'duration': fastest['duration']
            }
        
        return performance_data
    
    def generate_recommendations(
        self,
        test_results: Dict[str, Any],
        bug_report: Dict[str, Any],
        log_summary: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Generate recommendations"""
        recommendations = []
        
        # Bug-based recommendations
        bugs = bug_report.get('bugs', [])
        critical_bugs = [b for b in bugs if b.get('severity') == 'critical']
        high_bugs = [b for b in bugs if b.get('severity') == 'high']
        
        if critical_bugs:
            recommendations.append({
                'priority': 'CRITICAL',
                'category': 'Bugs',
                'title': 'Fix Critical Bugs',
                'description': f'There are {len(critical_bugs)} critical bugs that need immediate attention',
                'actions': [
                    f'Review {len(critical_bugs)} critical bugs',
                    'Prioritize fixes based on impact',
                    'Add tests to prevent regression'
                ]
            })
        
        if high_bugs:
            recommendations.append({
                'priority': 'HIGH',
                'category': 'Bugs',
                'title': 'Address High Severity Bugs',
                'description': f'There are {len(high_bugs)} high severity bugs',
                'actions': [
                    f'Review {len(high_bugs)} high severity bugs',
                    'Plan fixes for next sprint',
                    'Monitor for patterns'
                ]
            })
        
        # Phase failure recommendations
        summary = test_results.get('summary', {})
        failed_phases = summary.get('failed', 0)
        
        if failed_phases > 0:
            recommendations.append({
                'priority': 'HIGH',
                'category': 'Test Execution',
                'title': 'Investigate Failed Phases',
                'description': f'{failed_phases} phase(s) failed during execution',
                'actions': [
                    'Review phase execution logs',
                    'Check for infrastructure issues',
                    'Verify test environment setup'
                ]
            })
        
        # Performance recommendations
        performance = self.generate_performance_analysis(test_results)
        slowest = performance.get('slowest_phase')
        
        if slowest and slowest['duration'] > 300:  # More than 5 minutes
            recommendations.append({
                'priority': 'MEDIUM',
                'category': 'Performance',
                'title': 'Optimize Slow Test Phase',
                'description': f"Phase {slowest['phase']} ({slowest['name']}) took {slowest['duration']:.1f}s",
                'actions': [
                    'Review test execution time',
                    'Consider parallel execution',
                    'Optimize slow tests'
                ]
            })
        
        # Pattern-based recommendations
        patterns = bug_report.get('patterns', {})
        common_errors = patterns.get('common_errors', [])
        
        if common_errors:
            top_error = common_errors[0] if common_errors else None
            if top_error and top_error.get('count', 0) > 3:
                recommendations.append({
                    'priority': 'MEDIUM',
                    'category': 'Patterns',
                    'title': 'Address Recurring Error Pattern',
                    'description': f"Error '{top_error.get('error', 'Unknown')}' occurred {top_error.get('count')} times",
                    'actions': [
                        'Investigate root cause',
                        'Add preventive measures',
                        'Update error handling'
                    ]
                })
        
        return recommendations
    
    def generate_html_report(
        self,
        executive_summary: Dict[str, Any],
        bug_analysis: Dict[str, Any],
        performance_analysis: Dict[str, Any],
        recommendations: List[Dict[str, Any]],
        test_results: Dict[str, Any]
    ) -> str:
        """Generate HTML report"""
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comprehensive Test Report - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        h1 {{
            color: #333;
            border-bottom: 3px solid #4CAF50;
            padding-bottom: 10px;
        }}
        h2 {{
            color: #555;
            margin-top: 30px;
            border-bottom: 2px solid #ddd;
            padding-bottom: 5px;
        }}
        .status {{
            display: inline-block;
            padding: 5px 15px;
            border-radius: 4px;
            font-weight: bold;
            margin: 10px 0;
        }}
        .status.PASSED {{
            background-color: #4CAF50;
            color: white;
        }}
        .status.FAILED {{
            background-color: #f44336;
            color: white;
        }}
        .status.CRITICAL {{
            background-color: #d32f2f;
            color: white;
        }}
        .status.WARNING {{
            background-color: #ff9800;
            color: white;
        }}
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }}
        .summary-card {{
            background-color: #f9f9f9;
            padding: 15px;
            border-radius: 4px;
            border-left: 4px solid #4CAF50;
        }}
        .summary-card h3 {{
            margin: 0 0 10px 0;
            color: #666;
            font-size: 14px;
        }}
        .summary-card .value {{
            font-size: 24px;
            font-weight: bold;
            color: #333;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background-color: #4CAF50;
            color: white;
        }}
        tr:hover {{
            background-color: #f5f5f5;
        }}
        .bug-severity {{
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
        }}
        .severity-critical {{
            background-color: #d32f2f;
            color: white;
        }}
        .severity-high {{
            background-color: #f44336;
            color: white;
        }}
        .severity-medium {{
            background-color: #ff9800;
            color: white;
        }}
        .severity-low {{
            background-color: #ffc107;
            color: #333;
        }}
        .recommendation {{
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
        }}
        .recommendation.critical {{
            background-color: #f8d7da;
            border-left-color: #d32f2f;
        }}
        .recommendation.high {{
            background-color: #fff3cd;
            border-left-color: #f44336;
        }}
        .code-block {{
            background-color: #f4f4f4;
            padding: 10px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
            overflow-x: auto;
            white-space: pre-wrap;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Comprehensive Test Execution Report</h1>
        <p>Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        
        <h2>Executive Summary</h2>
        <div class="status {executive_summary.get('overall_status', 'UNKNOWN')}">
            {executive_summary.get('overall_status', 'UNKNOWN')}
        </div>
        
        <div class="summary-grid">
            <div class="summary-card">
                <h3>Total Phases</h3>
                <div class="value">{executive_summary.get('total_phases', 0)}</div>
            </div>
            <div class="summary-card">
                <h3>Passed Phases</h3>
                <div class="value">{executive_summary.get('passed_phases', 0)}</div>
            </div>
            <div class="summary-card">
                <h3>Failed Phases</h3>
                <div class="value">{executive_summary.get('failed_phases', 0)}</div>
            </div>
            <div class="summary-card">
                <h3>Total Tests</h3>
                <div class="value">{executive_summary.get('total_tests', 0)}</div>
            </div>
            <div class="summary-card">
                <h3>Total Bugs</h3>
                <div class="value">{executive_summary.get('total_bugs', 0)}</div>
            </div>
            <div class="summary-card">
                <h3>Critical Bugs</h3>
                <div class="value">{executive_summary.get('critical_bugs', 0)}</div>
            </div>
        </div>
        
        <h2>Bug Analysis</h2>
        <h3>Severity Distribution</h3>
        <table>
            <tr>
                <th>Severity</th>
                <th>Count</th>
            </tr>
            <tr>
                <td><span class="bug-severity severity-critical">Critical</span></td>
                <td>{bug_analysis.get('severity_distribution', {}).get('critical', 0)}</td>
            </tr>
            <tr>
                <td><span class="bug-severity severity-high">High</span></td>
                <td>{bug_analysis.get('severity_distribution', {}).get('high', 0)}</td>
            </tr>
            <tr>
                <td><span class="bug-severity severity-medium">Medium</span></td>
                <td>{bug_analysis.get('severity_distribution', {}).get('medium', 0)}</td>
            </tr>
            <tr>
                <td><span class="bug-severity severity-low">Low</span></td>
                <td>{bug_analysis.get('severity_distribution', {}).get('low', 0)}</td>
            </tr>
        </table>
        
        <h3>Critical Bugs</h3>
        <table>
            <tr>
                <th>Test Name</th>
                <th>Phase</th>
                <th>Error Type</th>
                <th>Root Cause</th>
            </tr>
"""
        
        for bug in bug_analysis.get('critical_bugs', [])[:10]:
            root_cause = bug.get('root_cause', {}).get('primary', {})
            html += f"""
            <tr>
                <td>{bug.get('test_name', 'Unknown')}</td>
                <td>{bug.get('phase', 'N/A')}</td>
                <td>{bug.get('error_type', 'Unknown')}</td>
                <td>{root_cause.get('cause', 'Unknown')}</td>
            </tr>
"""
        
        html += """
        </table>
        
        <h2>Performance Analysis</h2>
        <table>
            <tr>
                <th>Phase</th>
                <th>Name</th>
                <th>Duration (s)</th>
                <th>Test Count</th>
                <th>Memory (MB)</th>
            </tr>
"""
        
        for perf in performance_analysis.get('phase_performance', []):
            html += f"""
            <tr>
                <td>{perf.get('phase', 'N/A')}</td>
                <td>{perf.get('name', 'Unknown')}</td>
                <td>{perf.get('duration', 0):.2f}</td>
                <td>{perf.get('test_count', 0)}</td>
                <td>{perf.get('memory_mb', 0):.2f}</td>
            </tr>
"""
        
        html += """
        </table>
        
        <h2>Recommendations</h2>
"""
        
        for rec in recommendations:
            priority_class = rec.get('priority', 'MEDIUM').lower()
            html += f"""
        <div class="recommendation {priority_class}">
            <h3>{rec.get('title', 'Recommendation')} [{rec.get('priority', 'MEDIUM')}]</h3>
            <p>{rec.get('description', '')}</p>
            <ul>
"""
            for action in rec.get('actions', []):
                html += f"<li>{action}</li>"
            html += """
            </ul>
        </div>
"""
        
        html += """
    </div>
</body>
</html>
"""
        
        return html
    
    def generate_markdown_report(
        self,
        executive_summary: Dict[str, Any],
        bug_analysis: Dict[str, Any],
        performance_analysis: Dict[str, Any],
        recommendations: List[Dict[str, Any]],
        test_results: Dict[str, Any]
    ) -> str:
        """Generate Markdown report"""
        md = f"""# Comprehensive Test Execution Report

Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Executive Summary

**Status:** {executive_summary.get('overall_status', 'UNKNOWN')}

- **Total Phases:** {executive_summary.get('total_phases', 0)}
- **Passed Phases:** {executive_summary.get('passed_phases', 0)}
- **Failed Phases:** {executive_summary.get('failed_phases', 0)}
- **Pass Rate:** {executive_summary.get('pass_rate', '0%')}
- **Total Tests:** {executive_summary.get('total_tests', 0)}
- **Total Bugs:** {executive_summary.get('total_bugs', 0)}
- **Critical Bugs:** {executive_summary.get('critical_bugs', 0)}
- **High Bugs:** {executive_summary.get('high_bugs', 0)}
- **Execution Time:** {executive_summary.get('execution_time', 0):.2f}s

## Bug Analysis

### Severity Distribution

- **Critical:** {bug_analysis.get('severity_distribution', {}).get('critical', 0)}
- **High:** {bug_analysis.get('severity_distribution', {}).get('high', 0)}
- **Medium:** {bug_analysis.get('severity_distribution', {}).get('medium', 0)}
- **Low:** {bug_analysis.get('severity_distribution', {}).get('low', 0)}

### Critical Bugs

"""
        
        for bug in bug_analysis.get('critical_bugs', [])[:10]:
            root_cause = bug.get('root_cause', {}).get('primary', {})
            md += f"""
#### {bug.get('test_name', 'Unknown')}

- **Phase:** {bug.get('phase', 'N/A')}
- **Error Type:** {bug.get('error_type', 'Unknown')}
- **Root Cause:** {root_cause.get('cause', 'Unknown')}
- **Recommendation:** {root_cause.get('recommendation', 'N/A')}

"""
        
        md += """
## Performance Analysis

### Phase Performance

| Phase | Name | Duration (s) | Test Count | Memory (MB) |
|-------|------|-------------|------------|-------------|
"""
        
        for perf in performance_analysis.get('phase_performance', []):
            md += f"| {perf.get('phase', 'N/A')} | {perf.get('name', 'Unknown')} | {perf.get('duration', 0):.2f} | {perf.get('test_count', 0)} | {perf.get('memory_mb', 0):.2f} |\n"
        
        md += f"""
- **Total Duration:** {performance_analysis.get('total_duration', 0):.2f}s
- **Average Phase Duration:** {performance_analysis.get('average_phase_duration', 0):.2f}s
"""
        
        slowest = performance_analysis.get('slowest_phase')
        if slowest:
            md += f"- **Slowest Phase:** Phase {slowest['phase']} ({slowest['name']}) - {slowest['duration']:.2f}s\n"
        
        md += """
## Recommendations

"""
        
        for rec in recommendations:
            md += f"""
### [{rec.get('priority', 'MEDIUM')}] {rec.get('title', 'Recommendation')}

{rec.get('description', '')}

**Actions:**
"""
            for action in rec.get('actions', []):
                md += f"- {action}\n"
        
        return md
    
    def generate_report(
        self,
        test_results_file: str,
        bug_report_file: Optional[str] = None,
        log_summary_file: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate comprehensive report"""
        # Load test results
        test_results = self.load_test_results(test_results_file)
        
        # Analyze bugs
        if bug_report_file and Path(bug_report_file).exists():
            with open(bug_report_file, 'r') as f:
                bug_report = json.load(f)
        else:
            # Generate bug report from test results
            bug_report = analyze_test_results(test_results_file)
        
        # Load log summary if available
        log_summary = None
        if log_summary_file and Path(log_summary_file).exists():
            with open(log_summary_file, 'r') as f:
                log_summary = json.load(f)
        
        # Generate sections
        executive_summary = self.generate_executive_summary(test_results, bug_report)
        bug_analysis = self.generate_bug_analysis_report(bug_report)
        performance_analysis = self.generate_performance_analysis(test_results)
        recommendations = self.generate_recommendations(test_results, bug_report, log_summary)
        
        # Generate reports in multiple formats
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # JSON report
        json_report = {
            'executive_summary': executive_summary,
            'bug_analysis': bug_analysis,
            'performance_analysis': performance_analysis,
            'recommendations': recommendations,
            'test_results': test_results,
            'bug_report': bug_report
        }
        
        json_file = self.reports_dir / f'test_report_{timestamp}.json'
        with open(json_file, 'w') as f:
            json.dump(json_report, f, indent=2, default=str)
        
        # HTML report
        html_content = self.generate_html_report(
            executive_summary,
            bug_analysis,
            performance_analysis,
            recommendations,
            test_results
        )
        html_file = self.reports_dir / f'test_report_{timestamp}.html'
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        # Markdown report
        md_content = self.generate_markdown_report(
            executive_summary,
            bug_analysis,
            performance_analysis,
            recommendations,
            test_results
        )
        md_file = self.reports_dir / f'test_report_{timestamp}.md'
        with open(md_file, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        print(f"Reports generated:")
        print(f"  - JSON: {json_file}")
        print(f"  - HTML: {html_file}")
        print(f"  - Markdown: {md_file}")
        
        return json_report


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Generate comprehensive test report')
    parser.add_argument('--results', type=str, required=True, help='Path to test results JSON file')
    parser.add_argument('--bug-report', type=str, help='Path to bug report JSON file')
    parser.add_argument('--log-summary', type=str, help='Path to log summary JSON file')
    parser.add_argument('--output-dir', type=str, help='Output directory for reports')
    
    args = parser.parse_args()
    
    project_root = Path(__file__).parent.parent
    
    if args.output_dir:
        reports_dir = Path(args.output_dir)
    else:
        reports_dir = project_root / 'reports' / 'comprehensive'
    
    generator = ComprehensiveReportGenerator(project_root)
    generator.reports_dir = reports_dir
    generator.reports_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        generator.generate_report(
            test_results_file=args.results,
            bug_report_file=args.bug_report,
            log_summary_file=args.log_summary
        )
    except Exception as e:
        print(f"Error generating report: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
