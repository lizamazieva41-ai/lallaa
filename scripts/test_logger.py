#!/usr/bin/env python3
"""
Enhanced Test Logger với Structured Logging
Supports log rotation, retention, và correlation IDs
"""

import logging
import logging.handlers
import os
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
from contextvars import ContextVar

# Correlation ID context variable
correlation_id: ContextVar[Optional[str]] = ContextVar('correlation_id', default=None)


class CorrelationIDFilter(logging.Filter):
    """Filter to add correlation ID to log records"""
    
    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = correlation_id.get() or 'N/A'
        return True


class StructuredFormatter(logging.Formatter):
    """JSON formatter for structured logging"""
    
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'correlation_id': getattr(record, 'correlation_id', 'N/A'),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        
        # Add extra fields
        if hasattr(record, 'extra_fields'):
            log_data.update(record.extra_fields)
        
        return json.dumps(log_data)


class RotatingFileHandlerWithRetention(logging.handlers.RotatingFileHandler):
    """Rotating file handler with retention policy"""
    
    def __init__(
        self,
        filename: str,
        max_bytes: int = 10 * 1024 * 1024,  # 10MB
        backup_count: int = 5,
        retention_days: int = 30,
        **kwargs
    ):
        super().__init__(filename, maxBytes=max_bytes, backupCount=backup_count, **kwargs)
        self.retention_days = retention_days
        self._cleanup_old_logs()
    
    def _cleanup_old_logs(self):
        """Remove log files older than retention period"""
        if not os.path.exists(self.baseFilename):
            return
        
        log_dir = Path(self.baseFilename).parent
        cutoff_time = datetime.now().timestamp() - (self.retention_days * 24 * 60 * 60)
        
        for log_file in log_dir.glob(f'{Path(self.baseFilename).stem}.*'):
            try:
                if log_file.stat().st_mtime < cutoff_time:
                    log_file.unlink()
            except Exception:
                pass


class TestLogger:
    """Enhanced test logger với structured logging"""
    
    def __init__(
        self,
        log_dir: str = './logs/test_execution',
        log_level: str = 'INFO',
        service_name: str = 'test_executor',
        max_bytes: int = 10 * 1024 * 1024,
        backup_count: int = 5,
        retention_days: int = 30
    ):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.service_name = service_name
        
        # Setup logger
        self.logger = logging.getLogger(service_name)
        self.logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
        self.logger.handlers.clear()
        
        # Create formatters
        json_formatter = StructuredFormatter()
        console_formatter = logging.Formatter(
            '%(asctime)s [%(levelname)s] [%(correlation_id)s] %(name)s: %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        # Add correlation ID filter
        correlation_filter = CorrelationIDFilter()
        
        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.DEBUG)
        console_handler.setFormatter(console_formatter)
        console_handler.addFilter(correlation_filter)
        self.logger.addHandler(console_handler)
        
        # File handlers with rotation
        combined_handler = RotatingFileHandlerWithRetention(
            filename=str(self.log_dir / f'{service_name}.log'),
            max_bytes=max_bytes,
            backup_count=backup_count,
            retention_days=retention_days,
        )
        combined_handler.setLevel(logging.DEBUG)
        combined_handler.setFormatter(json_formatter)
        combined_handler.addFilter(correlation_filter)
        self.logger.addHandler(combined_handler)
        
        # Error log file
        error_handler = RotatingFileHandlerWithRetention(
            filename=str(self.log_dir / f'{service_name}.error.log'),
            max_bytes=max_bytes,
            backup_count=backup_count,
            retention_days=retention_days,
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(json_formatter)
        error_handler.addFilter(correlation_filter)
        self.logger.addHandler(error_handler)
    
    def set_correlation_id(self, corr_id: str):
        """Set correlation ID for current context"""
        correlation_id.set(corr_id)
    
    def log_phase_start(self, phase: int, phase_name: str, timestamp: Optional[datetime] = None):
        """Log phase start"""
        ts = timestamp or datetime.utcnow()
        self.logger.info(
            f"Phase {phase} started: {phase_name}",
            extra={
                'extra_fields': {
                    'phase': phase,
                    'phase_name': phase_name,
                    'event': 'phase_start',
                    'timestamp': ts.isoformat()
                }
            }
        )
    
    def log_phase_end(
        self,
        phase: int,
        phase_name: str,
        results: Dict[str, Any],
        duration: float,
        timestamp: Optional[datetime] = None
    ):
        """Log phase end"""
        ts = timestamp or datetime.utcnow()
        self.logger.info(
            f"Phase {phase} completed: {phase_name}",
            extra={
                'extra_fields': {
                    'phase': phase,
                    'phase_name': phase_name,
                    'event': 'phase_end',
                    'duration': duration,
                    'results': results,
                    'timestamp': ts.isoformat()
                }
            }
        )
    
    def log_test_result(
        self,
        test_name: str,
        status: str,
        duration: float,
        phase: Optional[int] = None,
        error: Optional[str] = None,
        metrics: Optional[Dict[str, Any]] = None
    ):
        """Log individual test result"""
        level = logging.ERROR if status == 'FAILED' else logging.INFO
        extra_fields = {
            'test': test_name,
            'status': status,
            'duration': duration,
            'event': 'test_result'
        }
        
        if phase:
            extra_fields['phase'] = phase
        if error:
            extra_fields['error'] = error
        if metrics:
            extra_fields['metrics'] = metrics
        
        self.logger.log(
            level,
            f"Test {test_name}: {status} ({duration:.3f}s)",
            extra={'extra_fields': extra_fields}
        )
    
    def log_performance_metrics(self, phase: int, metrics: Dict[str, Any]):
        """Log performance metrics"""
        self.logger.info(
            f"Performance metrics for Phase {phase}",
            extra={
                'extra_fields': {
                    'phase': phase,
                    'event': 'performance_metrics',
                    'metrics': metrics
                }
            }
        )
    
    def log_bug_detected(self, bug: Dict[str, Any], details: Optional[Dict[str, Any]] = None):
        """Log bug detection"""
        extra_fields = {
            'event': 'bug_detected',
            'bug': bug
        }
        if details:
            extra_fields.update(details)
        
        self.logger.error(
            f"Bug detected: {bug.get('test_name', 'Unknown')}",
            extra={'extra_fields': extra_fields}
        )
    
    def get_logger(self) -> logging.Logger:
        """Get the underlying logger"""
        return self.logger


def setup_test_logging(
    log_dir: str = './logs/test_execution',
    log_level: str = 'INFO',
    service_name: str = 'test_executor'
) -> TestLogger:
    """Setup test logging"""
    return TestLogger(
        log_dir=log_dir,
        log_level=log_level,
        service_name=service_name
    )
