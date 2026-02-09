# Test Execution Workflow Guide

## Tổng Quan

Hệ thống Test Execution Workflow cung cấp một giải pháp hoàn chỉnh để:
- Thực thi tests với detailed logging
- Phát hiện và phân tích bugs chi tiết
- Tạo báo cáo toàn diện với stack traces và root cause analysis

## Kiến Trúc

```
Test Executor → Logger → Bug Detector → Bug Analyzer → Report Generator
     ↓            ↓           ↓              ↓              ↓
  Test Results  Log Files  Bug List    Root Cause    HTML/JSON/MD
```

## Components

### 1. Test Logger (`scripts/test_logger.py`)

Structured logging system với:
- JSON format cho machine parsing
- Human-readable format cho console
- Log rotation và retention (30 days)
- Correlation ID tracking
- Performance metrics logging

**Usage:**
```python
from scripts.test_logger import setup_test_logging

logger = setup_test_logging(
    log_dir='./logs/test_execution',
    log_level='INFO',
    service_name='test_executor'
)

logger.log_phase_start(1, "Infrastructure Tests")
logger.log_test_result("test_database", "PASSED", 0.123, phase=1)
logger.log_phase_end(1, "Infrastructure Tests", results, duration)
```

### 2. Enhanced Test Executor (`scripts/execute_tests_with_logging.py`)

Test executor với:
- Detailed logging cho mỗi test
- Performance metrics collection
- JUnit XML report generation
- Bug capture và error tracking

**Usage:**
```bash
# Run all phases
python scripts/execute_tests_with_logging.py --all

# Run specific phase
python scripts/execute_tests_with_logging.py --phase 1

# With fail-fast
python scripts/execute_tests_with_logging.py --all --fail-fast
```

### 3. Bug Analyzer (`scripts/bug_analyzer.py`)

Bug detection và analysis với:
- Stack trace parsing
- Root cause analysis
- Bug classification
- Severity calculation
- Pattern detection

**Usage:**
```bash
# Analyze test results
python scripts/bug_analyzer.py --results reports/test_results/test_execution_results.json --output reports/bug_analysis/bug_report.json
```

**Components:**
- `StackTraceParser`: Parse và format stack traces
- `BugClassifier`: Phân loại bugs theo type và severity
- `RootCauseAnalyzer`: Phân tích root cause
- `BugDetector`: Detect bugs từ test results

### 4. Log Aggregator (`scripts/log_aggregator.py`)

Aggregate và analyze logs từ multiple sources:
- Parse structured JSON logs
- Extract errors và warnings
- Identify patterns
- Generate insights

**Usage:**
```bash
# Aggregate logs
python scripts/log_aggregator.py --log-dir ./logs/test_execution --output reports/log_analysis/log_summary.json

# With time range
python scripts/log_aggregator.py --log-dir ./logs/test_execution --start-time "2025-01-31T00:00:00" --end-time "2025-01-31T23:59:59"
```

### 5. Comprehensive Report Generator (`scripts/generate_comprehensive_report.py`)

Generate comprehensive reports với:
- Executive summary
- Bug analysis với stack traces
- Performance analysis
- Recommendations

**Usage:**
```bash
# Generate reports
python scripts/generate_comprehensive_report.py \
  --results reports/test_results/test_execution_results.json \
  --bug-report reports/bug_analysis/bug_report.json \
  --log-summary reports/log_analysis/log_summary.json
```

**Output Formats:**
- HTML: `reports/comprehensive/test_report_YYYYMMDD_HHMMSS.html`
- JSON: `reports/comprehensive/test_report_YYYYMMDD_HHMMSS.json`
- Markdown: `reports/comprehensive/test_report_YYYYMMDD_HHMMSS.md`

### 6. Complete Workflow (`scripts/run_complete_test_workflow.py`)

Integrated workflow chạy tất cả components:

**Usage:**
```bash
# Run complete workflow
python scripts/run_complete_test_workflow.py --all

# Run specific phase
python scripts/run_complete_test_workflow.py --phase 1

# With fail-fast
python scripts/run_complete_test_workflow.py --all --fail-fast

# Skip report generation
python scripts/run_complete_test_workflow.py --all --no-reports
```

## Workflow Steps

1. **Setup Logging**: Initialize structured logger
2. **Execute Tests**: Run tests với detailed logging
3. **Analyze Bugs**: Detect và analyze bugs từ results
4. **Aggregate Logs**: Aggregate và analyze logs
5. **Generate Reports**: Create comprehensive reports

## Test Phases

1. **Phase 1**: Infrastructure & Core Services (`tests/unit`)
2. **Phase 2**: Authentication & Authorization (`tests/integration`)
3. **Phase 3**: Security Scanning (`tests/integration/security`)
4. **Phase 4**: Card Verification & Data Processing (`tests/integration`)
5. **Phase 5**: Multi-Platform Integration (`tests/integration`)
6. **Phase 6**: Web Automation & AI (`tests/integration`)
7. **Phase 7**: Monitoring & Observability (`tests/performance`)
8. **Phase 8**: API Endpoints & E2E Workflows (`tests/integration`)

## File Structure

```
bin-check-the~1/
├── scripts/
│   ├── execute_tests_with_logging.py      # Enhanced test executor
│   ├── bug_analyzer.py                    # Bug detection và analysis
│   ├── test_logger.py                     # Test logging system
│   ├── generate_comprehensive_report.py   # Comprehensive report generator
│   ├── log_aggregator.py                  # Log aggregation
│   └── run_complete_test_workflow.py      # Complete workflow
├── logs/
│   └── test_execution/                    # Test execution logs
│       ├── test_executor.log
│       ├── test_executor.error.log
│       └── phase_*.log
├── reports/
│   ├── test_results/                      # Test results
│   │   ├── test_execution_results.json
│   │   └── phase_*_results.xml
│   ├── bug_analysis/                      # Bug analysis reports
│   │   └── bug_report.json
│   ├── log_analysis/                      # Log analysis
│   │   └── log_summary.json
│   └── comprehensive/                     # Comprehensive reports
│       ├── test_report_*.html
│       ├── test_report_*.json
│       └── test_report_*.md
```

## Log Format

### Structured JSON Log

```json
{
  "timestamp": "2025-01-31T10:00:00Z",
  "level": "INFO",
  "logger": "test_executor",
  "message": "Phase 1 started: Infrastructure Tests",
  "correlation_id": "corr_123",
  "module": "execute_tests_with_logging",
  "function": "log_phase_start",
  "line": 123,
  "extra_fields": {
    "phase": 1,
    "phase_name": "Infrastructure Tests",
    "event": "phase_start"
  }
}
```

## Bug Report Format

```json
{
  "bug_id": "bug_123_1234567890",
  "test_name": "test_database_connection",
  "phase": 1,
  "phase_name": "Infrastructure Tests",
  "error_message": "Connection timeout",
  "error_type": "TimeoutError",
  "bug_type": "timeout",
  "severity": "high",
  "stack_trace": {
    "error_type": "TimeoutError",
    "error_message": "Connection timeout",
    "frames": [
      {
        "function": "connect",
        "file": "src/database/connection.ts",
        "line": 45,
        "column": 12
      }
    ]
  },
  "root_cause": {
    "primary": {
      "id": "database_connection",
      "cause": "Database connection issue",
      "recommendation": "Check database configuration and connectivity",
      "confidence": "high"
    }
  }
}
```

## Report Sections

### Executive Summary
- Overall status
- Total phases, passed, failed
- Total tests và bugs
- Critical bugs count

### Bug Analysis
- Severity distribution
- Bugs by phase
- Critical và high bugs với details
- Stack traces
- Root cause analysis

### Performance Analysis
- Phase performance metrics
- Duration analysis
- Memory và CPU usage
- Slowest/fastest phases

### Recommendations
- Priority fixes
- Test improvements
- Performance optimizations

## Best Practices

1. **Run Complete Workflow**: Sử dụng `run_complete_test_workflow.py` cho full execution
2. **Review Logs**: Check logs trong `logs/test_execution/` để debug issues
3. **Analyze Bugs**: Review bug reports để prioritize fixes
4. **Check Reports**: Open HTML reports để xem detailed analysis
5. **Monitor Performance**: Track performance metrics để identify bottlenecks

## Troubleshooting

### Tests không chạy
- Check Jest configuration
- Verify test paths
- Check dependencies

### Bugs không được detect
- Verify test results file format
- Check error messages trong logs
- Review bug analyzer patterns

### Reports không generate
- Check file permissions
- Verify input files exist
- Review error messages trong console

## Dependencies

- Python 3.8+
- psutil (for performance metrics)
- pytest (for test execution - if using Python tests)
- Jest (for TypeScript/JavaScript tests)

## Configuration

### Log Retention
- Default: 30 days
- Configurable trong `test_logger.py`

### Report Retention
- Default: 90 days (manual cleanup)
- Reports saved trong `reports/comprehensive/`

### Performance Metrics
- Memory usage tracking
- CPU usage tracking
- Execution time tracking

## Examples

### Example 1: Run All Tests và Generate Reports

```bash
python scripts/run_complete_test_workflow.py --all
```

### Example 2: Run Specific Phase với Fail-Fast

```bash
python scripts/run_complete_test_workflow.py --phase 1 --fail-fast
```

### Example 3: Analyze Existing Test Results

```bash
python scripts/bug_analyzer.py \
  --results reports/test_results/test_execution_results.json \
  --output reports/bug_analysis/bug_report.json
```

### Example 4: Generate Reports từ Existing Data

```bash
python scripts/generate_comprehensive_report.py \
  --results reports/test_results/test_execution_results.json \
  --bug-report reports/bug_analysis/bug_report.json
```

## Support

For issues or questions, check:
- Log files trong `logs/test_execution/`
- Bug reports trong `reports/bug_analysis/`
- Comprehensive reports trong `reports/comprehensive/`
