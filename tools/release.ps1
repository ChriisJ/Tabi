# Tabi – Release veröffentlichen.
#
# Prüft Version, Changelog und Git-Status, baut dist/tabi-<version>.zip, setzt den Tag v<version>,
# pusht ihn und legt mit der GitHub-CLI (gh) ein Release mit den Patchnotes aus CHANGELOG.md an.
#
# Aufruf im Tabi-Ordner:
#   powershell -ExecutionPolicy Bypass -File tools\release.ps1            # veröffentlichen
#   powershell -ExecutionPolicy Bypass -File tools\release.ps1 -DryRun    # nur prüfen und anzeigen
#   … -Prerelease                                                          # als Vorabversion markieren
param(
  [switch]$DryRun,
  [switch]$Prerelease
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Fail($msg) { Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }
function Ok($msg) { Write-Host "✓ $msg" -ForegroundColor Green }

foreach ($tool in 'git', 'gh') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Fail "$tool nicht gefunden (winget install Git.Git / GitHub.cli)." }
}

# 1. Version
$version = ([IO.File]::ReadAllText((Join-Path $root 'manifest.json')) | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+$') { Fail "Ungültige Version in manifest.json: $version" }
$tag = "v$version"
Ok "Version $version"

# 2. Changelog-Abschnitt
$changelog = [IO.File]::ReadAllText((Join-Path $root 'CHANGELOG.md'))
$pattern = '(?ms)^## \[' + [regex]::Escape($version) + '\][^\r\n]*\r?\n(.*?)(?=^## \[|^\[[^\]]+\]:|\z)'
$m = [regex]::Match($changelog, $pattern)
if (-not $m.Success) { Fail ('CHANGELOG.md hat keinen Abschnitt "## [' + $version + ']".') }
$notes = $m.Groups[1].Value.Trim()
if (-not $notes) { Fail "Der Changelog-Abschnitt für $version ist leer." }
Ok 'Changelog-Abschnitt gefunden'

# 3. Badge in README
$readme = [IO.File]::ReadAllText((Join-Path $root 'README.md'))
if ($readme -notmatch [regex]::Escape("version-$version-")) { Write-Host "! README-Badge zeigt nicht $version" -ForegroundColor Yellow }

# 4. Git-Status
$dirty = git status --porcelain
if ($dirty) { Fail "Arbeitsverzeichnis nicht sauber – erst committen:`n$dirty" }
if (git tag --list $tag) { Fail "Tag $tag existiert bereits." }
Ok 'Git sauber, Tag frei'

# 5. Paket
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'build-zip.ps1')
$zip = Join-Path $root "dist\tabi-$version.zip"
if (-not (Test-Path $zip)) { Fail 'Paket wurde nicht erstellt.' }

$notesFile = Join-Path ([IO.Path]::GetTempPath()) "tabi-release-$version.md"
# Typografische Anführungszeichen stehen bewusst in einem Here-String mit einfachen Quotes:
# PowerShell würde „ “ sonst als String-Grenzen werten.
$install = @'
**Installation:** ZIP entpacken → `edge://extensions` → Entwicklermodus → „Entpackte Erweiterung laden“. Anleitung: [docs/BEDIENUNG.md](https://github.com/ChriisJ/Tabi/blob/TAG/docs/BEDIENUNG.md)
'@
$body = $notes + "`n`n---`n" + $install.Replace('TAG', $tag)
[IO.File]::WriteAllText($notesFile, $body, (New-Object Text.UTF8Encoding $false))

if ($DryRun) {
  Write-Host "`n--- DryRun: würde ausführen ---" -ForegroundColor Cyan
  Write-Host "git tag -a $tag -m `"Tabi $version`""
  Write-Host "git push origin main $tag"
  Write-Host "gh release create $tag `"$zip`" --title `"Tabi $version`" --notes-file `"$notesFile`"$(if ($Prerelease) { ' --prerelease' })"
  Write-Host "`n--- Release-Text ---" -ForegroundColor Cyan
  Write-Host $body
  exit 0
}

# 6. Tag, Push, Release
git tag -a $tag -m "Tabi $version"
git push origin main $tag
$ghArgs = @('release', 'create', $tag, $zip, '--title', "Tabi $version", '--notes-file', $notesFile)
if ($Prerelease) { $ghArgs += '--prerelease' }
& gh @ghArgs
Ok "Release $tag veröffentlicht."
