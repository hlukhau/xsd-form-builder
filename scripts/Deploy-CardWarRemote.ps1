#Requires -Version 5.1
<#
  Сборка WAR (npm + build-manual.bat) и копирование на удалённый Tomcat (ssh/scp или plink/pscp).
  Git не нужен. Переменные среды: REMOTE_HOST, REMOTE_USER, REMOTE_WEBAPPS, REMOTE_PASSWORD
#>
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('DPA', 'PHA', 'PPV', 'DPR')]
  [string]$Card,
  [switch]$Build
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $ProjectRoot

$RemoteHost = if ($env:REMOTE_HOST) { $env:REMOTE_HOST } else { '192.168.203.130' }
$RemoteUser = if ($env:REMOTE_USER) { $env:REMOTE_USER } else { 'root' }
$RemoteWebapps = if ($env:REMOTE_WEBAPPS) { $env:REMOTE_WEBAPPS } else { '/opt/tomcat8/webapps' }
$RemotePassword = $env:REMOTE_PASSWORD
if (-not $RemotePassword) { $RemotePassword = 'Ssa101' }

$meta = @{
  DPA = @{ AppName = 'dpa_card'; Npm = 'build'; Url = 'dpa_card' }
  PHA = @{ AppName = 'pha_card'; Npm = 'build:pha'; Url = 'pha_card' }
  PPV = @{ AppName = 'ppv_card'; Npm = 'build:ppv'; Url = 'ppv_card' }
  DPR = @{ AppName = 'dpr_card'; Npm = 'build:dpr'; Url = 'dpr_card' }
}

$cleanupByCard = @{
  DPA = "cd $RemoteWebapps && rm -rf xsd_form_builder xsd-form-builder && rm -f xsd_form_builder.war xsd-form-builder.war"
  PHA = "cd $RemoteWebapps && rm -rf xsd_form_builder_57 && rm -f xsd_form_builder_57.war"
  PPV = "cd $RemoteWebapps && rm -rf ppv_card && rm -f ppv_card.war"
  DPR = "cd $RemoteWebapps && rm -rf dpr_card && rm -f dpr_card.war"
}

$m = $meta[$Card]
$cleanup = $cleanupByCard[$Card]
$warPath = Join-Path $ProjectRoot "target\$($m.AppName).war"

function Find-InPath([string]$Name) {
  foreach ($d in ($env:Path -split ';')) {
    $p = Join-Path $d.Trim() $Name
    if (Test-Path -LiteralPath $p) { return $p }
  }
  return $null
}

function Invoke-RemoteCommand([string]$RemoteCmd) {
  $target = "$RemoteUser@$RemoteHost"
  $plink = $env:PLINK_PATH
  if (-not $plink) { $plink = Find-InPath 'plink.exe' }
  if ($plink -and (Test-Path -LiteralPath $plink) -and $RemotePassword) {
    Write-Host "[ssh] plink $target ..."
    & $plink -batch -ssh $target -pw $RemotePassword $RemoteCmd
    return
  }
  Write-Host "[ssh] ssh $target ..."
  ssh -o StrictHostKeyChecking=accept-new $target $RemoteCmd
}

function Copy-WarToRemote([string]$LocalWar, [string]$RemoteDirUnix) {
  $dest = ('{0}@{1}:{2}/' -f $RemoteUser, $RemoteHost, $RemoteDirUnix)
  $pscp = $env:PSCP_PATH
  if (-not $pscp) { $pscp = Find-InPath 'pscp.exe' }
  if ($pscp -and (Test-Path -LiteralPath $pscp) -and $RemotePassword) {
    Write-Host "[scp] pscp -> $dest"
    & $pscp -batch -pw $RemotePassword $LocalWar $dest
    return
  }
  Write-Host "[scp] scp -> $dest"
  scp -o StrictHostKeyChecking=accept-new $LocalWar $dest
}

if ($Build) {
  Write-Host "[1/2] Building $Card..."
  $bc = Join-Path $ProjectRoot 'scripts\build-card-war.cmd'
  $cmdLine = "`"$bc`" $($m.AppName) $($m.Npm) 1"
  $p = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', $cmdLine) -WorkingDirectory $ProjectRoot -Wait -PassThru -NoNewWindow
  if ($p.ExitCode -ne 0) { exit $p.ExitCode }
  Write-Host ''
}

if (-not (Test-Path -LiteralPath $warPath)) {
  Write-Error "WAR not found: $warPath - use -Build or build the WAR manually."
  exit 1
}

Write-Host "========================================"
Write-Host " Deploy $Card WAR to remote server"
Write-Host "========================================"
Write-Host ("Target: " + $RemoteUser + "@" + $RemoteHost + ":" + $RemoteWebapps + "/")
Write-Host "WAR:    $warPath"
Write-Host ""

Write-Host "[cleanup] Removing old exploded dirs / WAR on server..."
try { Invoke-RemoteCommand $cleanup } catch { Write-Warning "cleanup: $_" }
Write-Host ""

Copy-WarToRemote -LocalWar $warPath -RemoteDirUnix $RemoteWebapps
Write-Host ""
Write-Host "[OK] WAR copied. Tomcat will redeploy."
Write-Host ("     http://" + $RemoteHost + ":8080/" + $m.Url + "/")
Write-Host ""
