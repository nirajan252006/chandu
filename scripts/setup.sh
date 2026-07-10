#!/bin/bash
# ============================================
# Vehicle Data Retriever Pro - Linux Setup
# ============================================

echo ""
echo "========================================="
echo "  Vehicle Data Retriever Pro - Setup     "
echo "========================================="
echo ""

# Check Node.js
echo "[1/5] Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "  ERROR: Node.js is not installed!"
    echo "  Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi
echo "  Node.js $(node --version) found"

# Install root dependencies
echo "[2/5] Installing root dependencies..."
npm install || { echo "  ERROR: Failed!"; exit 1; }
echo "  Done"

# Install backend dependencies
echo "[3/5] Installing backend dependencies..."
cd backend
npm install || { echo "  ERROR: Failed!"; exit 1; }
npx playwright install chromium || echo "  WARNING: Playwright install may have issues"
cd ..
echo "  Done"

# Install frontend dependencies
echo "[4/5] Installing frontend dependencies..."
cd frontend
npm install || { echo "  ERROR: Failed!"; exit 1; }
cd ..
echo "  Done"

# Create data directories
echo "[5/5] Creating data directories..."
mkdir -p data/uploads data/exports data/logs data/database playwright/user-data
echo "  Done"

echo ""
echo "========================================="
echo "  Setup Complete!                        "
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Edit config/.env with your Chrome profile path"
echo "  2. Close Google Chrome"
echo "  3. Run: npm run dev"
echo "  4. Open: http://localhost:5173"
echo ""
