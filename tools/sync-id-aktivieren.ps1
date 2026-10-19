# Tabi – feste Erweiterungs-ID für den Sync aktivieren.
#
# Edge synchronisiert Erweiterungsdaten anhand der Erweiterungs-ID. Bei entpackten Erweiterungen
# hängt die ID ohne "key" vom Ordnerpfad ab und ist auf jedem Gerät anders. Dieses Skript trägt
# einen festen öffentlichen Schlüssel in manifest.json ein → ID überall: ohoajbcppfidbcpaeipdehpeadbocbah
#
# ACHTUNG: Auf einem Gerät, auf dem Tabi schon läuft, ändert sich die ID dadurch EINMALIG.
# Die bisher gespeicherte Vorlage ist danach nicht mehr erreichbar. Deshalb VORHER:
#   Tabi → Vorlage bearbeiten → „Exportieren“
#
# Aufruf im Tabi-Ordner:  powershell -ExecutionPolicy Bypass -File tools\sync-id-aktivieren.ps1

$ErrorActionPreference = 'Stop'
$key = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuXm2aoXUwk1CY2Vr/xGTTVULsDJrsbauKKtnKwSkeMn3Jso5fsfDtX7QHy5eLSlA53SjGK11R+vOaNxYN5GtbYsIvaN9U48RcIQuF0ApKDyzKnmqpRtXkxlable5PfcpItPMJ0yOQmPuXI/sLy3kAQIs2G5ahshrouq0WmzR+6O39KfixGnSwDkmlTDvwHeLdkLVgc0pPoS8GGUDxrnFiRReAoLwTq/N2DpNYtDZ7/D05YrrCz2w0ysKOznip1KFYfjBzbtG30HYtp3bd8fgU16SOsBelouXkF/HZsNpYPwprJBOwkzYY84/eoyTN986PPvtnUjavseZUeuNssVQVQIDAQAB'
$manifest = Join-Path (Split-Path -Parent $PSScriptRoot) 'manifest.json'
$text = [IO.File]::ReadAllText($manifest)

if ($text -match '"key"\s*:') {
  Write-Host 'manifest.json enthält bereits einen "key" – nichts zu tun.' -ForegroundColor Yellow
  exit 0
}

$answer = Read-Host 'Hast du deine Vorlage vorher exportiert (Tabi → Vorlage bearbeiten → Exportieren)? [j/n]'
if ($answer -notmatch '^[jJyY]') {
  Write-Host 'Abgebrochen. Bitte zuerst exportieren.' -ForegroundColor Yellow
  exit 1
}

$new = [regex]::Replace($text, '("version"\s*:\s*"[^"]*",)', "`$1`n  `"key`": `"$key`",", 1)
if ($new -eq $text) { throw 'Konnte die Zeile "version" in manifest.json nicht finden.' }
$null = $new | ConvertFrom-Json   # Gegenprobe: gültiges JSON?
[IO.File]::WriteAllText($manifest, $new, (New-Object Text.UTF8Encoding $false))

Write-Host ''
Write-Host 'Fertig. Feste Erweiterungs-ID: ohoajbcppfidbcpaeipdehpeadbocbah' -ForegroundColor Green
Write-Host 'Weiter: edge://extensions → Tabi entfernen → „Entpackte Erweiterung laden“ → diesen Ordner wählen.'
Write-Host 'Danach in Tabi „Datei importieren“ (oder „Aktuelle Sitzung übernehmen“) → „Als Standard speichern“.'
