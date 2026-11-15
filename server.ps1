# Мини-сервер для курса «Сайт с 0»: раздаёт эту папку и открывает курс в браузере.
# Работает на встроенном PowerShell — ничего устанавливать не нужно.
param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
  '.svg'  = 'image/svg+xml'
  '.txt'  = 'text/plain; charset=utf-8'
}

# Ищем свободный порт
$listener = $null
foreach ($port in 8137..8147) {
  try {
    $candidate = New-Object System.Net.HttpListener
    $candidate.Prefixes.Add("http://localhost:$port/")
    $candidate.Start()
    $listener = $candidate
    break
  } catch { }
}
if (-not $listener) {
  Write-Host 'Не удалось запустить сервер: порты 8137-8147 заняты.'
  Read-Host 'Нажмите Enter, чтобы закрыть'
  exit 1
}

$url = @($listener.Prefixes)[0]
Write-Host ''
Write-Host "  Курс открыт в браузере: $url"
Write-Host '  Не закрывайте это окно, пока занимаетесь.'
Write-Host '  Закроете окно — курс перестанет открываться (прогресс сохранится).'
Write-Host ''
if (-not $NoBrowser) { Start-Process $url }

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $response = $context.Response
  try {
    $path = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath).TrimStart('/')
    if ($path -eq '') { $path = 'index.html' }
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $path))

    # отдаём только файлы внутри папки курса
    if (-not $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
      $response.StatusCode = 404
    } else {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      if ($mime.ContainsKey($ext)) { $response.ContentType = $mime[$ext] } else { $response.ContentType = 'application/octet-stream' }
      if ($path -eq 'sw.js') { $response.Headers['Cache-Control'] = 'no-cache' }
      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
  } catch {
    $response.StatusCode = 500
  } finally {
    $response.Close()
  }
}
