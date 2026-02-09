#!/usr/bin/env python3
"""
Log Aggregator để aggregate và analyze logs từ multiple sources
"""

import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from collections import defaultdict, Counter
import sys

# Add scripts directory to path
scripts_dir = Path(__file__).parent
sys.path.insert(0, str(scripts_dir))


class LogAggregator:
    """Aggregate logs từ multiple sources và analyze patterns"""
    
    def __init__(self, log_dir: str = './logs/test_execution'):
        self.log_dir = Path(log_dir)
        self.logs: List[Dict[str, Any]] = []
        self.errors: List[Dict[str, Any]] = []
        self.warnings: List[Dict[str, Any]] = []
    
    def load_logs_from_file(self, log_file: Path) -> List[Dict[str, Any]]:
        """Load logs từ một file"""
        logs = []
        
        if not log_file.exists():
            return logs
        
        try:
            with open(log_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    
                    try:
                        # Try to parse as JSON (structured log)
                        log_entry = json.loads(line)
                        logs.append(log_entry)
                    except json.JSONDecodeError:
                        # If not JSON, treat as plain text log
                        logs.append({
                            'timestamp': datetime.utcnow().isoformat(),
                            'level': 'INFO',
                            'message': line,
                            'raw': True
                        })
        except Exception as e:
            print(f"Error loading log file {log_file}: {e}", file=sys.stderr)
        
        return logs
    
    def aggregate_logs(
        self,
        log_files: Optional[List[Path]] = None,
        time_range: Optional[Dict[str, datetime]] = None
    ) -> Dict[str, Any]:
        """Aggregate logs từ multiple files"""
        if log_files is None:
            # Find all log files in log directory
            log_files = list(self.log_dir.glob('*.log'))
            log_files.extend(self.log_dir.glob('*.error.log'))
        
        all_logs = []
        
        for log_file in log_files:
            file_logs = self.load_logs_from_file(log_file)
            all_logs.extend(file_logs)
        
        # Filter by time range if specified
        if time_range:
            start_time = time_range.get('start')
            end_time = time_range.get('end')
            
            filtered_logs = []
            for log in all_logs:
                try:
                    log_time = datetime.fromisoformat(log.get('timestamp', '').replace('Z', '+00:00'))
                    if start_time and log_time < start_time:
                        continue
                    if end_time and log_time > end_time:
                        continue
                    filtered_logs.append(log)
                except Exception:
                    # If timestamp parsing fails, include the log
                    filtered_logs.append(log)
            
            all_logs = filtered_logs
        
        # Sort by timestamp
        all_logs.sort(key=lambda x: x.get('timestamp', ''))
        
        # Categorize logs
        self.logs = all_logs
        self.errors = [log for log in all_logs if log.get('level') in ['ERROR', 'CRITICAL']]
        self.warnings = [log for log in all_logs if log.get('level') == 'WARNING']
        
        return {
            'total_logs': len(all_logs),
            'errors': len(self.errors),
            'warnings': len(self.warnings),
            'logs': all_logs
        }
    
    def extract_errors(self) -> List[Dict[str, Any]]:
        """Extract errors từ logs"""
        errors = []
        
        for log in self.errors:
            error = {
                'timestamp': log.get('timestamp'),
                'level': log.get('level'),
                'message': log.get('message'),
                'module': log.get('module'),
                'function': log.get('function'),
                'line': log.get('line'),
                'exception': log.get('exception'),
                'correlation_id': log.get('correlation_id'),
                'extra_fields': log.get('extra_fields', {})
            }
            errors.append(error)
        
        return errors
    
    def extract_warnings(self) -> List[Dict[str, Any]]:
        """Extract warnings từ logs"""
        warnings = []
        
        for log in self.warnings:
            warning = {
                'timestamp': log.get('timestamp'),
                'level': log.get('level'),
                'message': log.get('message'),
                'module': log.get('module'),
                'function': log.get('function'),
                'line': log.get('line'),
                'correlation_id': log.get('correlation_id'),
                'extra_fields': log.get('extra_fields', {})
            }
            warnings.append(warning)
        
        return warnings
    
    def identify_patterns(self) -> Dict[str, Any]:
        """Identify patterns trong logs"""
        patterns = {
            'error_types': Counter(),
            'error_modules': Counter(),
            'error_functions': Counter(),
            'warning_types': Counter(),
            'phase_errors': Counter(),
            'common_messages': Counter(),
            'correlation_ids': Counter()
        }
        
        # Analyze errors
        for error in self.errors:
            error_type = error.get('exception', '').split('\n')[0] if error.get('exception') else 'Unknown'
            patterns['error_types'][error_type] += 1
            
            module = error.get('module', 'Unknown')
            patterns['error_modules'][module] += 1
            
            function = error.get('function', 'Unknown')
            patterns['error_functions'][function] += 1
            
            # Extract phase from extra_fields
            extra = error.get('extra_fields', {})
            phase = extra.get('phase')
            if phase:
                patterns['phase_errors'][phase] += 1
            
            # Track correlation IDs
            corr_id = error.get('correlation_id')
            if corr_id and corr_id != 'N/A':
                patterns['correlation_ids'][corr_id] += 1
        
        # Analyze warnings
        for warning in self.warnings:
            warning_type = warning.get('message', 'Unknown').split(':')[0]
            patterns['warning_types'][warning_type] += 1
        
        # Common messages
        for log in self.logs:
            message = log.get('message', '')
            if message:
                # Extract key part of message
                key_part = message.split(':')[0] if ':' in message else message[:50]
                patterns['common_messages'][key_part] += 1
        
        return {
            'error_types': dict(patterns['error_types'].most_common(10)),
            'error_modules': dict(patterns['error_modules'].most_common(10)),
            'error_functions': dict(patterns['error_functions'].most_common(10)),
            'warning_types': dict(patterns['warning_types'].most_common(10)),
            'phase_errors': dict(patterns['phase_errors']),
            'common_messages': dict(patterns['common_messages'].most_common(20)),
            'correlation_ids': dict(patterns['correlation_ids'].most_common(10))
        }
    
    def generate_log_summary(self) -> Dict[str, Any]:
        """Generate summary của logs"""
        if not self.logs:
            return {
                'total_logs': 0,
                'summary': 'No logs found'
            }
        
        # Time range
        timestamps = [log.get('timestamp', '') for log in self.logs if log.get('timestamp')]
        if timestamps:
            start_time = min(timestamps)
            end_time = max(timestamps)
        else:
            start_time = None
            end_time = None
        
        # Level distribution
        level_distribution = Counter(log.get('level', 'UNKNOWN') for log in self.logs)
        
        # Phase distribution
        phase_distribution = Counter()
        for log in self.logs:
            extra = log.get('extra_fields', {})
            phase = extra.get('phase')
            if phase:
                phase_distribution[phase] += 1
        
        # Event distribution
        event_distribution = Counter()
        for log in self.logs:
            extra = log.get('extra_fields', {})
            event = extra.get('event')
            if event:
                event_distribution[event] += 1
        
        return {
            'total_logs': len(self.logs),
            'time_range': {
                'start': start_time,
                'end': end_time
            },
            'level_distribution': dict(level_distribution),
            'phase_distribution': dict(phase_distribution),
            'event_distribution': dict(event_distribution),
            'errors': len(self.errors),
            'warnings': len(self.warnings),
            'patterns': self.identify_patterns()
        }
    
    def create_log_insights(self) -> Dict[str, Any]:
        """Create insights từ log analysis"""
        insights = {
            'critical_issues': [],
            'recommendations': [],
            'trends': {},
            'anomalies': []
        }
        
        # Identify critical issues
        if len(self.errors) > 100:
            insights['critical_issues'].append({
                'type': 'high_error_count',
                'message': f'High number of errors detected: {len(self.errors)}',
                'severity': 'high'
            })
        
        # Check for repeated errors
        error_messages = Counter(error.get('message', '') for error in self.errors)
        repeated_errors = [(msg, count) for msg, count in error_messages.items() if count > 5]
        
        if repeated_errors:
            insights['critical_issues'].append({
                'type': 'repeated_errors',
                'message': f'Found {len(repeated_errors)} error types that occurred multiple times',
                'details': repeated_errors[:10],
                'severity': 'medium'
            })
        
        # Phase-specific issues
        phase_errors = defaultdict(int)
        for error in self.errors:
            extra = error.get('extra_fields', {})
            phase = extra.get('phase')
            if phase:
                phase_errors[phase] += 1
        
        if phase_errors:
            worst_phase = max(phase_errors.items(), key=lambda x: x[1])
            insights['critical_issues'].append({
                'type': 'phase_errors',
                'message': f'Phase {worst_phase[0]} has the most errors: {worst_phase[1]}',
                'severity': 'medium'
            })
        
        # Recommendations
        if len(self.errors) > 0:
            insights['recommendations'].append({
                'type': 'error_review',
                'message': 'Review error logs to identify root causes',
                'priority': 'high'
            })
        
        if len(self.warnings) > 50:
            insights['recommendations'].append({
                'type': 'warning_review',
                'message': 'Review warnings to prevent potential issues',
                'priority': 'medium'
            })
        
        # Trends
        if len(self.logs) > 0:
            # Calculate error rate over time
            error_rate = len(self.errors) / len(self.logs) * 100
            insights['trends']['error_rate'] = f'{error_rate:.2f}%'
            
            # Time-based distribution
            hourly_errors = defaultdict(int)
            for error in self.errors:
                try:
                    timestamp = error.get('timestamp', '')
                    if timestamp:
                        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                        hour = dt.hour
                        hourly_errors[hour] += 1
                except Exception:
                    pass
            
            if hourly_errors:
                insights['trends']['peak_error_hour'] = max(hourly_errors.items(), key=lambda x: x[1])[0]
        
        return insights


def aggregate_logs(
    log_dir: str = './logs/test_execution',
    output_file: Optional[str] = None,
    time_range: Optional[Dict[str, datetime]] = None
) -> Dict[str, Any]:
    """Main function để aggregate logs"""
    aggregator = LogAggregator(log_dir)
    
    # Aggregate logs
    aggregated = aggregator.aggregate_logs(time_range=time_range)
    
    # Generate summary
    summary = aggregator.generate_log_summary()
    
    # Extract errors and warnings
    errors = aggregator.extract_errors()
    warnings = aggregator.extract_warnings()
    
    # Create insights
    insights = aggregator.create_log_insights()
    
    # Combine results
    result = {
        'timestamp': datetime.utcnow().isoformat(),
        'aggregated': aggregated,
        'summary': summary,
        'errors': errors,
        'warnings': warnings,
        'insights': insights
    }
    
    # Save to file if specified
    if output_file:
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump(result, f, indent=2, default=str)
        print(f"Log aggregation report saved to {output_file}")
    
    return result


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Aggregate and analyze logs')
    parser.add_argument('--log-dir', type=str, default='./logs/test_execution', help='Log directory')
    parser.add_argument('--output', type=str, help='Output file for aggregated logs')
    parser.add_argument('--start-time', type=str, help='Start time (ISO format)')
    parser.add_argument('--end-time', type=str, help='End time (ISO format)')
    
    args = parser.parse_args()
    
    time_range = None
    if args.start_time or args.end_time:
        time_range = {}
        if args.start_time:
            time_range['start'] = datetime.fromisoformat(args.start_time)
        if args.end_time:
            time_range['end'] = datetime.fromisoformat(args.end_time)
    
    try:
        result = aggregate_logs(
            log_dir=args.log_dir,
            output_file=args.output,
            time_range=time_range
        )
        
        if not args.output:
            print(json.dumps(result, indent=2, default=str))
            
    except Exception as e:
        print(f"Error aggregating logs: {e}", file=sys.stderr)
        sys.exit(1)
