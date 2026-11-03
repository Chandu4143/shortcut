# Creates the GitHub release for an APK build and attaches everything in
# mobile/dist. Safe to re-run: existing releases and assets are skipped.
#
#   ./scripts/release/publish-release.ps1 -Tag v1.0.0
#
# Auth comes from GITHUB_TOKEN, or from the credential helper Git already uses
# for github.com.

param(
  [string]$Tag = 'v1.0.0',
  [string]$Repo = 'Chandu4143/shortcut',
  [string]$Dist = (Join-Path $PSScriptRoot '../../mobile/dist')
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if ($env:GITHUB_TOKEN) {
  $token = $env:GITHUB_TOKEN
} else {
  $cred = "protocol=https`nhost=github.com`n`n" | git credential fill
  $token = (($cred -split "`n") | Where-Object { $_ -match '^password=' }) -replace '^password=', ''
}

if (-not $token) { throw 'No GitHub token. Set GITHUB_TOKEN or sign in with Git Credential Manager.' }

$api = "https://api.github.com/repos/$Repo"
$headers = @(
  '-H', "Authorization: Bearer $token",
  '-H', 'Accept: application/vnd.github+json',
  '-H', 'User-Agent: shortcut-release'
)

$releaseJson = & curl.exe -sS @headers "$api/releases/tags/$Tag"
$release = $releaseJson | ConvertFrom-Json

if (-not ($release.PSObject.Properties.Name -contains 'id')) {
  $notesFile = Join-Path $PSScriptRoot "notes-$Tag.md"
  if (-not (Test-Path $notesFile)) { throw "Missing release notes: $notesFile" }

  Add-Type -AssemblyName System.Web.Extensions
  $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
  $serializer.MaxJsonLength = [int]::MaxValue
  $payload = $serializer.Serialize(@{
    tag_name         = $Tag
    target_commitish = 'main'
    name             = "Short Cut $($Tag.TrimStart('v'))"
    body             = [System.IO.File]::ReadAllText($notesFile)
    draft            = $false
    prerelease       = $false
  })

  $payloadFile = Join-Path $env:TEMP "shortcut-release-$Tag.json"
  [IO.File]::WriteAllText($payloadFile, $payload, (New-Object System.Text.UTF8Encoding($false)))

  Write-Host "Creating release $Tag"
  $release = (& curl.exe -sS -X POST @headers -H 'Content-Type: application/json' --data-binary "@$payloadFile" "$api/releases") | ConvertFrom-Json
  if (-not ($release.PSObject.Properties.Name -contains 'id')) { throw "Release creation failed for $Tag" }
}

$uploadBase = ($release.upload_url -replace '\{.*$', '')
$existing = @()
if ($release.assets) { $existing = $release.assets | ForEach-Object { $_.name } }

foreach ($apk in (Get-ChildItem -Path $Dist -Filter '*.apk' | Sort-Object Name)) {
  if ($existing -contains $apk.Name) {
    Write-Host "skip   $($apk.Name)"
    continue
  }

  Write-Host ("upload {0} ({1} MB)" -f $apk.Name, [math]::Round($apk.Length / 1MB, 1))
  $uri = $uploadBase + '?name=' + [uri]::EscapeDataString($apk.Name)
  $raw = & curl.exe -sS --fail-with-body --retry 3 --retry-delay 3 `
    -X POST @headers `
    -H 'Content-Type: application/vnd.android.package-archive' `
    --data-binary "@$($apk.FullName)" $uri

  if ($LASTEXITCODE -ne 0) { throw "Upload failed for $($apk.Name)" }
  Write-Host "  -> $((($raw | ConvertFrom-Json).browser_download_url))"
}

Write-Host "Release: $($release.html_url)"
