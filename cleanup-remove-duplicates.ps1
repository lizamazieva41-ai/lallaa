# cleanup-remove-duplicates.ps1
# Script để xóa các file trùng đã có trong archive

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

Write-Host "=== Xóa File Trùng ===" -ForegroundColor Yellow
Write-Host ""

$filesToRemove = @(
    "ANALYSIS_EXECUTION_REPORT.md",
    "CI_CD_INTEGRATION.md",
    "README_DEPLOY_LINUX_PM2.md"
)

$removedCount = 0
$skippedCount = 0

foreach ($file in $filesToRemove) {
    if (Test-Path $file) {
        $archivePath = "archive/reports/$file"
        if (Test-Path $archivePath) {
            Write-Host "Xóa $file (đã có trong archive)..." -ForegroundColor Yellow
            try {
                Remove-Item -Path $file -Force -ErrorAction Stop
                Write-Host "  ✅ Đã xóa $file" -ForegroundColor Green
                $removedCount++
            } catch {
                Write-Host "  ⚠️  Không thể xóa $file: $_" -ForegroundColor Red
                $skippedCount++
            }
        } else {
            Write-Host "  ⚠️  File $file không có trong archive, bỏ qua" -ForegroundColor Yellow
            $skippedCount++
        }
    } else {
        Write-Host "  ℹ️  File $file không tồn tại, bỏ qua" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=== Kết quả ===" -ForegroundColor Cyan
Write-Host "Đã xóa: $removedCount file(s)" -ForegroundColor Green
Write-Host "Bỏ qua: $skippedCount file(s)" -ForegroundColor Yellow
Write-Host ""

if ($removedCount -gt 0) {
    Write-Host "✅ Hoàn thành!" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Không có file nào được xóa" -ForegroundColor Gray
}
