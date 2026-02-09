#!/usr/bin/env python3
"""
Script tự động dọn dẹp dự án - Di chuyển file vào archive
"""

import os
import shutil
from pathlib import Path

# Đường dẫn gốc
ROOT = Path(__file__).parent
ARCHIVE = ROOT / "archive"

# Danh sách file báo cáo cần di chuyển vào archive/reports/
REPORT_FILES = [
    "ANALYSIS_REPORT.md",
    "ANALYSIS_RESULTS_SUMMARY.md",
    "ANALYSIS_SYSTEM_IMPLEMENTATION.md",
    "ANALYSIS_SYSTEM_NEXT_STEPS.md",
    "FINAL_SUMMARY.md",
    "FINAL_DEPLOYMENT_TICKETS.md",
    "IMPLEMENTATION_PLAN.md",
    "IMPLEMENTATION_SUMMARY.md",
    "PRODUCTION_COMPLETION_REPORT.md",
    "PRODUCTION_DEPLOYMENT_TICKETS.md",
    "PRODUCTION_READY.md",
    "DATA_QUALITY_REPORT.md",
    "PERFORMANCE_ANALYSIS.md",
    "SECURITY_ASSESSMENT.md",
    "TECHNICAL_ANALYSIS.md",
    "VALIDATION_REPORT.md",
    "REVIEW_CHECKLIST.md",
    "TEAM_SHARING_GUIDE.md",
    "QUICK_START_GUIDE.md",
    "GITHUB_ACTIONS_SETUP.md",
    "AUTOMATION_GUIDE.md",
    "IMPROVEMENTS_APPLIED.md",
    "ITERATION_GUIDE.md",
    "HOW_TO_RUN_ANALYSIS.md",
    "COMPLETE_ACTION_PLAN.md",
    "PLAN.md",
    "RECOMMENDATIONS_ROADMAP.md",
    "ke_hoach_cai_thien_payment_api.md",
    "DEPLOYMENT_TICKETS.md",
]

# Danh sách file SQL debug cần di chuyển vào src/database/debug/
SQL_DEBUG_FILES = [
    "debug-final-rls.sql",
    "debug-rls.sql",
    "debug-session-vars.sql",
    "test-rls-debug.sql",
    "test-rls-direct.sql",
    "test-rls-isolation-only.sql",
    "test-rls-simple-debug.sql",
]

# Danh sách docker-compose variants cần archive
DOCKER_FILES = [
    "docker-compose.vault-dev.yml",
    "docker-compose.vault-minimal.yml",
    "docker-compose.vault-corrected.yml",
    "docker-compose.vault-simple.yml",
    "docker-compose.vault-prod.yml",
    "docker-compose.vault-fixed.yml",
    "docker-compose.monitoring-simple.yml",
    "docker-compose.security.yml",
]

# Danh sách script framework cần archive
FRAMEWORK_SCRIPTS = [
    "owasp-compliance-framework.sh",
    "threat-modeling-framework.sh",
    "pentest-framework.sh",
    "remediation-plan-framework.sh",
    "security-controls-validation.sh",
    "security-testing.sh",
    "security-testing-simple.sh",
    "deploy-security-infrastructure.sh",
    "deploy-monitoring.sh",
    "deploy-vault.sh",
    "migrate-to-vault.sh",
    "verify-vault-secrets.sh",
]

# Thư mục cần archive
ASSESSMENT_DIRS = [
    "compliance-assessment",
    "remediation-plans",
    "threat-modeling",
    "security-controls",
    "pentest-tools",
]

SECURITY_REPORT_DIRS = [
    "sast-reports",
    "security-reports",
    "dast-reports",
]


def move_file(src: Path, dst: Path, description: str):
    """Di chuyển file với error handling"""
    try:
        if src.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dst))
            print(f"✅ Moved: {description}")
            return True
        else:
            print(f"⚠️  Not found: {src.name}")
            return False
    except Exception as e:
        print(f"❌ Error moving {src.name}: {e}")
        return False


def move_directory(src: Path, dst: Path, description: str):
    """Di chuyển thư mục với error handling"""
    try:
        if src.exists() and src.is_dir():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(dst))
            print(f"✅ Moved directory: {description}")
            return True
        else:
            print(f"⚠️  Directory not found: {src.name}")
            return False
    except Exception as e:
        print(f"❌ Error moving directory {src.name}: {e}")
        return False


def main():
    """Hàm chính"""
    print("=== Automated Cleanup Script ===\n")
    
    moved_count = 0
    
    # Di chuyển báo cáo vào archive/reports/
    print("1. Moving report files to archive/reports/...")
    for filename in REPORT_FILES:
        src = ROOT / filename
        dst = ARCHIVE / "reports" / filename
        if move_file(src, dst, filename):
            moved_count += 1
    print()
    
    # Di chuyển SQL debug files vào src/database/debug/
    print("2. Moving SQL debug files to src/database/debug/...")
    debug_dir = ROOT / "src" / "database" / "debug"
    debug_dir.mkdir(parents=True, exist_ok=True)
    for filename in SQL_DEBUG_FILES:
        src = ROOT / filename
        dst = debug_dir / filename
        if move_file(src, dst, filename):
            moved_count += 1
    print()
    
    # Di chuyển docker-compose variants vào archive/docker/
    print("3. Moving docker-compose variants to archive/docker/...")
    for filename in DOCKER_FILES:
        src = ROOT / filename
        dst = ARCHIVE / "docker" / filename
        if move_file(src, dst, filename):
            moved_count += 1
    print()
    
    # Di chuyển framework scripts vào archive/scripts/
    print("4. Moving framework scripts to archive/scripts/...")
    for filename in FRAMEWORK_SCRIPTS:
        src = ROOT / filename
        dst = ARCHIVE / "scripts" / filename
        if move_file(src, dst, filename):
            moved_count += 1
    print()
    
    # Di chuyển thư mục đánh giá bảo mật
    print("5. Moving security assessment directories...")
    for dirname in ASSESSMENT_DIRS:
        src = ROOT / dirname
        dst = ARCHIVE / "security-assessments" / dirname
        if move_directory(src, dst, dirname):
            moved_count += 1
    print()
    
    # Di chuyển thư mục báo cáo bảo mật
    print("6. Moving security report directories...")
    for dirname in SECURITY_REPORT_DIRS:
        src = ROOT / dirname
        dst = ARCHIVE / "security-reports" / dirname
        if move_directory(src, dst, dirname):
            moved_count += 1
    print()
    
    print(f"=== Completed: {moved_count} items moved ===")


if __name__ == "__main__":
    main()
