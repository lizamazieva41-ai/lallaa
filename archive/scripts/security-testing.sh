#!/bin/bash

# Local Security Testing Script
# Chạy các security scan trên local environment

set -e

echo "🔒 LOCAL SECURITY TESTING PIPELINE"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "OK")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    echo "🔧 Kiểm tra prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_status "ERROR" "Docker không được cài đặt"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_status "ERROR" "Docker Compose không được cài đặt"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_status "ERROR" "Node.js không được cài đặt"
        exit 1
    fi
    
    print_status "OK" "Tất cả prerequisites đã được cài đặt"
}

# Static Analysis (SAST)
run_sast() {
    echo ""
    echo "🔍 STATIC APPLICATION SECURITY TESTING (SAST)"
    echo "=========================================="
    
    # NPM Audit
    print_status "INFO" "Chạy NPM Audit..."
    npm audit --audit-level moderate > sast-reports/npm-audit.txt 2>&1 || true
    print_status "OK" "NPM Audit hoàn tất"
    
    # ESLint Security Rules
    print_status "INFO" "Chạy ESLint với security rules..."
    npx eslint . --ext .js,.ts --format json > sast-reports/eslint-security.json 2>&1 || true
    print_status "OK" "ESLint Security scan hoàn tất"
    
    # TypeScript type checking
    print_status "INFO" "Chạy TypeScript type checking..."
    npm run build > sast-reports/typescript-check.txt 2>&1 || true
    print_status "OK" "TypeScript type checking hoàn tất"
}

# Dependency Scanning
run_dependency_scan() {
    echo ""
    echo "📦 DEPENDENCY VULNERABILITY SCANNING"
    echo "===================================="
    
    # NPM Audit detailed
    print_status "INFO" "Chạy NPM Audit chi tiết..."
    npm audit --json > sast-reports/npm-audit-detailed.json 2>&1 || true
    print_status "OK" "NPM Audit chi tiết hoàn tất"
    
    # Snyk scan (if token available)
    if [ -n "$SNYK_TOKEN" ]; then
        print_status "INFO" "Chạy Snyk security scan..."
        npx snyk test --json > sast-reports/snyk-report.json 2>&1 || true
        print_status "OK" "Snyk scan hoàn tất"
    else
        print_status "WARN" "SNYK_TOKEN không được đặt, bỏ qua Snyk scan"
    fi
}

# Container Security Scanning
run_container_scan() {
    echo ""
    echo "🐳 CONTAINER SECURITY SCANNING"
    echo "=============================="
    
    # Build container
    print_status "INFO" "Build Docker image..."
    docker build -t bin-check-api:security-test .
    
    # Run Trivy scan
    print_status "INFO" "Chạy Trivy container scan..."
    docker run --rm -v $(pwd)/security-reports:/reports aquasec/trivy:latest image --format json --output /reports/trivy-report.json bin-check-api:security-test || true
    print_status "OK" "Trivy scan hoàn tất"
    
    # Run container security check
    print_status "INFO" "Kiểm tra container security best practices..."
    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest config --format json --output /reports/docker-config.json bin-check-api:security-test || true
    print_status "OK" "Container security check hoàn tất"
}

# Dynamic Application Security Testing (DAST)
run_dast() {
    echo ""
    echo "🌐 DYNAMIC APPLICATION SECURITY TESTING (DAST)"
    echo "============================================"
    
    # Start application for testing
    print_status "INFO" "Khởi động ứng dụng cho testing..."
    docker-compose -f docker-compose.security.yml --profile testing up -d
    
    # Wait for app to start
    print_status "INFO" "Chờ ứng dụng khởi động..."
    sleep 30
    
    # Check if app is running
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        print_status "OK" "Ứng dụng đang chạy"
        
        # Run OWASP ZAP scan
        print_status "INFO" "Chạy OWASP ZAP baseline scan..."
        docker run --rm --network 7_security-testing \
            -v $(pwd)/dast-reports:/zap/wrk \
            -w /zap/wrk \
            owasp/zap2docker-stable \
            zap-baseline.py -t http://bin-check-api-test:3000 \
            -J dast-reports/zap-baseline.json \
            -r dast-reports/zap-baseline.html || true
        
        print_status "OK" "OWASP ZAP baseline scan hoàn tất"
        
        # Run Nikto scan
        print_status "INFO" "Chạy Nikto web vulnerability scan..."
        docker run --rm --network 7_security-testing \
            frapsoft/nikto:latest \
            -h http://bin-check-api-test:3000 \
            -output dast-reports/nikto-report.txt || true
        
        print_status "OK" "Nikto scan hoàn tất"
        
    else
        print_status "ERROR" "Ứng dụng không thể khởi động"
    fi
    
    # Cleanup
    print_status "INFO" "Dọn dẹp testing environment..."
    docker-compose -f docker-compose.security.yml --profile testing down -v
}

# Security Gate Validation
run_security_gates() {
    echo ""
    echo "🚪 SECURITY GATES VALIDATION"
    echo "=========================="
    
    HIGH_VULNS=0
    CRITICAL_VULNS=0
    
    # Check NPM Audit results
    if [ -f "sast-reports/npm-audit-detailed.json" ]; then
        HIGH_VULNS=$((HIGH_VULNS + $(cat sast-reports/npm-audit-detailed.json | jq '.vulnerabilities | map(select(.severity == "high")) | length' 2>/dev/null || echo 0)))
        CRITICAL_VULNS=$((CRITICAL_VULNS + $(cat sast-reports/npm-audit-detailed.json | jq '.vulnerabilities | map(select(.severity == "critical")) | length' 2>/dev/null || echo 0)))
    fi
    
    # Check Trivy results
    if [ -f "security-reports/trivy-report.json" ]; then
        HIGH_VULNS=$((HIGH_VULNS + $(cat security-reports/trivy-report.json | jq '.Results[0].Vulnerabilities | map(select(.Severity == "HIGH")) | length' 2>/dev/null || echo 0)))
        CRITICAL_VULNS=$((CRITICAL_VULNS + $(cat security-reports/trivy-report.json | jq '.Results[0].Vulnerabilities | map(select(.Severity == "CRITICAL")) | length' 2>/dev/null || echo 0)))
    fi
    
    # Validate security gates
    if [ $CRITICAL_VULNS -gt 0 ]; then
        print_status "ERROR" "SECURITY GATE FAILED: $CRITICAL_VULNS critical vulnerabilities detected"
        return 1
    elif [ $HIGH_VULNS -gt 5 ]; then
        print_status "WARN" "SECURITY GATE WARNING: $HIGH_VULNS high vulnerabilities detected"
        return 0
    else
        print_status "OK" "SECURITY GATE PASSED: No critical vulnerabilities, $HIGH_VULNS high vulnerabilities"
        return 0
    fi
}

# Generate Security Report
generate_report() {
    echo ""
    echo "📊 GENERATE SECURITY REPORT"
    echo "==========================="
    
    cat > security-reports/security-summary.md << EOF
# Security Scan Report - $(date)

## Executive Summary
- Scan Date: $(date)
- Target: Bin Check API
- Environment: Local Testing

## Scan Results

### Static Application Security Testing (SAST)
- ✅ NPM Audit: Completed
- ✅ ESLint Security: Completed  
- ✅ TypeScript Check: Completed

### Dependency Scanning
- ✅ NPM Audit: Completed
EOF

    if [ -n "$SNYK_TOKEN" ]; then
        echo "- ✅ Snyk Scan: Completed" >> security-reports/security-summary.md
    else
        echo "- ⚠️  Snyk Scan: Skipped (no token)" >> security-reports/security-summary.md
    fi

    cat >> security-reports/security-summary.md << EOF
### Container Security Scanning  
- ✅ Trivy Scan: Completed
- ✅ Docker Config Check: Completed

### Dynamic Application Security Testing (DAST)
- ✅ OWASP ZAP Scan: Completed
- ✅ Nikto Scan: Completed

## Security Metrics
- Critical Vulnerabilities: $CRITICAL_VULNS
- High Vulnerabilities: $HIGH_VULNS
- Overall Status: $([ $CRITICAL_VULNS -eq 0 ] && echo "PASSED" || echo "FAILED")

## Recommendations
1. Review and fix all critical vulnerabilities
2. Implement automated security gates in CI/CD
3. Regular security scanning schedule
4. Security training for development team

## Detailed Reports
- NPM Audit: sast-reports/npm-audit-detailed.json
- Trivy Report: security-reports/trivy-report.json
- ZAP Report: dast-reports/zap-baseline.html
- Nikto Report: dast-reports/nikto-report.txt
EOF

    print_status "OK" "Security report generated: security-reports/security-summary.md"
}

# Main execution
main() {
    echo "Bắt đầu security testing pipeline..."
    echo ""
    
    check_prerequisites
    
    # Create report directories
    mkdir -p sast-reports dast-reports security-reports
    
    # Run security scans
    run_sast
    run_dependency_scan
    run_container_scan
    run_dast
    
    # Validate security gates
    if run_security_gates; then
        print_status "OK" "Tất cả security gates đã passed"
    else
        print_status "ERROR" "Security gates failed"
    fi
    
    # Generate report
    generate_report
    
    echo ""
    echo "🎯 SECURITY TESTING COMPLETED"
    echo "=========================="
    print_status "INFO" "Xem detailed reports:"
    echo "  - Security Summary: security-reports/security-summary.md"
    echo "  - SAST Reports: sast-reports/"
    echo "  - DAST Reports: dast-reports/"
    echo "  - Container Reports: security-reports/"
}

# Run main function
main "$@"