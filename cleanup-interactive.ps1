# cleanup-interactive.ps1 - Script dọn dẹp bán tự động (PowerShell)

Write-Host "=== Dọn dẹp Bán tự động ===" -ForegroundColor Cyan
Write-Host ""

# Báo cáo phân tích
Write-Host "1. Di chuyển báo cáo phân tích vào archive?" -ForegroundColor Yellow
$moveReports = Read-Host "   (y/n)"
if ($moveReports -eq "y") {
    $reportFiles = @(
        "ANALYSIS_*.md", "FINAL_*.md", "IMPLEMENTATION_*.md", "PRODUCTION_*.md",
        "DATA_QUALITY_REPORT.md", "PERFORMANCE_ANALYSIS.md", "SECURITY_ASSESSMENT.md",
        "TECHNICAL_ANALYSIS.md", "VALIDATION_REPORT.md", "REVIEW_CHECKLIST.md",
        "TEAM_SHARING_GUIDE.md", "QUICK_START_GUIDE.md", "GITHUB_ACTIONS_SETUP.md",
        "AUTOMATION_GUIDE.md", "IMPROVEMENTS_APPLIED.md", "ITERATION_GUIDE.md",
        "HOW_TO_RUN_ANALYSIS.md", "ANALYSIS_SYSTEM_*.md", "COMPLETE_ACTION_PLAN.md",
        "PLAN.md", "RECOMMENDATIONS_ROADMAP.md", "ke_hoach_cai_thien_payment_api.md",
        "DEPLOYMENT_TICKETS.md", "FINAL_DEPLOYMENT_TICKETS.md", "PRODUCTION_DEPLOYMENT_TICKETS.md"
    )
    
    $moved = 0
    foreach ($pattern in $reportFiles) {
        $files = Get-ChildItem -Path . -Filter $pattern -File -ErrorAction SilentlyContinue
        foreach ($file in $files) {
            Move-Item -Path $file.FullName -Destination "archive\reports\" -Force -ErrorAction SilentlyContinue
            $moved++
        }
    }
    Write-Host "   ✓ Moved $moved report files to archive/reports/" -ForegroundColor Green
}
Write-Host ""

# SQL debug files
Write-Host "2. Xử lý file SQL debug ở gốc?" -ForegroundColor Yellow
Write-Host "   Options: move, delete, skip"
$handleSql = Read-Host "   Your choice"
if ($handleSql -eq "move") {
    New-Item -ItemType Directory -Path "src\database\debug" -Force | Out-Null
    $sqlFiles = Get-ChildItem -Path . -Filter "debug-*.sql" -File
    $sqlFiles += Get-ChildItem -Path . -Filter "test-rls-*.sql" -File
    foreach ($file in $sqlFiles) {
        Move-Item -Path $file.FullName -Destination "src\database\debug\" -Force -ErrorAction SilentlyContinue
    }
    Write-Host "   ✓ Moved $($sqlFiles.Count) SQL debug files to src/database/debug/" -ForegroundColor Green
} elseif ($handleSql -eq "delete") {
    $sqlFiles = Get-ChildItem -Path . -Filter "debug-*.sql" -File
    $sqlFiles += Get-ChildItem -Path . -Filter "test-rls-*.sql" -File
    $sqlFiles | Remove-Item -Force
    Write-Host "   ✓ Deleted $($sqlFiles.Count) SQL debug files" -ForegroundColor Green
}
Write-Host ""

# Docker compose
Write-Host "3. Xử lý docker-compose variants?" -ForegroundColor Yellow
Write-Host "   Options: archive, delete, skip"
$handleDocker = Read-Host "   Your choice"
if ($handleDocker -eq "archive") {
    $dockerFiles = Get-ChildItem -Path . -Filter "docker-compose.vault-*.yml" -File
    $dockerFiles += Get-ChildItem -Path . -Filter "docker-compose.monitoring-simple.yml" -File -ErrorAction SilentlyContinue
    $dockerFiles += Get-ChildItem -Path . -Filter "docker-compose.security.yml" -File -ErrorAction SilentlyContinue
    foreach ($file in $dockerFiles) {
        Move-Item -Path $file.FullName -Destination "archive\docker\" -Force -ErrorAction SilentlyContinue
    }
    Write-Host "   ✓ Archived $($dockerFiles.Count) docker-compose files" -ForegroundColor Green
} elseif ($handleDocker -eq "delete") {
    $dockerFiles = Get-ChildItem -Path . -Filter "docker-compose.vault-*.yml" -File
    $dockerFiles += Get-ChildItem -Path . -Filter "docker-compose.monitoring-simple.yml" -File -ErrorAction SilentlyContinue
    $dockerFiles += Get-ChildItem -Path . -Filter "docker-compose.security.yml" -File -ErrorAction SilentlyContinue
    $dockerFiles | Remove-Item -Force
    Write-Host "   ✓ Deleted $($dockerFiles.Count) docker-compose files" -ForegroundColor Green
}
Write-Host ""

# Scripts framework
Write-Host "4. Xử lý script framework ở gốc?" -ForegroundColor Yellow
Write-Host "   Options: move, archive, delete, skip"
$handleScripts = Read-Host "   Your choice"
if ($handleScripts -eq "move") {
    New-Item -ItemType Directory -Path "scripts\frameworks" -Force | Out-Null
    $scriptFiles = Get-ChildItem -Path . -Filter "*-framework.sh" -File
    $scriptFiles += Get-ChildItem -Path . -Filter "deploy-*.sh" -File
    $scriptFiles += Get-ChildItem -Path . -Filter "security-testing*.sh" -File
    $scriptFiles += Get-ChildItem -Path . -Filter "migrate-to-vault.sh" -File -ErrorAction SilentlyContinue
    $scriptFiles += Get-ChildItem -Path . -Filter "verify-vault-secrets.sh" -File -ErrorAction SilentlyContinue
    foreach ($file in $scriptFiles) {
        Move-Item -Path $file.FullName -Destination "scripts\frameworks\" -Force -ErrorAction SilentlyContinue
    }
    Write-Host "   ✓ Moved $($scriptFiles.Count) framework scripts to scripts/frameworks/" -ForegroundColor Green
} elseif ($handleScripts -eq "archive") {
    $scriptFiles = Get-ChildItem -Path . -Filter "*-framework.sh" -File
    $scriptFiles += Get-ChildItem -Path . -Filter "deploy-*.sh" -File
    $scriptFiles += Get-ChildItem -Path . -Filter "security-testing*.sh" -File
    $scriptFiles += Get-ChildItem -Path . -Filter "migrate-to-vault.sh" -File -ErrorAction SilentlyContinue
    $scriptFiles += Get-ChildItem -Path . -Filter "verify-vault-secrets.sh" -File -ErrorAction SilentlyContinue
    foreach ($file in $scriptFiles) {
        Move-Item -Path $file.FullName -Destination "archive\scripts\" -Force -ErrorAction SilentlyContinue
    }
    Write-Host "   ✓ Archived $($scriptFiles.Count) framework scripts" -ForegroundColor Green
}
Write-Host ""

# Security assessments
Write-Host "5. Xử lý thư mục đánh giá bảo mật?" -ForegroundColor Yellow
Write-Host "   Options: archive, delete, skip"
$handleSecurity = Read-Host "   Your choice"
if ($handleSecurity -eq "archive") {
    $securityDirs = @("compliance-assessment", "remediation-plans", "threat-modeling", "security-controls", "pentest-tools")
    foreach ($dir in $securityDirs) {
        if (Test-Path $dir) {
            Move-Item -Path $dir -Destination "archive\security-assessments\" -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "   ✓ Archived security assessment directories" -ForegroundColor Green
}
Write-Host ""

# Security reports
Write-Host "6. Xử lý báo cáo bảo mật?" -ForegroundColor Yellow
Write-Host "   Options: archive, delete, skip"
$handleSecurityReports = Read-Host "   Your choice"
if ($handleSecurityReports -eq "archive") {
    if (Test-Path "sast-reports") {
        Move-Item -Path "sast-reports" -Destination "archive\security-reports\" -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path "security-reports") {
        Move-Item -Path "security-reports" -Destination "archive\security-reports\" -Force -ErrorAction SilentlyContinue
    }
    Write-Host "   ✓ Archived security reports" -ForegroundColor Green
}
Write-Host ""

# Analysis reports
Write-Host "7. Xóa báo cáo phân tích generated?" -ForegroundColor Yellow
$deleteAnalysis = Read-Host "   (y/n)"
if ($deleteAnalysis -eq "y") {
    if (Test-Path "reports\analysis") {
        Remove-Item -Path "reports\analysis" -Recurse -Force
        Write-Host "   ✓ Removed reports/analysis/" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=== Hoàn thành ===" -ForegroundColor Cyan
