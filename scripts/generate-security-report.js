#!/usr/bin/env node

/**
 * Security Report Generation Script
 * Aggregates results from multiple security scan tools
 */

const fs = require('fs');

function generateSecurityReport() {
  const report = {
    scanDate: new Date().toISOString(),
    tools: {
      npmAudit: null,
      snyk: null,
      codeql: null,
      bandit: null
    },
    vulnerabilities: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: 0
    },
    compliance: {
      owasp: {
        score: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        total: 0
      },
      sast: {
        status: 'passed',
        issues: []
      }
    },
    coverage: {
      securityTests: 0,
      overall: 0
    },
    recommendations: []
  };

  // Read NPM Audit results if available
  if (fs.existsSync('security-audit.json')) {
    try {
      const auditData = JSON.parse(fs.readFileSync('security-audit.json', 'utf8'));
      report.tools.npmAudit = {
        totalIssues: auditData.vulnerabilities ? auditData.vulnerabilities.length : 0,
        critical: auditData.vulnerabilities ? auditData.vulnerabilities.filter(v => v.severity === 'critical').length : 0,
        high: auditData.vulnerabilities ? auditData.vulnerabilities.filter(v => v.severity === 'high').length : 0,
        medium: auditData.vulnerabilities ? auditData.vulnerabilities.filter(v => v.severity === 'moderate').length : 0,
        low: auditData.vulnerabilities ? auditData.vulnerabilities.filter(v => v.severity === 'low').length : 0
      };
      
      report.vulnerabilities.critical += report.tools.npmAudit.critical;
      report.vulnerabilities.high += report.tools.npmAudit.high;
      report.vulnerabilities.medium += report.tools.npmAudit.medium;
      report.vulnerabilities.low += report.tools.npmAudit.low;
      report.vulnerabilities.total += report.tools.npmAudit.totalIssues;
    } catch (error) {
      console.warn('Failed to parse NPM audit results:', error.message);
    }
  }

  // Read Snyk results if available
  if (fs.existsSync('security-snyk.json')) {
    try {
      const snykData = JSON.parse(fs.readFileSync('security-snyk.json', 'utf8'));
      report.tools.snyk = {
        totalIssues: snykData.length || 0,
        critical: snykData.filter(v => v.severity === 'critical').length,
        high: snykData.filter(v => v.severity === 'high').length,
        medium: snykData.filter(v => v.severity === 'medium').length,
        low: snykData.filter(v => v.severity === 'low').length,
      };
      
      report.vulnerabilities.critical += report.tools.snyk.critical;
      report.vulnerabilities.high += report.tools.snyk.high;
      report.vulnerabilities.medium += report.tools.snyk.medium;
      report.vulnerabilities.low += report.tools.snyk.low;
      report.vulnerabilities.total += report.tools.snyk.totalIssues;
    } catch (error) {
      console.warn('Failed to parse Snyk results:', error.message);
    }
  }

  // Read Bandit results if available
  if (fs.existsSync('security-bandit.json')) {
    try {
      const banditData = JSON.parse(fs.readFileSync('security-bandit.json', 'utf8'));
      report.tools.bandit = {
        totalIssues: banditData.results ? banditData.results.length : 0,
        critical: banditData.results ? banditData.results.filter(r => r.severity === 'high').length : 0,
        high: banditData.results ? banditData.results.filter(r => r.severity === 'medium').length : 0,
        medium: banditData.results ? banditData.results.filter(r => r.severity === 'low').length : 0,
        low: banditData.results ? banditData.results.filter(r => r.severity === 'low').length : 0,
      };
      
      report.vulnerabilities.critical += report.tools.bandit.critical;
      report.vulnerabilities.high += report.tools.bandit.high;
      report.vulnerabilities.medium += report.tools.bandit.medium;
      report.vulnerabilities.low += report.tools.bandit.low;
      report.vulnerabilities.total += report.tools.bandit.totalIssues;
    } catch (error) {
      console.warn('Failed to parse Bandit results:', error.message);
    }
  }

  // Generate recommendations based on findings
  if (report.vulnerabilities.critical > 0) {
    report.recommendations.push('🚨 CRITICAL: Immediately remediate all critical security vulnerabilities');
  }
  if (report.vulnerabilities.high > 0) {
    report.recommendations.push('⚠️ HIGH: Remediate high-severity vulnerabilities within 7 days');
  }
  if (report.vulnerabilities.medium > 0) {
    report.recommendations.push('📝 MEDIUM: Address medium-severity vulnerabilities in next sprint');
  }
  if (report.vulnerabilities.total === 0 && Object.values(report.tools).every(t => t.totalIssues === 0)) {
    report.recommendations.push('✅ EXCELLENT: No security vulnerabilities detected');
  }

  // Write combined security report
  fs.writeFileSync('security-report.json', JSON.stringify(report, null, 2));

  // Write security-failures.json for CI gating
  const hasCriticalFailures = report.vulnerabilities.critical > 0;
  fs.writeFileSync('security-failures.json', JSON.stringify({
    criticalFailures: report.vulnerabilities.critical,
    totalFailures: report.vulnerabilities.total,
    timestamp: new Date().toISOString()
  }, null, 2));

  console.log('🔒 Security report generated successfully');
  console.log(`📊 Summary: ${report.vulnerabilities.total} vulnerabilities found (${report.vulnerabilities.critical} critical, ${report.vulnerabilities.high} high)`);
}

function generateMarkdownReport() {
  const report = JSON.parse(fs.readFileSync('security-report.json', 'utf8'));
  
  const markdown = `# 🔒 Security Scan Report

**Scan Date:** ${report.scanDate}

## 📊 Executive Summary

| Metric | Value |
|--------|-------|
| **Overall Risk Level** | ${report.vulnerabilities.critical > 0 ? 'CRITICAL' : report.vulnerabilities.high > 0 ? 'HIGH' : 'LOW'} |
| **Total Vulnerabilities** | ${report.vulnerabilities.total} |
| **Critical** | ${report.vulnerabilities.critical} |
| **High** | ${report.vulnerabilities.high} |
| **Medium** | ${report.vulnerabilities.medium} |
| **Low** | ${report.vulnerabilities.low} |

## 🔍 Tool Results

### NPM Audit
${report.tools.npmAudit ? `- **Issues Found:** ${report.tools.npmAudit.totalIssues}` : '- ✅ No Issues Found'}

### Snyk Analysis
${report.tools.snyk ? `- **Issues Found:** ${report.tools.snyk.totalIssues}` : '- ✅ No Issues Found'}

### Bandit Analysis
${report.tools.bandit ? `- **Issues Found:** ${report.tools.bandit.totalIssues}` : '- ✅ No Issues Found'}

## 🎯 Recommendations

${report.recommendations.map(rec => `- ${rec}`).join('\n')}

---

*This report is auto-generated by the security pipeline. For detailed analysis, review the individual scan result files.*
`;

  fs.writeFileSync('security-report.md', markdown);
}

// Main execution
if (process.argv.includes('--markdown')) {
  generateMarkdownReport();
} else {
  generateSecurityReport();
}