#!/usr/bin/env node
/**
 * Script Node.js để di chuyển file vào archive
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ARCHIVE = path.join(ROOT, 'archive');

// Danh sách file báo cáo cần di chuyển
const REPORT_FILES = [
  'ANALYSIS_REPORT.md',
  'ANALYSIS_RESULTS_SUMMARY.md',
  'ANALYSIS_SYSTEM_IMPLEMENTATION.md',
  'ANALYSIS_SYSTEM_NEXT_STEPS.md',
  'FINAL_SUMMARY.md',
  'FINAL_DEPLOYMENT_TICKETS.md',
  'IMPLEMENTATION_PLAN.md',
  'IMPLEMENTATION_SUMMARY.md',
  'PRODUCTION_COMPLETION_REPORT.md',
  'PRODUCTION_DEPLOYMENT_TICKETS.md',
  'PRODUCTION_READY.md',
  'DATA_QUALITY_REPORT.md',
  'PERFORMANCE_ANALYSIS.md',
  'SECURITY_ASSESSMENT.md',
  'TECHNICAL_ANALYSIS.md',
  'VALIDATION_REPORT.md',
  'REVIEW_CHECKLIST.md',
  'TEAM_SHARING_GUIDE.md',
  'QUICK_START_GUIDE.md',
  'GITHUB_ACTIONS_SETUP.md',
  'AUTOMATION_GUIDE.md',
  'IMPROVEMENTS_APPLIED.md',
  'ITERATION_GUIDE.md',
  'HOW_TO_RUN_ANALYSIS.md',
  'COMPLETE_ACTION_PLAN.md',
  'PLAN.md',
  'RECOMMENDATIONS_ROADMAP.md',
  'ke_hoach_cai_thien_payment_api.md',
  'DEPLOYMENT_TICKETS.md',
];

// SQL debug files
const SQL_DEBUG_FILES = [
  'debug-final-rls.sql',
  'debug-rls.sql',
  'debug-session-vars.sql',
  'test-rls-debug.sql',
  'test-rls-direct.sql',
  'test-rls-isolation-only.sql',
  'test-rls-simple-debug.sql',
];

// Docker compose variants
const DOCKER_FILES = [
  'docker-compose.vault-dev.yml',
  'docker-compose.vault-minimal.yml',
  'docker-compose.vault-corrected.yml',
  'docker-compose.vault-simple.yml',
  'docker-compose.vault-prod.yml',
  'docker-compose.vault-fixed.yml',
  'docker-compose.monitoring-simple.yml',
  'docker-compose.security.yml',
];

// Framework scripts
const FRAMEWORK_SCRIPTS = [
  'owasp-compliance-framework.sh',
  'threat-modeling-framework.sh',
  'pentest-framework.sh',
  'remediation-plan-framework.sh',
  'security-controls-validation.sh',
  'security-testing.sh',
  'security-testing-simple.sh',
  'deploy-security-infrastructure.sh',
  'deploy-monitoring.sh',
  'deploy-vault.sh',
  'migrate-to-vault.sh',
  'verify-vault-secrets.sh',
];

// Thư mục cần archive
const ASSESSMENT_DIRS = [
  'compliance-assessment',
  'remediation-plans',
  'threat-modeling',
  'security-controls',
  'pentest-tools',
];

const SECURITY_REPORT_DIRS = [
  'sast-reports',
  'security-reports',
  'dast-reports',
];

function moveFile(src, dst, description) {
  try {
    if (fs.existsSync(src)) {
      const dstDir = path.dirname(dst);
      if (!fs.existsSync(dstDir)) {
        fs.mkdirSync(dstDir, { recursive: true });
      }
      fs.renameSync(src, dst);
      console.log(`✅ Moved: ${description}`);
      return true;
    } else {
      console.log(`⚠️  Not found: ${path.basename(src)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error moving ${path.basename(src)}: ${error.message}`);
    return false;
  }
}

function moveDirectory(src, dst, description) {
  try {
    if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
      const dstDir = path.dirname(dst);
      if (!fs.existsSync(dstDir)) {
        fs.mkdirSync(dstDir, { recursive: true });
      }
      fs.renameSync(src, dst);
      console.log(`✅ Moved directory: ${description}`);
      return true;
    } else {
      console.log(`⚠️  Directory not found: ${path.basename(src)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error moving directory ${path.basename(src)}: ${error.message}`);
    return false;
  }
}

function main() {
  console.log('=== Automated Cleanup Script (Node.js) ===\n');
  
  let movedCount = 0;
  
  // Di chuyển báo cáo
  console.log('1. Moving report files to archive/reports/...');
  for (const filename of REPORT_FILES) {
    const src = path.join(ROOT, filename);
    const dst = path.join(ARCHIVE, 'reports', filename);
    if (moveFile(src, dst, filename)) {
      movedCount++;
    }
  }
  console.log();
  
  // Di chuyển SQL debug files
  console.log('2. Moving SQL debug files to src/database/debug/...');
  const debugDir = path.join(ROOT, 'src', 'database', 'debug');
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true });
  }
  for (const filename of SQL_DEBUG_FILES) {
    const src = path.join(ROOT, filename);
    const dst = path.join(debugDir, filename);
    if (moveFile(src, dst, filename)) {
      movedCount++;
    }
  }
  console.log();
  
  // Di chuyển docker-compose variants
  console.log('3. Moving docker-compose variants to archive/docker/...');
  for (const filename of DOCKER_FILES) {
    const src = path.join(ROOT, filename);
    const dst = path.join(ARCHIVE, 'docker', filename);
    if (moveFile(src, dst, filename)) {
      movedCount++;
    }
  }
  console.log();
  
  // Di chuyển framework scripts
  console.log('4. Moving framework scripts to archive/scripts/...');
  for (const filename of FRAMEWORK_SCRIPTS) {
    const src = path.join(ROOT, filename);
    const dst = path.join(ARCHIVE, 'scripts', filename);
    if (moveFile(src, dst, filename)) {
      movedCount++;
    }
  }
  console.log();
  
  // Di chuyển thư mục đánh giá bảo mật
  console.log('5. Moving security assessment directories...');
  for (const dirname of ASSESSMENT_DIRS) {
    const src = path.join(ROOT, dirname);
    const dst = path.join(ARCHIVE, 'security-assessments', dirname);
    if (moveDirectory(src, dst, dirname)) {
      movedCount++;
    }
  }
  console.log();
  
  // Di chuyển thư mục báo cáo bảo mật
  console.log('6. Moving security report directories...');
  for (const dirname of SECURITY_REPORT_DIRS) {
    const src = path.join(ROOT, dirname);
    const dst = path.join(ARCHIVE, 'security-reports', dirname);
    if (moveDirectory(src, dst, dirname)) {
      movedCount++;
    }
  }
  console.log();
  
  console.log(`=== Completed: ${movedCount} items moved ===`);
}

main();
