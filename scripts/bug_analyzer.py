#!/usr/bin/env python3
"""
Bug Detection và Analysis Module
Phát hiện bugs từ test results, extract stack traces, và phân tích root cause
"""

import re
import json
import traceback
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from collections import defaultdict, Counter
import sys

# Add scripts directory to path
scripts_dir = Path(__file__).parent
sys.path.insert(0, str(scripts_dir))


class StackTraceParser:
    """Parse và format stack traces từ test failures"""
    
    def __init__(self):
        self.patterns = {
            'file_line': re.compile(r'at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)'),
            'file_only': re.compile(r'at\s+(.+?)\s+\((.+?)\)'),
            'error_type': re.compile(r'^(\w+Error|Error|TypeError|ReferenceError|AssertionError):\s*(.+)'),
            'jest_failure': re.compile(r'FAIL\s+(.+?\.test\.ts)'),
        }
    
    def parse_stack_trace(self, trace: str) -> Dict[str, Any]:
        """Parse stack trace và extract thông tin"""
        if not trace:
            return {}
        
        parsed = {
            'raw': trace,
            'error_type': None,
            'error_message': None,
            'frames': [],
            'file_info': {}
        }
        
        lines = trace.split('\n')
        
        # Extract error type and message from first line
        if lines:
            first_line = lines[0].strip()
            error_match = self.patterns['error_type'].match(first_line)
            if error_match:
                parsed['error_type'] = error_match.group(1)
                parsed['error_message'] = error_match.group(2)
        
        # Extract stack frames
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Match file:line:column pattern
            match = self.patterns['file_line'].match(line)
            if match:
                frame = {
                    'function': match.group(1),
                    'file': match.group(2),
                    'line': int(match.group(3)),
                    'column': int(match.group(4)),
                    'raw': line
                }
                parsed['frames'].append(frame)
                
                # Track file info
                file_path = frame['file']
                if file_path not in parsed['file_info']:
                    parsed['file_info'][file_path] = {
                        'lines': [],
                        'functions': []
                    }
                parsed['file_info'][file_path]['lines'].append(frame['line'])
                parsed['file_info'][file_path]['functions'].append(frame['function'])
            else:
                # Match file only pattern
                match = self.patterns['file_only'].match(line)
                if match:
                    frame = {
                        'function': match.group(1),
                        'file': match.group(2),
                        'raw': line
                    }
                    parsed['frames'].append(frame)
        
        return parsed
    
    def extract_file_info(self, trace: Dict[str, Any]) -> Dict[str, Any]:
        """Extract file information từ parsed trace"""
        return trace.get('file_info', {})
    
    def extract_line_numbers(self, trace: Dict[str, Any]) -> List[int]:
        """Extract line numbers từ stack trace"""
        line_numbers = []
        for frame in trace.get('frames', []):
            if 'line' in frame:
                line_numbers.append(frame['line'])
        return line_numbers
    
    def format_trace(self, trace: Dict[str, Any], max_frames: int = 10) -> str:
        """Format stack trace cho human-readable output"""
        if not trace:
            return "No stack trace available"
        
        formatted = []
        
        if trace.get('error_type'):
            formatted.append(f"{trace['error_type']}: {trace.get('error_message', '')}")
        else:
            formatted.append("Error occurred")
        
        formatted.append("")
        formatted.append("Stack trace:")
        
        frames = trace.get('frames', [])[:max_frames]
        for i, frame in enumerate(frames, 1):
            if 'line' in frame:
                formatted.append(
                    f"  {i}. {frame['function']} at {frame['file']}:{frame['line']}:{frame['column']}"
                )
            else:
                formatted.append(f"  {i}. {frame['function']} at {frame['file']}")
        
        if len(trace.get('frames', [])) > max_frames:
            formatted.append(f"  ... ({len(trace['frames']) - max_frames} more frames)")
        
        return '\n'.join(formatted)


class BugClassifier:
    """Phân loại bugs theo type và severity"""
    
    def __init__(self):
        self.error_patterns = {
            'assertion': [
                'AssertionError', 'expect', 'assert', 'toBe', 'toEqual', 'toMatch'
            ],
            'exception': [
                'TypeError', 'ReferenceError', 'SyntaxError', 'Error'
            ],
            'timeout': [
                'timeout', 'TimeoutError', 'exceeded', 'timed out'
            ],
            'import': [
                'ModuleNotFoundError', 'Cannot find module', 'import error'
            ],
            'network': [
                'ECONNREFUSED', 'ENOTFOUND', 'network', 'connection'
            ],
            'database': [
                'database', 'connection', 'query', 'SQL', 'PostgreSQL'
            ],
            'authentication': [
                'authentication', 'unauthorized', 'token', 'JWT'
            ],
            'validation': [
                'validation', 'invalid', 'required', 'missing'
            ]
        }
    
    def classify_bug(self, bug: Dict[str, Any]) -> str:
        """Phân loại bug type"""
        error_message = bug.get('error_message', '').lower()
        error_type = bug.get('error_type', '').lower()
        stack_trace = bug.get('stack_trace', {}).get('raw', '').lower()
        
        combined_text = f"{error_message} {error_type} {stack_trace}"
        
        for bug_type, patterns in self.error_patterns.items():
            for pattern in patterns:
                if pattern.lower() in combined_text:
                    return bug_type
        
        return 'unknown'
    
    def calculate_severity(
        self,
        bug: Dict[str, Any],
        phase: int,
        frequency: int = 1
    ) -> str:
        """Tính toán severity dựa trên impact"""
        error_type = bug.get('error_type', '')
        bug_type = bug.get('bug_type', 'unknown')
        phase = bug.get('phase', phase)
        
        # Critical phases (infrastructure, security)
        critical_phases = [1, 3]
        
        # High severity indicators
        critical_errors = ['TypeError', 'ReferenceError', 'SyntaxError']
        high_impact_types = ['database', 'authentication', 'security']
        
        # Calculate base severity
        if phase in critical_phases:
            base_severity = 'high'
        else:
            base_severity = 'medium'
        
        # Adjust based on error type
        if error_type in critical_errors:
            if base_severity == 'medium':
                base_severity = 'high'
            else:
                base_severity = 'critical'
        
        # Adjust based on bug type
        if bug_type in high_impact_types:
            if base_severity == 'medium':
                base_severity = 'high'
            elif base_severity == 'high':
                base_severity = 'critical'
        
        # Adjust based on frequency
        if frequency > 5:
            if base_severity == 'low':
                base_severity = 'medium'
            elif base_severity == 'medium':
                base_severity = 'high'
        
        return base_severity


class RootCauseAnalyzer:
    """Phân tích root cause của bugs"""
    
    def __init__(self):
        self.common_causes = {
            'null_undefined': {
                'patterns': ['null', 'undefined', 'Cannot read property'],
                'cause': 'Null or undefined value access',
                'recommendation': 'Add null checks and default values'
            },
            'type_mismatch': {
                'patterns': ['TypeError', 'expected', 'got'],
                'cause': 'Type mismatch in function parameters or return values',
                'recommendation': 'Add type checking and validation'
            },
            'async_timing': {
                'patterns': ['timeout', 'await', 'Promise'],
                'cause': 'Async/await timing issue or missing await',
                'recommendation': 'Review async/await usage and add proper error handling'
            },
            'import_error': {
                'patterns': ['Cannot find module', 'ModuleNotFoundError'],
                'cause': 'Missing dependency or incorrect import path',
                'recommendation': 'Check dependencies and import paths'
            },
            'database_connection': {
                'patterns': ['connection', 'database', 'ECONNREFUSED'],
                'cause': 'Database connection issue',
                'recommendation': 'Check database configuration and connectivity'
            },
            'authentication': {
                'patterns': ['unauthorized', 'token', 'JWT', 'authentication'],
                'cause': 'Authentication or authorization failure',
                'recommendation': 'Verify authentication tokens and permissions'
            }
        }
    
    def analyze_root_cause(self, bug: Dict[str, Any]) -> Dict[str, Any]:
        """Phân tích root cause của bug"""
        error_message = bug.get('error_message', '').lower()
        error_type = bug.get('error_type', '').lower()
        stack_trace = bug.get('stack_trace', {}).get('raw', '').lower()
        
        combined_text = f"{error_message} {error_type} {stack_trace}"
        
        # Find matching common causes
        matched_causes = []
        for cause_id, cause_info in self.common_causes.items():
            for pattern in cause_info['patterns']:
                if pattern.lower() in combined_text:
                    matched_causes.append({
                        'id': cause_id,
                        'cause': cause_info['cause'],
                        'recommendation': cause_info['recommendation'],
                        'confidence': 'high' if pattern.lower() in error_type else 'medium'
                    })
                    break
        
        # If no match, provide generic analysis
        if not matched_causes:
            # Analyze stack trace for clues
            frames = bug.get('stack_trace', {}).get('frames', [])
            if frames:
                top_frame = frames[0] if frames else {}
                file_path = top_frame.get('file', '')
                line_number = top_frame.get('line', 0)
                
                matched_causes.append({
                    'id': 'unknown',
                    'cause': f'Error occurred at {file_path}:{line_number}',
                    'recommendation': 'Review code at the specified location',
                    'confidence': 'low'
                })
            else:
                matched_causes.append({
                    'id': 'unknown',
                    'cause': 'Unable to determine root cause from available information',
                    'recommendation': 'Review error message and test context',
                    'confidence': 'low'
                })
        
        # Return primary cause (highest confidence)
        primary_cause = max(matched_causes, key=lambda x: x['confidence'] == 'high') if matched_causes else matched_causes[0] if matched_causes else None
        
        return {
            'primary': primary_cause,
            'all_matches': matched_causes,
            'analysis_timestamp': datetime.utcnow().isoformat()
        }
    
    def identify_patterns(self, bugs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Identify patterns trong bugs"""
        patterns = {
            'by_type': Counter(),
            'by_phase': Counter(),
            'by_file': Counter(),
            'by_error_type': Counter(),
            'common_files': [],
            'common_errors': []
        }
        
        for bug in bugs:
            bug_type = bug.get('bug_type', 'unknown')
            phase = bug.get('phase', 0)
            error_type = bug.get('error_type', 'unknown')
            
            patterns['by_type'][bug_type] += 1
            patterns['by_phase'][phase] += 1
            patterns['by_error_type'][error_type] += 1
            
            # Extract file from stack trace
            stack_trace = bug.get('stack_trace', {})
            frames = stack_trace.get('frames', [])
            if frames:
                file_path = frames[0].get('file', '')
                if file_path:
                    patterns['by_file'][file_path] += 1
        
        # Get top common files and errors
        patterns['common_files'] = [
            {'file': file, 'count': count}
            for file, count in patterns['by_file'].most_common(10)
        ]
        patterns['common_errors'] = [
            {'error': error, 'count': count}
            for error, count in patterns['by_error_type'].most_common(10)
        ]
        
        return patterns


class BugDetector:
    """Detect bugs từ test results"""
    
    def __init__(self):
        self.stack_trace_parser = StackTraceParser()
        self.bug_classifier = BugClassifier()
        self.root_cause_analyzer = RootCauseAnalyzer()
    
    def detect_bugs_from_results(
        self,
        test_results: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Detect bugs từ test results"""
        bugs = []
        
        # Extract failed tests from results
        phases = test_results.get('phases', [])
        
        for phase_result in phases:
            phase_number = phase_result.get('phase', 0)
            phase_name = phase_result.get('name', 'Unknown')
            
            # Check if phase failed
            if not phase_result.get('success', True):
                # Extract bugs from phase
                phase_bugs = self.extract_bugs_from_phase(phase_result, phase_number)
                bugs.extend(phase_bugs)
            
            # Extract bugs from individual test failures
            tests = phase_result.get('tests', [])
            for test in tests:
                if test.get('status') == 'FAILED':
                    bug = self.create_bug_from_test(test, phase_number, phase_name)
                    if bug:
                        bugs.append(bug)
        
        return bugs
    
    def extract_bugs_from_phase(
        self,
        phase_result: Dict[str, Any],
        phase_number: int
    ) -> List[Dict[str, Any]]:
        """Extract bugs từ phase result"""
        bugs = []
        
        # Check for phase-level errors
        if phase_result.get('error'):
            bug = {
                'bug_id': f"phase_{phase_number}_{datetime.utcnow().timestamp()}",
                'test_name': f"Phase {phase_number}",
                'phase': phase_number,
                'phase_name': phase_result.get('name', 'Unknown'),
                'error_message': phase_result.get('error'),
                'error_type': 'PhaseError',
                'stack_trace': {},
                'severity': 'high',
                'timestamp': datetime.utcnow().isoformat()
            }
            bugs.append(bug)
        
        # Check stderr for errors
        stderr = phase_result.get('stderr', '')
        if stderr and 'error' in stderr.lower():
            parsed_trace = self.stack_trace_parser.parse_stack_trace(stderr)
            if parsed_trace:
                bug = {
                    'bug_id': f"phase_{phase_number}_stderr_{datetime.utcnow().timestamp()}",
                    'test_name': f"Phase {phase_number} (stderr)",
                    'phase': phase_number,
                    'phase_name': phase_result.get('name', 'Unknown'),
                    'error_message': parsed_trace.get('error_message', stderr[:200]),
                    'error_type': parsed_trace.get('error_type', 'UnknownError'),
                    'stack_trace': parsed_trace,
                    'severity': 'high',
                    'timestamp': datetime.utcnow().isoformat()
                }
                bugs.append(bug)
        
        return bugs
    
    def create_bug_from_test(
        self,
        test: Dict[str, Any],
        phase_number: int,
        phase_name: str
    ) -> Optional[Dict[str, Any]]:
        """Create bug object từ failed test"""
        test_name = test.get('name', 'Unknown')
        error = test.get('error', '')
        
        if not error:
            return None
        
        # Parse stack trace
        parsed_trace = self.stack_trace_parser.parse_stack_trace(error)
        
        # Create bug object
        bug = {
            'bug_id': f"bug_{hash(test_name)}_{datetime.utcnow().timestamp()}",
            'test_name': test_name,
            'phase': phase_number,
            'phase_name': phase_name,
            'error_message': parsed_trace.get('error_message', error[:200]) if parsed_trace else error[:200],
            'error_type': parsed_trace.get('error_type', 'UnknownError') if parsed_trace else 'UnknownError',
            'stack_trace': parsed_trace,
            'duration': test.get('duration', 0),
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Classify bug
        bug['bug_type'] = self.bug_classifier.classify_bug(bug)
        
        # Calculate severity
        bug['severity'] = self.bug_classifier.calculate_severity(bug, phase_number)
        
        # Analyze root cause
        bug['root_cause'] = self.root_cause_analyzer.analyze_root_cause(bug)
        
        return bug
    
    def extract_stack_traces(self, bugs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract và format stack traces từ bugs"""
        formatted_traces = []
        
        for bug in bugs:
            stack_trace = bug.get('stack_trace', {})
            if stack_trace:
                formatted = self.stack_trace_parser.format_trace(stack_trace)
                formatted_traces.append({
                    'bug_id': bug.get('bug_id'),
                    'test_name': bug.get('test_name'),
                    'formatted_trace': formatted,
                    'raw_trace': stack_trace
                })
        
        return formatted_traces
    
    def classify_bugs(self, bugs: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Group bugs by classification"""
        classified = defaultdict(list)
        
        for bug in bugs:
            bug_type = bug.get('bug_type', 'unknown')
            classified[bug_type].append(bug)
        
        return dict(classified)


def analyze_test_results(test_results_file: str) -> Dict[str, Any]:
    """Main function để analyze test results và generate bug report"""
    results_path = Path(test_results_file)
    
    if not results_path.exists():
        raise FileNotFoundError(f"Test results file not found: {test_results_file}")
    
    with open(results_path, 'r') as f:
        test_results = json.load(f)
    
    detector = BugDetector()
    
    # Detect bugs
    bugs = detector.detect_bugs_from_results(test_results)
    
    # Extract stack traces
    stack_traces = detector.extract_stack_traces(bugs)
    
    # Classify bugs
    classified_bugs = detector.classify_bugs(bugs)
    
    # Identify patterns
    patterns = detector.root_cause_analyzer.identify_patterns(bugs)
    
    # Generate bug report
    bug_report = {
        'timestamp': datetime.utcnow().isoformat(),
        'total_bugs': len(bugs),
        'bugs': bugs,
        'stack_traces': stack_traces,
        'classified_bugs': classified_bugs,
        'patterns': patterns,
        'severity_distribution': {
            'critical': len([b for b in bugs if b.get('severity') == 'critical']),
            'high': len([b for b in bugs if b.get('severity') == 'high']),
            'medium': len([b for b in bugs if b.get('severity') == 'medium']),
            'low': len([b for b in bugs if b.get('severity') == 'low'])
        }
    }
    
    return bug_report


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Analyze test results and detect bugs')
    parser.add_argument('--results', type=str, required=True, help='Path to test results JSON file')
    parser.add_argument('--output', type=str, help='Output file for bug report')
    
    args = parser.parse_args()
    
    try:
        bug_report = analyze_test_results(args.results)
        
        if args.output:
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w') as f:
                json.dump(bug_report, f, indent=2)
            print(f"Bug report saved to {args.output}")
        else:
            print(json.dumps(bug_report, indent=2))
            
    except Exception as e:
        print(f"Error analyzing test results: {e}", file=sys.stderr)
        sys.exit(1)
