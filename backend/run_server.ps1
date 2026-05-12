$ErrorActionPreference = "Continue"
$exePath = "e:\Learn\chanlun\backend\target\debug\chanlun-server.exe"
$env:RUST_LOG = "info"

Write-Host "Starting ChanLun Server..."
Write-Host "========================================"

try {
    $process = Start-Process -FilePath $exePath -PassThru -NoNewWindow
    Start-Sleep -Seconds 5

    if ($process.HasExited) {
        Write-Host "[ERROR] Process exited with code: $($process.ExitCode)" -ForegroundColor Red
        exit $process.ExitCode
    } else {
        Write-Host "[SUCCESS] Server is running with PID: $($process.Id)" -ForegroundColor Green

        Write-Host "`nPress Ctrl+C to stop the server..."

        $process.WaitForExit()
    }
} catch {
    Write-Host "[ERROR] Failed to start server: $_" -ForegroundColor Red
    exit 1
}
