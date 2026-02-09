# Test API Flow Script
Write-Host "=== Step 1: Register User ===" -ForegroundColor Cyan
$body = @{
    email     = "test@example.com"
    password  = "Password123!"
    firstName = "Test"
    lastName  = "User"
} | ConvertTo-Json

Write-Host "Register body: $body" -ForegroundColor Gray
$registerResponse = curl.exe -s http://localhost:8080/api/v1/auth/register `
    -H "Content-Type: application/json" `
    -d $body

Write-Host "Register response: $registerResponse" -ForegroundColor Yellow

$registerJson = $registerResponse | ConvertFrom-Json
if ($registerJson.success -eq $true) {
    Write-Host "✓ Register successful" -ForegroundColor Green
    
    Write-Host "`n=== Step 2: Login ===" -ForegroundColor Cyan
    $loginBody = @{
        email    = "test@example.com"
        password = "Password123!"
    } | ConvertTo-Json
    
    Write-Host "Login body: $loginBody" -ForegroundColor Gray
    $loginResponse = curl.exe -s http://localhost:8080/api/v1/auth/login `
        -H "Content-Type: application/json" `
        -d $loginBody
    
    Write-Host "Login response: $loginResponse" -ForegroundColor Yellow
    
    $loginJson = $loginResponse | ConvertFrom-Json
    if ($loginJson.success -eq $true -and $loginJson.data.tokens.accessToken) {
        $token = $loginJson.data.tokens.accessToken
        Write-Host "✓ Login successful, token obtained" -ForegroundColor Green
        
        Write-Host "`n=== Step 3: GET /auth/me ===" -ForegroundColor Cyan
        curl.exe -i http://localhost:8080/api/v1/auth/me -H "Authorization: Bearer $token"
        
        Write-Host "`n=== Step 4: GET /bin/lookup ===" -ForegroundColor Cyan
        curl.exe -i "http://localhost:8080/api/v1/bin/lookup?bin=411111" -H "Authorization: Bearer $token"
        
        Write-Host "`n=== Step 5: POST /iban/validate (valid IBAN) ===" -ForegroundColor Cyan
        curl.exe -i http://localhost:8080/api/v1/iban/validate `
            -H "Authorization: Bearer $token" `
            -H "Content-Type: application/json" `
            -d '{"iban":"DE89370400440532013000"}'
        
        Write-Host "`n=== Step 6: POST /cards/generate ===" -ForegroundColor Cyan
        curl.exe -i http://localhost:8080/api/v1/cards/generate `
            -H "Authorization: Bearer $token" `
            -H "Content-Type: application/json" `
            -d '{"vendor":"visa","count":2}'
        
        Write-Host "`n=== Step 7: GET /admin/system/health ===" -ForegroundColor Cyan
        curl.exe -i http://localhost:8080/api/v1/admin/system/health -H "Authorization: Bearer $token"
        
        Write-Host "`n=== All requests completed ===" -ForegroundColor Green
    } else {
        Write-Host "✗ Login failed" -ForegroundColor Red
        Write-Host "Response: $loginResponse" -ForegroundColor Red
    }
} else {
    Write-Host "✗ Register failed" -ForegroundColor Red
    Write-Host "Response: $registerResponse" -ForegroundColor Red
}
