# cleanup-project.ps1 - Script dọn dẹp dự án (PowerShell)

$ErrorActionPreference = "Stop"

Write-Host "=== Kế hoạch Dọn dẹp Dự án BIN Check API ===" -ForegroundColor Cyan
Write-Host ""

# Bước 1: Backup
Write-Host "Bước 1: Tạo sao lưu..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path (Split-Path -Parent $PWD) "bin-check-api-backup-$timestamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

# Sao chép file (trừ node_modules, .git, coverage)
$excludeDirs = @('node_modules', '.git', 'coverage')
Get-ChildItem -Path . -Recurse -File | Where-Object {
    $relativePath = $_.FullName.Substring($PWD.Path.Length + 1)
    $exclude = $false
    foreach ($excludeDir in $excludeDirs) {
        if ($relativePath -like "$excludeDir\*" -or $relativePath -like "*\$excludeDir\*") {
            $exclude = $true
            break
        }
    }
    -not $exclude
} | ForEach-Object {
    $destPath = $_.FullName.Replace($PWD.Path, $backupDir)
    $destDir = Split-Path -Parent $destPath
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    Copy-Item $_.FullName -Destination $destPath -Force
}

# Tạo manifest
$manifestPath = Join-Path $backupDir "backup-manifest.txt"
Get-ChildItem -Path . -Recurse -File | Where-Object {
    $relativePath = $_.FullName.Substring($PWD.Path.Length + 1)
    -not ($relativePath -like "node_modules\*" -or $relativePath -like ".git\*")
} | Select-Object -ExpandProperty FullName | Out-File -FilePath $manifestPath -Encoding UTF8

# Tính kích thước
$size = (Get-ChildItem -Path $backupDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "✅ Backup created at: $backupDir" -ForegroundColor Green
Write-Host "   Size: $([math]::Round($size, 2)) MB" -ForegroundColor Gray
Write-Host ""

# Bước 2: Dọn dẹp tự động
Write-Host "Bước 2: Dọn dẹp tự động..." -ForegroundColor Yellow

# Xóa coverage
if (Test-Path "coverage") {
    Remove-Item -Path "coverage" -Recurse -Force
    Write-Host "   ✓ Removed coverage/" -ForegroundColor Gray
}

# Xóa logs
if (Test-Path "logs") {
    Get-ChildItem -Path "logs" -Filter "*.log" -File | Remove-Item -Force
    Write-Host "   ✓ Cleaned logs/*.log" -ForegroundColor Gray
}

# Xóa file tạm thời
$tempFiles = Get-ChildItem -Path . -Recurse -File -Include "*.tmp", "*.temp" | Where-Object {
    $relativePath = $_.FullName.Substring($PWD.Path.Length + 1)
    -not ($relativePath -like "node_modules\*" -or $relativePath -like ".git\*")
}
if ($tempFiles) {
    $tempFiles | Remove-Item -Force
    Write-Host "   ✓ Removed $($tempFiles.Count) temp files" -ForegroundColor Gray
}

# Xóa file backup
$backupFiles = Get-ChildItem -Path . -Recurse -File -Include "*.bak", "*.backup" | Where-Object {
    $relativePath = $_.FullName.Substring($PWD.Path.Length + 1)
    -not ($relativePath -like "node_modules\*" -or $relativePath -like ".git\*")
}
if ($backupFiles) {
    $backupFiles | Remove-Item -Force
    Write-Host "   ✓ Removed $($backupFiles.Count) backup files" -ForegroundColor Gray
}

# Xóa dast-reports
if (Test-Path "dast-reports") {
    Remove-Item -Path "dast-reports" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   ✓ Removed dast-reports/" -ForegroundColor Gray
}

Write-Host "✅ Automatic cleanup completed" -ForegroundColor Green
Write-Host ""

# Bước 4: Tạo thư mục archive
Write-Host "Bước 4: Tạo cấu trúc archive..." -ForegroundColor Yellow
$archiveDirs = @("archive\reports", "archive\docker", "archive\scripts", "archive\security-assessments", "archive\security-reports")
foreach ($dir in $archiveDirs) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}
Write-Host "✅ Archive structure created" -ForegroundColor Green
Write-Host ""

Write-Host "=== Hoàn thành Bước 1, 2, 4 ===" -ForegroundColor Cyan
Write-Host "Lưu ý: Chạy cleanup-interactive.ps1 để xử lý các file cần xác nhận" -ForegroundColor Yellow
