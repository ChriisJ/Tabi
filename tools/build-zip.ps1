# Tabi – Paket für GitHub-Releases bzw. Edge-Add-ons/Chrome Web Store bauen.
# Erzeugt dist\tabi-<version>.zip mit NUR den Dateien der Erweiterung (ohne tests/, tools/, README …).
# Ein eventuell vorhandener "key" wird im Paket entfernt – die Stores vergeben ihre eigene ID
# und lehnen Manifeste mit "key" ab.
#
# Aufruf im Tabi-Ordner:  powershell -ExecutionPolicy Bypass -File tools\build-zip.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root 'manifest.json'
$manifestText = [IO.File]::ReadAllText($manifestPath)
$version = ($manifestText | ConvertFrom-Json).version
$include = @('manifest.json', 'background.js', '_locales', 'lib', 'popup', 'options', 'ui', 'icons')

$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null
$zipPath = Join-Path $dist "tabi-$version.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

# Manifest ohne "key"
$storeManifest = [regex]::Replace($manifestText, '\r?\n\s*"key"\s*:\s*"[^"]*",', '')
$null = $storeManifest | ConvertFrom-Json  # Gegenprobe: gültiges JSON

$zip = [IO.Compression.ZipFile]::Open($zipPath, [IO.Compression.ZipArchiveMode]::Create)
try {
  $count = 0
  foreach ($item in $include) {
    $full = Join-Path $root $item
    $files = if (Test-Path $full -PathType Container) { Get-ChildItem $full -Recurse -File } else { Get-Item $full }
    foreach ($f in $files) {
      # Einträge mit "/" (die Stores lehnen Backslashes in ZIP-Pfaden ab)
      $rel = $f.FullName.Substring($root.Length + 1).Replace('\', '/')
      $entry = $zip.CreateEntry($rel, [IO.Compression.CompressionLevel]::Optimal)
      $stream = $entry.Open()
      try {
        if ($rel -eq 'manifest.json') { $bytes = (New-Object Text.UTF8Encoding $false).GetBytes($storeManifest) }
        else { $bytes = [IO.File]::ReadAllBytes($f.FullName) }
        $stream.Write($bytes, 0, $bytes.Length)
      } finally { $stream.Dispose() }
      $count++
    }
  }
} finally {
  $zip.Dispose()
}

$size = [math]::Round((Get-Item $zipPath).Length / 1KB, 1)
Write-Host "Fertig: $zipPath  ($count Dateien, $size KB, Version $version)" -ForegroundColor Green
