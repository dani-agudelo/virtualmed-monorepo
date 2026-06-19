# Copia NEXT_PUBLIC_* del .env raíz a VirtualMed_Frontend\.env.local (dev sin Docker)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$EnvFile = Join-Path $Root ".env"
$Out = Join-Path $Root "VirtualMed_Frontend\.env.local"

if (-not (Test-Path $EnvFile)) {
    Write-Error "No existe $EnvFile — copia .env.example a .env primero."
}

$lines = @("# Generado por scripts/sync-frontend-env.ps1")
$lines += Get-Content $EnvFile | Where-Object { $_ -match '^NEXT_PUBLIC_' }
$lines | Set-Content -Encoding utf8 $Out
Write-Host "Escrito: $Out"
