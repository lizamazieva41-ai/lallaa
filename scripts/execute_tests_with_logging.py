#!/usr/bin/env python3
"""
Enhanced Test Execution Script với Detailed Logging và Bug Capture
Runs Jest tests với comprehensive logging và performance metrics
"""

import sys
import subprocess
import argparse
import time
import json
import psutil
import os
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
import uuid

# Add scripts directory to path
scripts_dir = Path(__file__).parent
sys.path.insert(0, str(scripts_dir))

from test_logger import setup_test_logging, TestLogger


class EnhancedTestExecutor:
    """Enhanced test executor với detailed logging và bug capture"""
    
    def __init__(self, project_root: Path, logger: Optional[TestLogger] = None):
        self.project_root = project_root
        self.logger = logger or setup_test_logging(
            log_dir=str(project_root / 'logs' / 'test_execution'),
            service_name='test_executor'
        )
        self.results: Dict[str, Any] = {}
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None
        self.correlation_id = str(uuid.uuid4())
        self.logger.set_correlation_id(self.correlation_id)
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get current system performance metrics"""
        process = psutil.Process()
        memory_info = process.memory_info()
        cpu_percent = process.cpu_percent(interval=0.1)
        
        return {
            'memory_mb': memory_info.rss / 1024 / 1024,
            'memory_percent': process.memory_percent(),
            'cpu_percent': cpu_percent,
            'threads': process.num_threads(),
            'open_files': len(process.open_files())
        }
    
    def capture_test_output(
        self,
        test_name: str,
        stdout: str,
        stderr: str,
        returncode: int
    ) -> Dict[str, Any]:
        """Capture và parse test output"""
        output = {
            'test_name': test_name,
            'stdout': stdout,
            'stderr': stderr,
            'returncode': returncode,
            'success': returncode == 0,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Try to extract test results from Jest output
        if stdout:
            # Parse Jest output for test counts
            if 'Tests:' in stdout:
                try:
                    lines = stdout.split('\n')
                    for line in lines:
                        if 'Tests:' in line:
                            # Extract test counts
                            parts = line.split('Tests:')
                            if len(parts) > 1:
                                test_info = parts[1].strip()
                                output['jest_summary'] = test_info
                except Exception:
                    pass
        
        return output
    
    def execute_phase_with_logging(
        self,
        phase_number: int,
        phase_name: str,
        test_path: str
    ) -> Dict[str, Any]:
        """Execute a test phase với comprehensive logging"""
        phase_start_time = time.time()
        phase_start_datetime = datetime.utcnow()
        
        # Log phase start
        self.logger.log_phase_start(phase_number, phase_name, phase_start_datetime)
        
        # Get initial metrics
        initial_metrics = self.get_performance_metrics()
        
        # Create log file for this phase
        log_file = self.project_root / 'logs' / 'test_execution' / f'phase_{phase_number}.log'
        log_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Prepare Jest command
        # Note: Jest doesn't have a direct phase concept, so we'll run tests matching the path
        cmd = [
            'npm', 'test', '--',
            '--testPathPattern', test_path,
            '--verbose',
            '--coverage',
            '--coverageReporters', 'json',
            '--json',
            '--outputFile', str(self.project_root / 'reports' / 'test_results' / f'phase_{phase_number}_results.json')
        ]
        
        # Ensure reports directory exists
        reports_dir = self.project_root / 'reports' / 'test_results'
        reports_dir.mkdir(parents=True, exist_ok=True)
        
        test_results = []
        phase_output = {
            'stdout': '',
            'stderr': '',
            'tests': []
        }
        
        try:
            self.logger.get_logger().info(f"Executing command: {' '.join(cmd)}")
            
            # Run Jest tests
            result = subprocess.run(
                cmd,
                cwd=self.project_root,
                capture_output=True,
                text=True,
                timeout=1800,  # 30 minutes timeout
                env={**os.environ, 'NODE_ENV': 'test'}
            )
            
            phase_end_time = time.time()
            phase_duration = phase_end_time - phase_start_time
            
            # Get final metrics
            final_metrics = self.get_performance_metrics()
            
            # Parse Jest JSON output if available
            json_output_file = reports_dir / f'phase_{phase_number}_results.json'
            jest_results = None
            if json_output_file.exists():
                try:
                    with open(json_output_file, 'r') as f:
                        jest_results = json.load(f)
                except Exception as e:
                    self.logger.get_logger().warning(f"Failed to parse Jest JSON output: {e}")
            
            # Capture output
            phase_output['stdout'] = result.stdout
            phase_output['stderr'] = result.stderr
            phase_output['returncode'] = result.returncode
            
            # Extract test information from Jest output
            if jest_results:
                test_results = jest_results.get('testResults', [])
                for test_result in test_results:
                    test_name = test_result.get('name', 'Unknown')
                    status = 'PASSED' if test_result.get('status') == 'passed' else 'FAILED'
                    duration = test_result.get('duration', 0) / 1000  # Convert ms to seconds
                    
                    error = None
                    if test_result.get('status') == 'failed':
                        failure_messages = test_result.get('failureMessages', [])
                        if failure_messages:
                            error = '\n'.join(failure_messages)
                    
                    # Log individual test result
                    self.logger.log_test_result(
                        test_name=test_name,
                        status=status,
                        duration=duration,
                        phase=phase_number,
                        error=error
                    )
                    
                    phase_output['tests'].append({
                        'name': test_name,
                        'status': status,
                        'duration': duration,
                        'error': error
                    })
            
            # Calculate performance metrics
            performance_metrics = {
                'initial': initial_metrics,
                'final': final_metrics,
                'duration': phase_duration,
                'memory_delta_mb': final_metrics['memory_mb'] - initial_metrics['memory_mb']
            }
            
            # Log performance metrics
            self.logger.log_performance_metrics(phase_number, performance_metrics)
            
            # Prepare phase result
            phase_result = {
                'phase': phase_number,
                'name': phase_name,
                'success': result.returncode == 0,
                'duration': phase_duration,
                'stdout': result.stdout,
                'stderr': result.stderr,
                'returncode': result.returncode,
                'test_count': len(test_results),
                'performance_metrics': performance_metrics,
                'tests': phase_output['tests']
            }
            
            # Log phase end
            self.logger.log_phase_end(
                phase_number,
                phase_name,
                {
                    'success': phase_result['success'],
                    'test_count': phase_result['test_count'],
                    'duration': phase_duration
                },
                phase_duration,
                datetime.fromtimestamp(phase_end_time)
            )
            
            # Generate JUnit XML report (if needed)
            self.generate_junit_xml(phase_number, phase_result)
            
            return phase_result
            
        except subprocess.TimeoutExpired:
            phase_end_time = time.time()
            phase_duration = phase_end_time - phase_start_time
            
            self.logger.get_logger().error(
                f"Phase {phase_number} timed out after 30 minutes",
                extra={'extra_fields': {'phase': phase_number, 'event': 'timeout'}}
            )
            
            return {
                'phase': phase_number,
                'name': phase_name,
                'success': False,
                'duration': 1800,
                'error': 'Timeout after 30 minutes',
                'tests': []
            }
            
        except Exception as e:
            phase_end_time = time.time()
            phase_duration = phase_end_time - phase_start_time
            
            self.logger.get_logger().exception(
                f"Error executing Phase {phase_number}: {str(e)}",
                extra={'extra_fields': {'phase': phase_number, 'event': 'error'}}
            )
            
            return {
                'phase': phase_number,
                'name': phase_name,
                'success': False,
                'duration': phase_duration,
                'error': str(e),
                'tests': []
            }
    
    def generate_junit_xml(self, phase_number: int, phase_result: Dict[str, Any]):
        """Generate JUnit XML report for the phase"""
        try:
            junit_file = self.project_root / 'reports' / 'test_results' / f'phase_{phase_number}_results.xml'
            junit_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Simple JUnit XML format
            xml_content = ['<?xml version="1.0" encoding="UTF-8"?>']
            xml_content.append(f'<testsuites name="Phase {phase_number}" tests="{phase_result.get("test_count", 0)}" time="{phase_result.get("duration", 0):.3f}">')
            xml_content.append(f'  <testsuite name="{phase_result["name"]}" tests="{phase_result.get("test_count", 0)}" time="{phase_result.get("duration", 0):.3f}">')
            
            for test in phase_result.get('tests', []):
                test_name = test.get('name', 'Unknown')
                status = test.get('status', 'UNKNOWN')
                duration = test.get('duration', 0)
                
                if status == 'PASSED':
                    xml_content.append(f'    <testcase name="{test_name}" time="{duration:.3f}"/>')
                else:
                    error = test.get('error', 'Test failed')
                    xml_content.append(f'    <testcase name="{test_name}" time="{duration:.3f}">')
                    xml_content.append(f'      <failure message="Test failed">{error}</failure>')
                    xml_content.append('    </testcase>')
            
            xml_content.append('  </testsuite>')
            xml_content.append('</testsuites>')
            
            with open(junit_file, 'w', encoding='utf-8') as f:
                f.write('\n'.join(xml_content))
                
        except Exception as e:
            self.logger.get_logger().warning(f"Failed to generate JUnit XML: {e}")
    
    def track_test_status(
        self,
        test_name: str,
        status: str,
        duration: float,
        phase: Optional[int] = None
    ):
        """Track individual test status"""
        if test_name not in self.results:
            self.results[test_name] = []
        
        self.results[test_name].append({
            'status': status,
            'duration': duration,
            'phase': phase,
            'timestamp': datetime.utcnow().isoformat()
        })
    
    def run_all_phases(
        self,
        phases: List[Dict[str, str]],
        fail_fast: bool = False
    ) -> Dict[str, Any]:
        """Run all test phases"""
        self.start_time = time.time()
        start_datetime = datetime.fromtimestamp(self.start_time)
        
        self.logger.get_logger().info(
            "Starting comprehensive test suite execution",
            extra={
                'extra_fields': {
                    'event': 'execution_start',
                    'phases_count': len(phases),
                    'timestamp': start_datetime.isoformat()
                }
            }
        )
        
        # Create reports directory
        reports_dir = self.project_root / 'reports' / 'test_results'
        reports_dir.mkdir(parents=True, exist_ok=True)
        
        all_results = []
        
        for phase_info in phases:
            phase_num = phase_info['number']
            phase_name = phase_info['name']
            test_path = phase_info['path']
            
            result = self.execute_phase_with_logging(phase_num, phase_name, test_path)
            all_results.append(result)
            
            if not result['success'] and fail_fast:
                self.logger.get_logger().error(
                    f"Stopping execution due to Phase {phase_num} failure (fail-fast mode)",
                    extra={'extra_fields': {'phase': phase_num, 'event': 'fail_fast'}}
                )
                break
        
        self.end_time = time.time()
        total_duration = self.end_time - self.start_time
        end_datetime = datetime.fromtimestamp(self.end_time)
        
        # Calculate summary
        passed = sum(1 for r in all_results if r.get('success', False))
        failed = len(all_results) - passed
        total_tests = sum(r.get('test_count', 0) for r in all_results)
        
        # Log summary
        self.logger.get_logger().info(
            "Test execution completed",
            extra={
                'extra_fields': {
                    'event': 'execution_end',
                    'total_phases': len(all_results),
                    'passed_phases': passed,
                    'failed_phases': failed,
                    'total_tests': total_tests,
                    'duration': total_duration,
                    'timestamp': end_datetime.isoformat()
                }
            }
        )
        
        # Save results
        results_file = reports_dir / 'test_execution_results.json'
        with open(results_file, 'w') as f:
            json.dump({
                'start_time': start_datetime.isoformat(),
                'end_time': end_datetime.isoformat(),
                'total_duration': total_duration,
                'correlation_id': self.correlation_id,
                'phases': all_results,
                'summary': {
                    'total': len(all_results),
                    'passed': passed,
                    'failed': failed,
                    'total_tests': total_tests
                }
            }, f, indent=2)
        
        return {
            'phases': all_results,
            'summary': {
                'total': len(all_results),
                'passed': passed,
                'failed': failed,
                'total_tests': total_tests,
                'duration': total_duration
            }
        }


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Run comprehensive test suite with enhanced logging')
    parser.add_argument('--phase', type=int, help='Run specific phase only')
    parser.add_argument('--all', action='store_true', help='Run all phases')
    parser.add_argument('--coverage', action='store_true', help='Generate coverage report')
    parser.add_argument('--fail-fast', action='store_true', help='Stop on first failure')
    parser.add_argument('--verbose', action='store_true', help='Verbose output')
    parser.add_argument('--log-dir', type=str, default='./logs/test_execution', help='Log directory')
    
    args = parser.parse_args()
    
    project_root = Path(__file__).parent.parent
    
    # Define test phases based on test directory structure
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
    
    logger = setup_test_logging(
        log_dir=str(project_root / args.log_dir),
        log_level='DEBUG' if args.verbose else 'INFO'
    )
    
    executor = EnhancedTestExecutor(project_root, logger)
    
    if args.phase:
        # Run specific phase
        phase_info = next((p for p in phases if p['number'] == args.phase), None)
        if phase_info:
            result = executor.execute_phase_with_logging(
                phase_info['number'],
                phase_info['name'],
                phase_info['path']
            )
            sys.exit(0 if result['success'] else 1)
        else:
            print(f"Error: Phase {args.phase} not found")
            sys.exit(1)
    elif args.all:
        # Run all phases
        results = executor.run_all_phases(phases, fail_fast=args.fail_fast)
        
        # Exit with error code if any phase failed
        sys.exit(0 if results['summary']['failed'] == 0 else 1)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
