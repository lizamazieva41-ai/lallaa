# verify-cleanup.ps1 - Script kiểm tra sau dọn dẹp (PowerShell)

$ErrorActionPreference = "Continue"

Write-Host "=== Kiểm tra sau Dọn dẹp ===" -ForegroundColor Cyan
Write-Host ""

# Build
Write-Host "1. Building project..." -ForegroundColor Yellow
try {
    npm run build
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Build successful" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Build failed!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ❌ Build failed with error: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Tests
Write-Host "2. Running tests..." -ForegroundColor Yellow
try {
    npm test
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Tests passed" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Tests failed!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ❌ Tests failed with error: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Lint
Write-Host "3. Running linter..." -ForegroundColor Yellow
try {
    npm run lint
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Linter passed" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Linter warnings (non-critical)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Linter check skipped" -ForegroundColor Yellow
}
Write-Host ""

# Size comparison
Write-Host "4. Size comparison:" -ForegroundColor Yellow
$size = (Get-ChildItem -Path . -Recurse -File | Where-Object {
    $relativePath = $_.FullName.Substring($PWD.Path.Length + 1)
    -not ($relativePath -like "node_modules\*" -or $relativePath -like ".git\*")
} | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "   Current size: $([math]::Round($size, 2)) MB" -ForegroundColor Gray
$size | Out-File -FilePath "current-size.txt" -Encoding UTF8

Write-Host ""
Write-Host "=== Kiểm tra hoàn thành ===" -ForegroundColor Cyan
