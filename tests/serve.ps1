# Minimaler statischer Webserver (nur localhost) für tests/run.html.
# Aufruf aus dem Projektordner:  powershell -ExecutionPolicy Bypass -File tests\serve.ps1
# Danach im Browser öffnen:      http://localhost:8765/tests/run.html
param([int]$Port = 8765)

$root = Split-Path -Parent $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Tabi-Testserver: http://localhost:$Port/tests/run.html  (Strg+C beendet)"
$types = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8';
            '.json' = 'application/json; charset=utf-8'; '.png' = 'image/png' }
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
      if ($rel -eq '') {
        $res.Redirect("http://localhost:$Port/tests/run.html")
      } else {
        $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
        if ($path.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path $path -PathType Leaf)) {
          $bytes = [IO.File]::ReadAllBytes($path)
          $ext = [IO.Path]::GetExtension($path).ToLower()
          $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
          $res.Headers.Add('Cache-Control', 'no-store')
          $res.ContentLength64 = $bytes.Length
          $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
          $res.StatusCode = 404
        }
      }
    } catch {
      Write-Host "Fehler bei $($ctx.Request.Url): $_"
    } finally {
      $res.Close()
    }
  }
} finally {
  $listener.Stop()
}
