#Requires -Version 5.1
<#
  Копирование WAR eec-rights-service на удалённый Tomcat (как deploy-rights-service-to-remote.sh).
  Переменные: REMOTE_HOST, REMOTE_USER, REMOTE_PASSWORD, REMOTE_TOMCAT_HOME (по умолчанию /opt/tomcat8)
  -Build: только на Linux/macOS/WSL — на чистом Windows выведите подсказку (сборка через ./build-rights-service.sh).
#>
param([switch]$Build)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $ProjectRoot

$RemoteHost = if ($env:REMOTE_HOST) { $env:REMOTE_HOST } else { '192.168.203.130' }
$RemoteUser = if ($env:REMOTE_USER) { $env:REMOTE_USER } else { 'root' }
$RemoteTomcat = if ($env:REMOTE_TOMCAT_HOME) { $env:REMOTE_TOMCAT_HOME } else { '/opt/tomcat8' }
$RemotePassword = $env:REMOTE_PASSWORD
if (-not $RemotePassword) { $RemotePassword = 'Ssa101' }
$RemoteWebapps = "$RemoteTomcat/webapps"
$warPath = Join-Path $ProjectRoot 'rights-service\target\card_rigths.war'

function Find-InPath([string]$Name) {
  foreach ($d in ($env:Path -split ';')) {
    $p = Join-Path $d.Trim() $Name
    if (Test-Path -LiteralPath $p) { return $p }
  }
  return $null
}

function Invoke-RemoteCommand([string]$RemoteCmd) {
  $target = "$RemoteUser@$RemoteHost"
  $plink = $env:PLINK_PATH; if (-not $plink) { $plink = Find-InPath 'plink.exe' }
  if ($plink -and (Test-Path -LiteralPath $plink) -and $RemotePassword) {
    & $plink -batch -ssh $target -pw $RemotePassword $RemoteCmd
    return
  }
  ssh -o StrictHostKeyChecking=accept-new $target $RemoteCmd
}

function Copy-WarToRemote([string]$LocalWar, [string]$RemoteDest) {
  $target = ('{0}@{1}:{2}' -f $RemoteUser, $RemoteHost, $RemoteDest)
  $pscp = $env:PSCP_PATH; if (-not $pscp) { $pscp = Find-InPath 'pscp.exe' }
  if ($pscp -and (Test-Path -LiteralPath $pscp) -and $RemotePassword) {
    & $pscp -batch -pw $RemotePassword $LocalWar $target
    return
  }
  scp -o StrictHostKeyChecking=accept-new $LocalWar $target
}

if ($Build) {
  Write-Error 'Сборка eec-rights-service на Windows из этого скрипта не поддерживается. Выполните ./build-rights-service.sh на Linux/WSL или Maven в rights-service, затем таск без --build (только scp).'
  exit 1
}

if (-not (Test-Path -LiteralPath $warPath)) {
  Write-Error "WAR not found: $warPath"
  exit 1
}

Write-Host '========================================'
Write-Host ' Deploy eec-rights-service WAR (remote)'
Write-Host '========================================'
Write-Host ('Target: {0}@{1}:{2}/card_rigths.war' -f $RemoteUser, $RemoteHost, $RemoteWebapps)
Write-Host ''

Invoke-RemoteCommand "mkdir -p `"$RemoteWebapps`""
Invoke-RemoteCommand "rm -rf '$RemoteWebapps/card_rigths' && rm -f '$RemoteWebapps/card_rigths.war' || true"
Copy-WarToRemote -LocalWar $warPath -RemoteDest "$RemoteWebapps/card_rigths.war"
Write-Host ''
Write-Host "[OK] $RemoteWebapps/card_rigths.war"
Write-Host ''
