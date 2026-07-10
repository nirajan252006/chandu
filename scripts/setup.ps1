# ============================================
# Vehicle Data Retriever Pro - Windows Setup
# ============================================

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Vehicle Data Retriever Pro - Setup     " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "[1/5] Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Node.js is not installed!" -ForegroundColor Red
    Write-Host "  Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "  Node.js $nodeVersion found" -ForegroundColor Green

# Install root dependencies
Write-Host "[2/5] Installing root dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: Failed!" -ForegroundColor Red; exit 1 }
Write-Host "  Done" -ForegroundColor Green

# Install backend dependencies
Write-Host "[3/5] Installing backend dependencies..." -ForegroundColor Yellow
Set-Location -Path backend
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: Failed!" -ForegroundColor Red; exit 1 }
Write-Host "  Done" -ForegroundColor Green

# Install Playwright browsers
Write-Host "[4/5] Installing Playwright Chromium..." -ForegroundColor Yellow
npx playwright install chromium
if ($LASTEXITCODE -ne 0) { Write-Host "  WARNING: Playwright install may have issues" -ForegroundColor Yellow }
Write-Host "  Done" -ForegroundColor Green
Set-Location -Path ..

# Install frontend dependencies
Write-Host "[5/5] Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location -Path frontend
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "  ERROR: Failed!" -ForegroundColor Red; exit 1 }
Write-Host "  Done" -ForegroundColor Green
Set-Location -Path ..

# Create data directories
Write-Host ""
Write-Host "Creating data directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "data/uploads" | Out-Null
New-Item -ItemType Directory -Force -Path "data/exports" | Out-Null
New-Item -ItemType Directory -Force -Path "data/logs" | Out-Null
New-Item -ItemType Directory -Force -Path "data/database" | Out-Null
New-Item -ItemType Directory -Force -Path "playwright/user-data" | Out-Null
Write-Host "  Done" -ForegroundColor Green

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  Setup Complete!                        " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Edit config/.env with your Chrome profile path" -ForegroundColor White
Write-Host "  2. Close Google Chrome" -ForegroundColor White
Write-Host "  3. Run: npm run dev" -ForegroundColor White
Write-Host "  4. Open: http://localhost:5173" -ForegroundColor White
Write-Host ""
