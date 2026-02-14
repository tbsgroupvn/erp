@echo off
REM ============================================
REM TBS ERP - Run All Tests
REM ============================================

echo.
echo ========================================
echo TBS ERP - Running Tests
echo ========================================
echo.

cd /d "%~dp0..\tbs-erp-backend"

echo [1/3] Running CreditCheckGuard tests...
call npm test -- credit-check.guard.spec.ts
if %errorlevel% neq 0 (
    echo ✗ CreditCheckGuard tests failed
    goto :test_failed
)
echo ✓ CreditCheckGuard tests passed
echo.

echo [2/3] Running CommissionCalculator tests...
call npm test -- commission-calculator.service.spec.ts
if %errorlevel% neq 0 (
    echo ✗ CommissionCalculator tests failed
    goto :test_failed
)
echo ✓ CommissionCalculator tests passed
echo.

echo [3/3] Running AccountsReceivable tests...
call npm test -- accounts-receivable.service.spec.ts
if %errorlevel% neq 0 (
    echo ✗ AccountsReceivable tests failed
    goto :test_failed
)
echo ✓ AccountsReceivable tests passed
echo.

echo ========================================
echo ✓ All tests passed!
echo ========================================
echo.
pause
exit /b 0

:test_failed
echo.
echo ========================================
echo ✗ Tests failed!
echo ========================================
echo.
echo Please review the error messages above.
echo.
pause
exit /b 1
