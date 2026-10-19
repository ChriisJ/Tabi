# Tabi – Store-Grafiken erzeugen (Logo, Promo-Kacheln, Screenshots) mit Edge im Headless-Modus.
#
# Rendert die HTML-Vorlagen aus store\src pixelgenau nach store\assets. Die Screenshots zeigen die
# echte Oberfläche, die gegen die simulierte chrome-API aus tests\ läuft.
#
# Aufruf im Tabi-Ordner:  powershell -ExecutionPolicy Bypass -File tools\store-assets.ps1 [-Port 8767]
param([int]$Port = 8767)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
  Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'msedge.exe nicht gefunden.' }

$out = Join-Path $root 'store\assets'
New-Item -ItemType Directory -Force $out | Out-Null
$profileDir = Join-Path ([IO.Path]::GetTempPath()) "tabi-store-assets-$PID"

# Testserver im Hintergrund starten
$server = Start-Process powershell -PassThru -WindowStyle Hidden -ArgumentList @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $root 'tests\serve.ps1'), '-Port', $Port)
Start-Sleep -Seconds 2
$base = "http://localhost:$Port"

Add-Type -AssemblyName System.Drawing

# Headless-Edge hat eine Mindest-Fensterbreite (~500 px). Kleine Grafiken werden deshalb in einem
# größeren Fenster oben links gerendert und anschließend exakt auf w × h zugeschnitten.
function Shot([string]$path, [int]$w, [int]$h, [string]$file, [int]$budget = 12000, [switch]$Transparent) {
  $target = Join-Path $out $file
  $raw = Join-Path ([IO.Path]::GetTempPath()) "tabi-raw-$PID-$file"
  foreach ($f in $target, $raw) { if (Test-Path $f) { Remove-Item $f -Force } }
  $rw = [Math]::Max($w, 800); $rh = [Math]::Max($h, 600)
  $edgeArgs = @('--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
            '--disable-extensions', "--user-data-dir=$profileDir", '--force-device-scale-factor=1',
            '--blink-settings=preferredColorScheme=1',   # helles Design erzwingen
            "--window-size=$rw,$rh", "--virtual-time-budget=$budget", "--screenshot=$raw")
  if ($Transparent) { $edgeArgs += '--default-background-color=00000000' }
  $edgeArgs += "$base/$path"
  $p = Start-Process -FilePath $edge -ArgumentList $edgeArgs -PassThru -WindowStyle Hidden
  if (-not $p.WaitForExit(60000)) { $p.Kill(); throw "Zeitüberschreitung bei $file" }
  if (-not (Test-Path $raw)) { throw "Screenshot fehlgeschlagen: $file" }
  $src = [Drawing.Image]::FromFile($raw)
  try {
    $bmp = New-Object Drawing.Bitmap $w, $h, ([Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.DrawImage($src, (New-Object Drawing.Rectangle 0, 0, $w, $h), (New-Object Drawing.Rectangle 0, 0, $w, $h), [Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $bmp.Save($target, [Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
  } finally { $src.Dispose(); Remove-Item $raw -Force -ErrorAction SilentlyContinue }
  Write-Host "✓ $file ($w×$h)" -ForegroundColor Green
}

try {
  Shot 'store/src/logo.html' 300 300 'logo-300.png' 2000 -Transparent
  foreach ($lang in 'de', 'en') {
    Shot "store/src/tile-small.html?lang=$lang" 440 280 "tile-small-440x280-$lang.png" 2000
    Shot "store/src/tile-large.html?lang=$lang" 1400 560 "tile-large-1400x560-$lang.png" 2000
    $i = 1
    foreach ($view in 'overview', 'popup', 'capture', 'color', 'import') {
      Shot "store/src/shot.html?view=$view&lang=$lang" 1280 800 "screenshot-$i-$view-$lang.png" 15000
      $i++
    }
  }
} finally {
  Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match 'serve\.ps1' -and $_.CommandLine -match "$Port" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Remove-Item $profileDir -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "Fertig: $out"
