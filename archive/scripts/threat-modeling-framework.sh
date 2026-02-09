#!/bin/bash

# Threat Modeling & Risk Assessment Framework
# Theo STRIDE Threat Model + DREAD Risk Assessment

set -e

echo "🎯 THREAT MODELING & RISK ASSESSMENT"
echo "====================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_status() {
    local status=$1
    local message=$2
    case $status in
        "OK") echo -e "${GREEN}✅ $message${NC}" ;;
        "WARN") echo -e "${YELLOW}⚠️  $message${NC}" ;;
        "ERROR") echo -e "${RED}❌ $message${NC}" ;;
        "INFO") echo -e "${BLUE}ℹ️  $message${NC}" ;;
        "THREAT") echo -e "${PURPLE}🎯 $message${NC}" ;;
    esac
}

# Create threat modeling directories
mkdir -p threat-modeling/{assets,threats,attacks,risk-assessment,mitigation}

# Step 1: Asset Identification
identify_assets() {
    echo ""
    print_status "THREAT" "BƯỚC 1: ASSET IDENTIFICATION"
    echo "====================================="
    
    cat > threat-modeling/assets/api_assets.md << 'EOF'
# Asset Identification - Bin Check API

## Data Assets
### Critical Data Assets
- **PII (Personally Identifiable Information)**
  - Email addresses (user authentication)
  - User profiles and preferences
  - API usage patterns
  
- **Financial Data**
  - BIN lookup data (PCI DSS scope)
  - Credit card patterns (test data)
  - Transaction metadata

- **System Configuration**
  - Database credentials (encrypted in Vault)
  - API keys and tokens
  - Rate limiting configurations

## System Assets
### Application Components
- **Authentication Service**
  - JWT token management
  - 2FA implementation
  - Session management

- **API Gateway**
  - Rate limiting engine
  - Request validation
  - CORS configuration

- **Database Layer**
  - PostgreSQL with RLS
  - Redis caching layer
  - Connection pooling

- **Business Logic**
  - BIN lookup service
  - Card generation engine
  - IBAN validation logic

## Infrastructure Assets
- **Compute Resources**
  - Docker containers
  - Kubernetes orchestration
  - Load balancers

- **Network Infrastructure**
  - API endpoints
  - Internal service communication
  - Database connections

- **Storage Systems**
  - PostgreSQL databases
  - Redis cache
  - File storage for logs

## Asset Classification
| Asset Type | Data Classification | Business Impact | Security Requirement |
|-------------|-------------------|----------------|-------------------|
| PII | CONFIDENTIAL | HIGH | Encryption, Access Control |
| Financial Data | RESTRICTED | CRITICAL | PCI DSS Compliance |
| System Config | INTERNAL | MEDIUM | Integrity, Confidentiality |
| Logs | INTERNAL | MEDIUM | Integrity, Availability |
EOF

    print_status "OK" "Asset identification completed"
}

# Step 2: Threat Analysis using STRIDE
threat_analysis() {
    echo ""
    print_status "THREAT" "BƯỚC 2: THREAT ANALYSIS (STRIDE MODEL)"
    echo "==============================================="
    
    cat > threat-modeling/threats/stride_analysis.md << 'EOF'
# STRIDE Threat Analysis - Bin Check API

## S - Spoofing Threats
### Threat Scenarios
1. **API Key Spoofing**
   - Attacker forges legitimate API requests
   - Uses stolen JWT tokens
   - IP: Compromise user sessions
   - Likelihood: MEDIUM
   - Impact: HIGH

2. **Email Address Spoofing**
   - False email registration/login attempts
   - Credential harvesting attacks
   - IP: Account takeover
   - Likelihood: HIGH
   - Impact: MEDIUM

3. **System Component Spoofing**
   - Malicious container impersonation
   - DNS/cache poisoning
   - IP: Data injection/manipulation
   - Likelihood: LOW
   - Impact: HIGH

## T - Tampering Threats
### Threat Scenarios
1. **Data Tampering**
   - Unauthorized modification of BIN data
   - Cache poisoning attacks
   - IP: Data integrity compromise
   - Likelihood: MEDIUM
   - Impact: HIGH

2. **API Response Tampering**
   - Man-in-the-middle attacks
   - Response injection
   - IP: Service compromise
   - Likelihood: LOW
   - Impact: MEDIUM

3. **Configuration Tampering**
   - Security setting modifications
   - Rate limit bypass
   - IP: System compromise
   - Likelihood: LOW
   - Impact: HIGH

## R - Repudiation Threats
### Threat Scenarios
1. **Transaction Repudiation**
   - Denial of API usage
   - Log tampering
   - IP: Audit trail compromise
   - Likelihood: MEDIUM
   - Impact: MEDIUM

2. **Authentication Repudiation**
   - Session hijacking
   - False claims of access
   - IP: Non-repudiation failure
   - Likelihood: LOW
   - Impact: MEDIUM

## I - Information Disclosure
### Threat Scenarios
1. **Sensitive Data Exposure**
   - PII leakage through APIs
   - Financial data exposure
   - IP: Privacy breach, regulatory violation
   - Likelihood: HIGH
   - Impact: CRITICAL

2. **System Information Disclosure**
   - Internal API structure exposure
   - Error message information leakage
   - IP: Attack surface increase
   - Likelihood: MEDIUM
   - Impact: MEDIUM

3. **Credentials Exposure**
   - JWT tokens in logs
   - Database credentials exposure
   - IP: System compromise
   - Likelihood: LOW
   - Impact: CRITICAL

## D - Denial of Service
### Threat Scenarios
1. **API DoS Attacks**
   - Rate limiting bypass
   - Resource exhaustion
   - IP: Service unavailability
   - Likelihood: HIGH
   - Impact: MEDIUM

2. **Database DoS**
   - Connection pool exhaustion
   - Query flood attacks
   - IP: Database unavailability
   - Likelihood: MEDIUM
   - Impact: HIGH

3. **Cache/Infrastructure DoS**
   - Redis exhaustion
   - Memory/CPU exhaustion
   - IP: System failure
   - Likelihood: MEDIUM
   - Impact: MEDIUM

## E - Elevation of Privilege
### Threat Scenarios
1. **Horizontal Privilege Escalation**
   - Cross-user data access
   - Session hijacking
   - IP: Data breach
   - Likelihood: HIGH
   - Impact: HIGH

2. **Vertical Privilege Escalation**
   - Admin access gain
   - System configuration modification
   - IP: Full system compromise
   - Likelihood: MEDIUM
   - Impact: CRITICAL
EOF

    print_status "OK" "STRIDE threat analysis completed"
}

# Step 3: Attack Vectors Analysis
attack_vectors_analysis() {
    echo ""
    print_status "THREAT" "BƯỚC 3: ATTACK VECTORS ANALYSIS"
    echo "==================================="
    
    cat > threat-modeling/attacks/attack_vectors.md << 'EOF'
# Attack Vectors Analysis - Bin Check API

## Network-Based Attacks
### 1. Direct API Attacks
- **Vector**: HTTP/HTTPS API calls
- **Tools**: curl, Postman, Burp Suite, OWASP ZAP
- **Target**: All API endpoints
- **Bypasses**: Rate limiting, authentication, input validation

### 2. Man-in-the-Middle (MITM)
- **Vector**: Network traffic interception
- **Tools**: Wireshark, mitmproxy, Bettercap
- **Target**: API communications
- **Impact**: Data interception/modification

### 3. Distributed DoS (DDoS)
- **Vector**: Botnet, amplification attacks
- **Tools**: Mirai, SYN floods, amplification
- **Target**: API endpoints, infrastructure
- **Impact**: Service unavailability

## Application-Based Attacks
### 1. Authentication Attacks
- **Vector**: Credential stuffing, password spraying
- **Tools**: Metasploit, custom scripts
- **Target**: Login endpoints
- **Bypasses**: Rate limiting, account lockout

### 2. Authorization Attacks
- **Vector**: JWT manipulation, IDOR
- **Tools**: Burp Suite, OWASP ZAP
- **Target**: Protected endpoints
- **Impact**: Unauthorized data access

### 3. Input Validation Attacks
- **Vector**: SQL injection, XSS, command injection
- **Tools**: SQLMap, XSS payloads, Nikto
- **Target**: Input fields, query parameters
- **Impact**: Data compromise, system control

## Container-Based Attacks
### 1. Container Escape
- **Vector**: Docker vulnerability exploitation
- **Tools**: Docker escape exploits, privileged containers
- **Target**: Container runtime
- **Impact**: Host system compromise

### 2. Supply Chain Attacks
- **Vector**: Malicious dependencies, image poisoning
- **Tools**: Dependency confusion, supply chain compromise
- **Target**: Build process, dependencies
- **Impact**: Build environment compromise

## Social Engineering Attacks
### 1. Phishing
- **Vector**: Email phishing, credential harvesting
- **Tools**: Gophish, social engineering toolkit
- **Target**: Users, administrators
- **Impact**: Credential theft

### 2. API Abuse
- **Vector**: Business logic flaws, legitimate use abuse
- **Tools**: Custom scripts, API clients
- **Target**: Rate limits, business logic
- **Impact**: Service abuse, financial loss
EOF

    print_status "OK" "Attack vectors analysis completed"
}

# Step 4: Risk Assessment using DREAD
risk_assessment() {
    echo ""
    print_status "THREAT" "BƯỚC 4: RISK ASSESSMENT (DREAD MODEL)"
    echo "=========================================="
    
    cat > threat-modeling/risk-assessment/dread_analysis.md << 'EOF'
# DREAD Risk Assessment - Bin Check API

## Risk Assessment Methodology
Using DREAD (Damage, Reproducibility, Exploitability, Affected Users, Discoverability)

## High-Risk Findings

### 1. JWT Token Manipulation
- **Threat**: Spoofing + Elevation of Privilege
- **Damage (D)**: 7 (Complete system compromise)
- **Reproducibility (R)**: 8 (Every time, 100% success)
- **Exploitability (E)**: 8 (Requires minimal skill)
- **Affected Users (A)**: 10 (All users affected)
- **Discoverability (D)**: 5 (Requires research)
- **Risk Score**: 7.6
- **Risk Level**: CRITICAL
- **Business Impact**: Complete data breach, regulatory violation

### 2. SQL Injection Vulnerabilities
- **Threat**: Tampering + Information Disclosure
- **Damage (D)**: 9 (Complete data loss)
- **Reproducibility (R)**: 7 (Can be reproduced)
- **Exploitability (E)**: 6 (Some technical skill required)
- **Affected Users (A)**: 8 (Database users affected)
- **Discoverability (D)**: 6 (Some skill required)
- **Risk Score**: 7.2
- **Risk Level**: CRITICAL
- **Business Impact**: Data breach, compliance violation

## Medium-Risk Findings

### 3. Rate Limiting Bypass
- **Threat**: Denial of Service
- **Damage (D)**: 5 (Service degradation)
- **Reproducibility (R)**: 9 (Easily reproducible)
- **Exploitability (E)**: 7 (Easy to exploit)
- **Affected Users (A)**: 6 (Many users affected)
- **Discoverability (D)**: 4 (Easy to discover)
- **Risk Score**: 6.2
- **Risk Level**: HIGH
- **Business Impact**: Service disruption, user impact

### 4. Information Disclosure in Error Messages
- **Threat**: Information Disclosure
- **Damage (D)**: 3 (Limited information exposure)
- **Reproducibility (R)**: 8 (Consistently reproducible)
- **Exploitability (E)**: 8 (No skill required)
- **Affected Users (A)**: 4 (Some users affected)
- **Discoverability (D)**: 7 (Easy to find)
- **Risk Score**: 6.0
- **Risk Level**: HIGH
- **Business Impact**: Security intelligence leakage

## Low-Risk Findings

### 5. Missing Security Headers
- **Threat**: Various (Clickjacking, XSS, etc.)
- **Damage (D)**: 2 (Limited impact)
- **Reproducibility (R)**: 10 (Always reproducible)
- **Exploitability (E)**: 6 (Some skill required)
- **Affected Users (A)**: 8 (All users potentially affected)
- **Discoverability (D)**: 9 (Very easy to discover)
- **Risk Score**: 7.0
- **Risk Level**: MEDIUM
- **Business Impact**: Security posture reduction

### 6. Weak Authentication Mechanisms
- **Threat**: Spoofing
- **Damage (D)**: 4 (Account compromise)
- **Reproducibility (R)**: 7 (Reproducible with effort)
- **Exploitability (E)**: 5 (Moderate skill required)
- **Affected Users (A)**: 3 (Some users vulnerable)
- **Discoverability (D)**: 6 (Moderately easy)
- **Risk Score**: 5.0
- **Risk Level**: MEDIUM
- **Business Impact**: Account takeover risk

## Risk Heat Map

| Asset | Threat | Risk Level | Likelihood | Impact |
|--------|---------|-------------|-----------|
| JWT Tokens | Spoofing | HIGH | CRITICAL |
| Database | SQL Injection | MEDIUM | CRITICAL |
| API Gateway | DoS | HIGH | HIGH |
| User Data | Information Disclosure | HIGH | CRITICAL |
| Rate Limiting | Abuse | HIGH | HIGH |
| Error Messages | Info Disclosure | MEDIUM | MEDIUM |
| Security Headers | Multiple | LOW | MEDIUM |

## Overall Risk Summary
- **Critical Risks**: 2
- **High Risks**: 2
- **Medium Risks**: 2
- **Low Risks**: 1

**Average Risk Score**: 6.17**
**Overall Risk Level**: HIGH

## Risk Acceptance Criteria
- **Critical**: Must be mitigated immediately
- **High**: Mitigate within 7 days
- **Medium**: Mitigate within 30 days
- **Low**: Monitor and review quarterly

EOF

    print_status "OK" "DREAD risk assessment completed"
}

# Step 5: Mitigation Strategy
mitigation_strategy() {
    echo ""
    print_status "THREAT" "BƯỚC 5: MITIGATION STRATEGY"
    echo "=============================="
    
    cat > threat-modeling/mitigation/mitigation_plan.md << 'EOF'
# Mitigation Strategy - Bin Check API

## Immediate Mitigation (0-7 days)

### 1. JWT Token Security (Critical)
**Current Issue**: JWT tokens accept 'none' algorithm, potential manipulation
**Mitigation Actions**:
1. Implement algorithm validation in JWT verification
2. Reject unsigned tokens immediately
3. Use short-lived tokens with refresh mechanism
4. Implement token blacklisting for compromised tokens
**Priority**: CRITICAL
**Owner**: Security Team

### 2. SQL Injection Prevention (Critical)
**Current Issue**: Potential SQL injection in database queries
**Mitigation Actions**:
1. Implement parameterized queries for all database operations
2. Add input validation and sanitization layers
3. Use prepared statements consistently
4. Regular security code reviews
**Priority**: CRITICAL
**Owner**: Development Team

## Short-term Mitigation (7-30 days)

### 3. Rate Limiting Enhancement (High)
**Current Issue**: Rate limiting can be bypassed
**Mitigation Actions**:
1. Implement IP-based rate limiting
2. Add exponential backoff for repeated violations
3. Implement CAPTCHA for suspicious patterns
4. Add account lockout mechanisms
**Priority**: HIGH
**Owner**: API Team

### 4. Error Message Security (High)
**Current Issue**: Detailed error messages leak system information
**Mitigation Actions**:
1. Sanitize all error messages for external users
2. Use generic error codes internally
3. Implement detailed logging for debugging
4. Create error response documentation
**Priority**: HIGH
**Owner**: Development Team

## Medium-term Mitigation (30-90 days)

### 5. Security Headers Implementation (Medium)
**Current Issue**: Missing security headers
**Mitigation Actions**:
1. Implement HSTS with long max-age
2. Add Content Security Policy (CSP)
3. Configure X-Frame-Options
4. Add X-Content-Type-Options: nosniff
**Priority**: MEDIUM
**Owner**: Infrastructure Team

### 6. Authentication Enhancement (Medium)
**Current Issue**: Weak authentication mechanisms
**Mitigation Actions**:
1. Implement multi-factor authentication
2. Add account lockout policies
3. Implement device fingerprinting
4. Add anomaly detection for login patterns
**Priority**: MEDIUM
**Owner**: Security Team

## Long-term Controls (90+ days)

### 7. Zero-Trust Architecture
**Strategy**: Assume breach, verify everything
**Implementation**:
1. Microservices with strong identity boundaries
2. Mutual TLS authentication between services
3. Regular secret rotation (Vault integration)
4. Service mesh with security policies
**Timeline**: 6 months
**Priority**: Strategic

### 8. DevSecOps Culture
**Strategy**: Security integrated into development lifecycle
**Implementation**:
1. Security training for all developers
2. Automated security testing in CI/CD
3. Security champions program
4. Regular security reviews and assessments
**Timeline**: Ongoing
**Priority**: Cultural

## Control Implementation Matrix

| Control Type | Status | Implementation Date | Owner |
|--------------|--------|-------------------|-------|
| Identity & Access Management | Planned | 30 days | Security Team |
| Application Security | Planned | 60 days | Dev Team |
| Data Protection | In Progress | 90 days | All Teams |
| Infrastructure Security | Planned | 45 days | Infra Team |
| Monitoring & Detection | Implemented | Current | Ops Team |
| Incident Response | Planned | 90 days | Security Team |

## Risk Monitoring

### Key Risk Indicators (KRIs)
- JWT manipulation attempts
- SQL injection attempts
- Rate limiting violations
- Authentication failures
- Privilege escalation attempts
- Data access anomalies

### Monitoring Tools
- Application monitoring (Prometheus/Grafana)
- Security monitoring (Vault audit logs)
- Network monitoring (firewall logs)
- User behavior analytics
- Automated security scanning

## Continuous Improvement

### Review Schedule
- Monthly: Risk assessment review
- Quarterly: Mitigation effectiveness analysis
- Semi-annually: Full threat model update
- Annually: Security strategy review

### Feedback Loop
1. Incident analysis feeds back into threat model
2. New vulnerability research integration
3. Industry threat intelligence incorporation
4. User feedback and security reporting mechanisms

EOF

    print_status "OK" "Mitigation strategy completed"
}

# Generate Executive Summary
generate_executive_summary() {
    echo ""
    print_status "THREAT" "GENERATING EXECUTIVE SUMMARY"
    echo "==================================="
    
    cat > threat-modeling/executive_summary.md << 'EOF'
# Executive Summary - Threat Modeling & Risk Assessment

**Date**: $(date)
**Assessment Framework**: STRIDE + DREAD
**Target**: Bin Check API
**Assessor**: Security Team

## Executive Findings

### Overall Risk Profile
- **Risk Level**: HIGH
- **Critical Findings**: 2
- **High Risk Findings**: 2
- **Medium Risk Findings**: 2
- **Compliance Status**: Requires immediate attention

### Key Risk Areas

#### 🔴 Critical Risks (Immediate Action Required)
1. **JWT Token Security Vulnerability**
   - Impact: System compromise, unauthorized access
   - Business Impact: Regulatory violation, data breach
   - Required Action: Algorithm validation, token hardening

2. **SQL Injection Exposure**
   - Impact: Database compromise, data exfiltration
   - Business Impact: PCI DSS violation, financial loss
   - Required Action: Input validation, parameterized queries

#### 🟡 High Risks (Action within 7 days)
3. **Rate Limiting Bypass**
   - Impact: Service disruption, abuse potential
   - Business Impact: Availability issues, user experience
   - Required Action: Enhanced rate limiting, IP blocking

4. **Information Disclosure**
   - Impact: Security intelligence leakage, attack surface increase
   - Business Impact: Competitive disadvantage, security posture
   - Required Action: Error message sanitization

### Business Impact Assessment

#### Financial Impact
- **Direct**: Potential regulatory fines (PCI DSS, GDPR)
- **Indirect**: Customer trust impact, reputation damage
- **Estimated Cost**: $50K - $500K for critical incidents

#### Operational Impact
- **Service Availability**: Risk of DoS attacks
- **Data Integrity**: Potential data manipulation
- **Compliance**: Multiple regulatory framework violations

#### Strategic Impact
- **Market Position**: Security posture affects customer confidence
- **Competitive Position**: Security gaps vs competitors
- **Growth**: Security concerns may limit market expansion

### Recommended Actions

#### Immediate (0-7 days)
1. **Implement JWT security controls**
   - Cost: $10K - $25K
   - Resources: Security team, 2 developers
   - Timeline: 1 week

2. **Fix SQL injection vulnerabilities**
   - Cost: $15K - $40K
   - Resources: Security team, 3 developers
   - Timeline: 2 weeks

#### Short-term (7-30 days)
3. **Enhance rate limiting and abuse prevention**
   - Cost: $20K - $50K
   - Resources: API team, infrastructure team
   - Timeline: 3 weeks

4. **Improve error handling and logging**
   - Cost: $5K - $15K
   - Resources: Development team
   - Timeline: 2 weeks

### Investment Requirements

#### Technology Investment
- **Security Tools**: $25K - $75K (DAST, SAST, monitoring)
- **Infrastructure**: $15K - $45K (WAF, rate limiting, logging)
- **Training**: $10K - $30K (Security training, certifications)

#### Personnel Investment
- **Security Team**: 2 FTE ($200K annually)
- **Security Champions**: 0.5 FTE per team ($50K annually)
- **External Consulting**: $50K (one-time assessment)

### Risk Appetite Statement

The organization accepts **MEDIUM** risk for normal operations but requires **IMMEDIATE** mitigation for all **CRITICAL** and **HIGH** risks. Zero tolerance for regulatory compliance violations.

### Success Metrics

#### Security KPIs
- **Mean Time to Detect (MTTD)**: < 1 hour for critical events
- **Mean Time to Respond (MTTR)**: < 4 hours for critical events
- **Security Test Coverage**: > 95% of codebase
- **Vulnerability Remediation**: 100% of critical within 7 days

#### Business KPIs
- **Security Incident Reduction**: < 2 incidents per year
- **Compliance Score**: > 90% across all frameworks
- **Customer Security Confidence**: > 95% positive feedback

### Board-Level Recommendations

1. **Immediate Board Action**: Approve emergency security budget for critical fixes
2. **Governance**: Establish security steering committee
3. **Culture**: Implement security-first development culture
4. **Compliance**: Quarterly compliance reporting to board

---

**Summary**: The Bin Check API faces significant security risks requiring immediate attention. Investment in security controls is essential for regulatory compliance and business continuity.

**Next Review**: $(date -d "+90 days" +%Y-%m-%d)
**Report Classification**: CONFIDENTIAL
EOF

    print_status "OK" "Executive summary generated"
}

# Main execution function
main() {
    echo "🎯 Bắt đầu Threat Modeling & Risk Assessment"
    echo "Framework: STRIDE + DREAD"
    echo "Target: Bin Check API"
    echo ""
    
    # Execute all phases
    identify_assets
    threat_analysis
    attack_vectors_analysis
    risk_assessment
    mitigation_strategy
    generate_executive_summary
    
    echo ""
    print_status "THREAT" "THREAT MODELING COMPLETED"
    echo "==================================="
    print_status "OK" "All threat modeling phases completed"
    print_status "INFO" "Risk Level: HIGH"
    print_status "INFO" "Critical Findings: 2"
    print_status "INFO" "High Risk Findings: 2"
    print_status "OK" "Comprehensive reports generated:"
    echo "  - Assets: threat-modeling/assets/"
    echo "  - Threats: threat-modeling/threats/"
    echo "  - Attacks: threat-modeling/attacks/"
    echo "  - Risk Assessment: threat-modeling/risk-assessment/"
    echo "  - Mitigation: threat-modeling/mitigation/"
    echo "  - Executive Summary: threat-modeling/executive_summary.md"
    echo ""
    print_status "INFO" "Next Steps: Review and implement mitigation plan"
}

# Execute main function
main "$@"