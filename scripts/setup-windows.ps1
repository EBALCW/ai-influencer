# AI Influencer - Windows kurulum script'i
# Kullanim (repo kokunde, PowerShell):
#   powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1
# Tekrar calistirmak guvenlidir; kurulu olanlari atlar.
#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  [OK] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [!] $m" -ForegroundColor Yellow }
function Has($c)  { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [Environment]::GetEnvironmentVariable('Path', 'User') + ';' + $env:Path
}
# Native komutlarin hata kodunu kontrol et (PS 5.1 bunu kendisi yapmaz)
function Run {
    $exe, $rest = $args
    & $exe @rest
    if ($LASTEXITCODE -ne 0) { throw "Komut basarisiz ($LASTEXITCODE): $($args -join ' ')" }
}
function Install-Tool($wingetId, $chocoId, $cmd) {
    if (Has $cmd) { Ok "$cmd mevcut"; return }
    if (Has 'winget') {
        winget install --id $wingetId -e --source winget --accept-source-agreements --accept-package-agreements --silent
    } elseif (Has 'choco') {
        choco install $chocoId -y --no-progress
    } else {
        throw "winget bulunamadi. Microsoft Store'dan 'App Installer' uygulamasini kurup tekrar dene."
    }
    Refresh-Path
    if (-not (Has $cmd)) { throw "$cmd kuruldu ama bulunamadi. Yeni bir PowerShell penceresi acip script'i tekrar calistir." }
    Ok "$cmd kuruldu"
}

Step 'PowerShell calistirma izni'
$policy = Get-ExecutionPolicy -Scope CurrentUser
if ($policy -in @('Undefined', 'Restricted', 'AllSigned')) {
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
    Ok 'CurrentUser icin RemoteSigned ayarlandi (pnpm ve profil script''leri icin gerekli)'
} else { Ok "mevcut: $policy" }

Step 'Temel araclar (git, gh, fnm)'
Install-Tool 'Git.Git'    'git'   'git'
Install-Tool 'GitHub.cli' 'gh'    'gh'
Install-Tool 'Schniz.fnm' 'fnm'   'fnm'

Step 'Git ayarlari'
Run git config --global core.longpaths true
Run git config --global core.autocrlf false
Ok 'core.longpaths=true, core.autocrlf=false (.gitattributes satir sonlarini yonetir)'

Step 'VS Code'
if ($env:CI) { Warn 'CI: VS Code atlandi' }
else { Install-Tool 'Microsoft.VisualStudioCode' 'vscode' 'code' }

$nodeVersion = (Get-Content .nvmrc -Raw).Trim()
Step "Node.js ($nodeVersion) - fnm ile"
$fnmLine = 'fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression'
if (-not (Test-Path $PROFILE)) { New-Item -ItemType File -Path $PROFILE -Force | Out-Null }
if (-not (Select-String -Path $PROFILE -SimpleMatch $fnmLine -Quiet)) {
    Add-Content -Path $PROFILE -Value "`n# fnm (Node surum yoneticisi)`n$fnmLine"
    Ok "fnm PowerShell profiline eklendi ($PROFILE)"
}
fnm env --shell powershell | Out-String | Invoke-Expression
Run fnm install --corepack-enabled
Run fnm use
Ok "node $(node -v)"

Step 'pnpm (corepack ile, surum package.json''dan)'
$env:COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
Run corepack enable
Run corepack install
Ok "pnpm $(pnpm -v)"

Step 'Bagimliliklar'
Run pnpm install
Ok 'pnpm install tamam'

Step '.env.local'
if (Test-Path .env.local) { Ok '.env.local zaten var' }
else { Copy-Item .env.example .env.local; Warn '.env.local olusturuldu - degerleri parola yoneticisinden doldur' }

Step 'VS Code eklentileri'
if (Has 'code') {
    $exts = (Get-Content .vscode\extensions.json -Raw | ConvertFrom-Json).recommendations
    foreach ($e in $exts) {
        code --install-extension $e --force *> $null
        if ($LASTEXITCODE -eq 0) { Ok $e } else { Warn "$e kurulamadi" }
    }
} else { Warn "'code' komutu yok, eklentiler atlandi" }

Step 'Saglik kontrolu'
Run node scripts\doctor.mjs

Write-Host "`nKurulum bitti. Yeni bir PowerShell penceresi ac ve: cd $(Get-Location); code ." -ForegroundColor Green
