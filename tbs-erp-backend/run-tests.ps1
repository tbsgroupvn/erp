Write-Host "Bắt đầu khởi động Backend bằng lệnh node dist/src/main.js..."
$serverJob = Start-Job -ScriptBlock {
    Set-Location "d:\ERPv1\tbs-erp-backend"
    node dist/src/main.js
}

Write-Host "Chờ 12s để Backend kịp boot..."
Start-Sleep -Seconds 12

Write-Host "Tiến hành bắn kịch bản test-api.ts..."
npx ts-node test-api.ts

Write-Host "Dập tắt Backend sau khi Test..."
Stop-Job -Id $serverJob.Id
Remove-Job -Id $serverJob.Id
Write-Host "Hoàn tất kịch bản Test!"
