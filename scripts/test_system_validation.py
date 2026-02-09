#!/usr/bin/env python3
"""
Test System Validation Script
Test các components đã tạo để verify functionality
"""

import sys
import json
from pathlib import Path
from datetime import datetime

# Add scripts directory to path
scripts_dir = Path(__file__).parent
sys.path.insert(0, str(scripts_dir))

def test_test_logger():
    """Test test_logger module"""
    print("\n" + "="*80)
    print("Testing: test_logger.py")
    print("="*80)
    
    try:
        from test_logger import setup_test_logging, TestLogger
        
        # Test setup
        log_dir = Path(__file__).parent.parent / 'logs' / 'test_validation'
        logger = setup_test_logging(
            log_dir=str(log_dir),
            log_level='INFO',
            service_name='test_validation'
        )
        
        # Test logging functions
        logger.log_phase_start(1, "Test Phase")
        logger.log_test_result("test_example", "PASSED", 0.123, phase=1)
        logger.log_performance_metrics(1, {'memory_mb': 256, 'cpu_percent': 15.5})
        logger.log_phase_end(1, "Test Phase", {'success': True}, 0.5)
        
        print("✅ test_logger: All functions working")
        return True
    except Exception as e:
        print(f"❌ test_logger: Error - {e}")
        import traceback
        traceback.print_exc()
        return False

def test_bug_analyzer():
    """Test bug_analyzer module"""
    print("\n" + "="*80)
    print("Testing: bug_analyzer.py")
    print("="*80)
    
    try:
        from bug_analyzer import StackTraceParser, BugClassifier, RootCauseAnalyzer, BugDetector
        
        # Test StackTraceParser
        parser = StackTraceParser()
        test_trace = """TypeError: Cannot read property 'name' of undefined
    at Object.test_function (test.js:45:12)
    at Object.<anonymous> (test.js:10:5)"""
        
        parsed = parser.parse_stack_trace(test_trace)
        assert parsed.get('error_type') == 'TypeError', "Failed to parse error type"
        assert len(parsed.get('frames', [])) > 0, "Failed to parse frames"
        print("✅ StackTraceParser: Working")
        
        # Test BugClassifier
        classifier = BugClassifier()
        test_bug = {
            'error_type': 'TypeError',
            'error_message': 'Cannot read property',
            'stack_trace': {'raw': test_trace}
        }
        bug_type = classifier.classify_bug(test_bug)
        assert bug_type in ['exception', 'unknown'], f"Unexpected bug type: {bug_type}"
        print(f"✅ BugClassifier: Working (classified as: {bug_type})")
        
        # Test RootCauseAnalyzer
        analyzer = RootCauseAnalyzer()
        root_cause = analyzer.analyze_root_cause(test_bug)
        assert root_cause.get('primary') is not None, "Failed to analyze root cause"
        print("✅ RootCauseAnalyzer: Working")
        
        # Test BugDetector
        detector = BugDetector()
        test_results = {
            'phases': [{
                'phase': 1,
                'name': 'Test Phase',
                'success': False,
                'tests': [{
                    'name': 'test_example',
                    'status': 'FAILED',
                    'error': test_trace,
                    'duration': 0.1
                }]
            }]
        }
        bugs = detector.detect_bugs_from_results(test_results)
        assert len(bugs) > 0, "Failed to detect bugs"
        print(f"✅ BugDetector: Working (detected {len(bugs)} bugs)")
        
        return True
    except Exception as e:
        print(f"❌ bug_analyzer: Error - {e}")
        import traceback
        traceback.print_exc()
        return False

def test_log_aggregator():
    """Test log_aggregator module"""
    print("\n" + "="*80)
    print("Testing: log_aggregator.py")
    print("="*80)
    
    try:
        from log_aggregator import LogAggregator
        
        # Create test log file
        log_dir = Path(__file__).parent.parent / 'logs' / 'test_validation'
        log_dir.mkdir(parents=True, exist_ok=True)
        
        test_log_file = log_dir / 'test.log'
        with open(test_log_file, 'w') as f:
            log_entry = {
                'timestamp': datetime.utcnow().isoformat(),
                'level': 'ERROR',
                'message': 'Test error message',
                'module': 'test_module',
                'function': 'test_function',
                'line': 123
            }
            f.write(json.dumps(log_entry) + '\n')
        
        # Test aggregator
        aggregator = LogAggregator(str(log_dir))
        result = aggregator.aggregate_logs([test_log_file])
        
        assert result['total_logs'] > 0, "Failed to aggregate logs"
        assert len(aggregator.errors) > 0, "Failed to extract errors"
        print(f"✅ LogAggregator: Working (aggregated {result['total_logs']} logs)")
        
        # Test pattern identification
        patterns = aggregator.identify_patterns()
        assert patterns is not None, "Failed to identify patterns"
        print("✅ Pattern identification: Working")
        
        return True
    except Exception as e:
        print(f"❌ log_aggregator: Error - {e}")
        import traceback
        traceback.print_exc()
        return False

def test_report_generator():
    """Test report generator module"""
    print("\n" + "="*80)
    print("Testing: generate_comprehensive_report.py")
    print("="*80)
    
    try:
        from generate_comprehensive_report import ComprehensiveReportGenerator
        
        project_root = Path(__file__).parent.parent
        generator = ComprehensiveReportGenerator(project_root)
        
        # Create mock test results
        test_results = {
            'start_time': datetime.utcnow().isoformat(),
            'end_time': datetime.utcnow().isoformat(),
            'total_duration': 100.5,
            'phases': [{
                'phase': 1,
                'name': 'Test Phase',
                'success': True,
                'duration': 50.0,
                'test_count': 10,
                'performance_metrics': {
                    'final': {
                        'memory_mb': 256,
                        'cpu_percent': 15.5
                    }
                },
                'tests': []
            }],
            'summary': {
                'total': 1,
                'passed': 1,
                'failed': 0,
                'total_tests': 10
            }
        }
        
        # Create mock bug report
        bug_report = {
            'total_bugs': 0,
            'severity_distribution': {
                'critical': 0,
                'high': 0,
                'medium': 0,
                'low': 0
            },
            'bugs': []
        }
        
        # Test report generation functions
        exec_summary = generator.generate_executive_summary(test_results, bug_report)
        assert exec_summary['overall_status'] == 'PASSED', "Failed to generate executive summary"
        print("✅ Executive summary generation: Working")
        
        bug_analysis = generator.generate_bug_analysis_report(bug_report)
        assert bug_analysis is not None, "Failed to generate bug analysis"
        print("✅ Bug analysis generation: Working")
        
        perf_analysis = generator.generate_performance_analysis(test_results)
        assert perf_analysis is not None, "Failed to generate performance analysis"
        print("✅ Performance analysis generation: Working")
        
        recommendations = generator.generate_recommendations(test_results, bug_report)
        assert isinstance(recommendations, list), "Failed to generate recommendations"
        print("✅ Recommendations generation: Working")
        
        return True
    except Exception as e:
        print(f"❌ report_generator: Error - {e}")
        import traceback
        traceback.print_exc()
        return False

def test_workflow_integration():
    """Test workflow integration"""
    print("\n" + "="*80)
    print("Testing: run_complete_test_workflow.py")
    print("="*80)
    
    try:
        from run_complete_test_workflow import run_complete_workflow
        
        # Just verify the function exists and can be imported
        assert callable(run_complete_workflow), "run_complete_workflow is not callable"
        print("✅ Workflow integration: Module imported successfully")
        print("   (Full workflow test requires actual test execution)")
        
        return True
    except Exception as e:
        print(f"❌ workflow_integration: Error - {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all validation tests"""
    print("="*80)
    print("TEST SYSTEM VALIDATION")
    print("="*80)
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    results = {
        'test_logger': test_test_logger(),
        'bug_analyzer': test_bug_analyzer(),
        'log_aggregator': test_log_aggregator(),
        'report_generator': test_report_generator(),
        'workflow_integration': test_workflow_integration()
    }
    
    # Summary
    print("\n" + "="*80)
    print("VALIDATION SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{name:30s}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
    print("="*80)
    
    # Save results
    results_file = Path(__file__).parent.parent / 'reports' / 'validation_results.json'
    results_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(results_file, 'w') as f:
        json.dump({
            'timestamp': datetime.utcnow().isoformat(),
            'results': results,
            'summary': {
                'passed': passed,
                'total': total,
                'pass_rate': f'{passed/total*100:.1f}%'
            }
        }, f, indent=2)
    
    print(f"\nResults saved to: {results_file}")
    
    return passed == total

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
