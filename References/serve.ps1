param(
  [int]$Port = 8000
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Serving $root on http://localhost:$Port/ (Ctrl+C to stop)"

# Prefer localhost binding to reduce URL ACL issues
$prefix = "http://localhost:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Error "Failed to start listener on $prefix. If you see 'Access is denied', run PowerShell as Administrator once or choose a different port."; throw
}

# Minimal content-type map
$mime = @{
  '.html'='text/html; charset=utf-8'
  '.htm' ='text/html; charset=utf-8'
  '.css' ='text/css; charset=utf-8'
  '.js'  ='application/javascript; charset=utf-8'
  '.mjs' ='application/javascript; charset=utf-8'
  '.json'='application/json; charset=utf-8'
  '.map' ='application/json; charset=utf-8'
  '.png' ='image/png'
  '.jpg' ='image/jpeg'
  '.jpeg'='image/jpeg'
  '.gif' ='image/gif'
  '.svg' ='image/svg+xml'
  '.ico' ='image/x-icon'
  '.txt' ='text/plain; charset=utf-8'
}

function Send-Response($context, [int]$statusCode, [byte[]]$bytes, [string]$contentType){
  $resp = $context.Response
  $resp.StatusCode = $statusCode
  if ($contentType) { $resp.ContentType = $contentType }
  if ($bytes) {
    $resp.ContentLength64 = $bytes.Length
    $out = $resp.OutputStream
    $out.Write($bytes, 0, $bytes.Length)
    $out.Close()
  } else {
    $resp.Close()
  }
}

function Get-LocalPath([string]$absPath){
  $decoded = [System.Uri]::UnescapeDataString($absPath)
  $rel = $decoded.TrimStart('/')
  if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
  $fsPath = Join-Path $root $rel
  if ((Test-Path $fsPath) -and (Get-Item $fsPath).PSIsContainer) {
    $fsPath = Join-Path $fsPath 'index.html'
  }
  return $fsPath
}

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request

    if ($req.HttpMethod -eq 'OPTIONS') {
      # Simple CORS preflight support (not strictly required for this app)
      $ctx.Response.AddHeader('Access-Control-Allow-Origin','*')
      $ctx.Response.AddHeader('Access-Control-Allow-Methods','GET, OPTIONS')
      $ctx.Response.AddHeader('Access-Control-Allow-Headers','*')
      Send-Response $ctx 200 ([byte[]]@()) 'text/plain'
      continue
    }

    $path = $req.Url.AbsolutePath
    $file = Get-LocalPath $path

    if (Test-Path $file -PathType Leaf) {
      try {
        $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
        $ctype = $mime[$ext]
        if (-not $ctype) { $ctype = 'application/octet-stream' }
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ctx.Response.AddHeader('Cache-Control','no-cache, no-store, must-revalidate')
        $ctx.Response.AddHeader('Pragma','no-cache')
        $ctx.Response.AddHeader('Expires','0')
        Send-Response $ctx 200 $bytes $ctype
      } catch {
        Write-Warning "500 while reading $file : $_"
        Send-Response $ctx 500 ([System.Text.Encoding]::UTF8.GetBytes('Internal Server Error')) 'text/plain; charset=utf-8'
      }
    } else {
      Write-Host "404: $path"
      Send-Response $ctx 404 ([System.Text.Encoding]::UTF8.GetBytes('Not Found')) 'text/plain; charset=utf-8'
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
