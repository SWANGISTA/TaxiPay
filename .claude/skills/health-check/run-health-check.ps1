# Health-check script for Portfolio projects
# Usage: powershell -ExecutionPolicy Bypass -File .claude\skills\health-check\run-health-check.ps1

param()

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path (Resolve-Path "$root\..\..\..").Path

Write-Output "Project root: $(Get-Location)"

$checks = @()

function Add-CheckResult($name, $ok, $details) {
    $checks += [pscustomobject]@{ check = $name; ok = $ok; details = $details }
}

# 1. Check presence of common frontend files
$expectedFiles = @('index.html','script.js','chatbot.js','styles.css')
$found = @{}
foreach ($f in $expectedFiles) {
    $exists = Test-Path -Path (Join-Path -Path (Get-Location) -ChildPath $f)
    $found[$f] = $exists
}
Add-CheckResult -name 'frontend-files-present' -ok ($found.Values -notcontains $false) -details ("Files presence: " + ($found.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" } -join "; "))

# 2. Scan JS files for API usage
$jsFiles = Get-ChildItem -Path (Get-Location) -Include *.js -File -Recurse -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
$apiFindings = @()
if ($jsFiles) {
    foreach ($file in $jsFiles) {
        $content = Get-Content -Raw -Path $file -ErrorAction SilentlyContinue
        if ($null -ne $content) {
            # look for fetch, axios, XMLHttpRequest, http(s)://, YOUR_API_ENDPOINT
            if ($content -match "fetch\s*\(|axios\.|XMLHttpRequest|https?://[^")\s]+|YOUR_API_ENDPOINT") {
                $matches = ([regex]::Matches($content, "fetch\s*\(|axios\.|XMLHttpRequest|https?://[^\")\s]+|YOUR_API_ENDPOINT")) | ForEach-Object { $_.Value }
                $apiFindings += [pscustomobject]@{ file = $file; matches = ($matches -join ', ') }
            }
        }
    }
}
if ($apiFindings.Count -gt 0) {
    Add-CheckResult -name 'api-endpoints-detected' -ok $true -details ("Found API usage in JS files: " + ($apiFindings | ForEach-Object { "$($_.file) -> $($_.matches)" } -join "; "))
} else {
    Add-CheckResult -name 'api-endpoints-detected' -ok $false -details 'No explicit API calls or endpoints detected in JS files.'
}

# 3. Try to start a lightweight static server using Python 3 (if available)
$pythonVersion = $null
try {
    $pythonVersion = (& python --version) 2>&1
} catch {
    # ignore
}

$serverStarted = $false
$serverPid = $null
$serverPort = 8000
if ($pythonVersion) {
    Write-Output "Python detected: $pythonVersion"
    Write-Output "Starting static server on port $serverPort (python -m http.server $serverPort)"
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = 'python'
    $startInfo.Arguments = "-m http.server $serverPort"
    $startInfo.WorkingDirectory = (Get-Location).Path
    $startInfo.UseShellExecute = $true
    $startInfo.CreateNoWindow = $true

    $proc = [System.Diagnostics.Process]::Start($startInfo)
    Start-Sleep -Seconds 2
    if (-not $proc.HasExited) {
        $serverStarted = $true
        $serverPid = $proc.Id
        Add-CheckResult -name 'static-server-started' -ok $true -details "python server started (PID=$serverPid) on port $serverPort"

        # perform a GET to / and check content
        try {
            $url = "http://localhost:$serverPort/"
            Write-Output "Fetching $url"
            $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
            if ($resp.StatusCode -eq 200 -and ($resp.Content -match '<!DOCTYPE html|<html')) {
                Add-CheckResult -name 'serve-index' -ok $true -details "GET $url returned HTML content (length=$($resp.Content.Length))"
            } else {
                Add-CheckResult -name 'serve-index' -ok $false -details "GET $url returned status $($resp.StatusCode) or non-HTML content"
            }
        } catch {
            Add-CheckResult -name 'serve-index' -ok $false -details "Failed to GET http://localhost:$serverPort - $_"
        }

        # stop server
        try {
            Stop-Process -Id $serverPid -Force -ErrorAction SilentlyContinue
            Add-CheckResult -name 'static-server-stopped' -ok $true -details "Stopped python server (PID=$serverPid)"
        } catch {
            Add-CheckResult -name 'static-server-stopped' -ok $false -details "Failed to stop python server (PID=$serverPid)"
        }
    } else {
        Add-CheckResult -name 'static-server-started' -ok $false -details 'Python server process exited immediately'
    }
} else {
    Add-CheckResult -name 'python-available' -ok $false -details 'Python 3 not found in PATH; skipping static server check.'
}

# 4. Summary and recommendations
Write-Output "`n=== Health-check summary ==="
$allOk = $true
foreach ($c in $checks) {
    $status = if ($c.ok) { 'OK' } else { 'WARN' }
    Write-Output ("[{0}] {1} - {2}" -f $status, $c.check, $c.details)
    if (-not $c.ok) { $allOk = $false }
}

Write-Output "`nRecommendations:"
if (-not ($found['index.html'])) { Write-Output "- Missing index.html: the frontend may not have an entry point." }
if ($found.Values -notcontains $false) { Write-Output "- Frontend files look present." }
if ($apiFindings.Count -gt 0) {
    Write-Output "- JS files reference APIs. If you have a backend, ensure it's running and reachable at the detected endpoints. If the code uses placeholders (e.g. YOUR_API_ENDPOINT), update them to the real backend URL before testing."
} else {
    Write-Output "- No backend endpoints detected in JS; frontend may be static or simulate submissions (see contact form)." }

if (-not $pythonVersion) { Write-Output "- To perform a live serve check, install Python 3 or run any static server and re-run this script." }

if ($allOk) {
    Write-Output "`nOverall: PASS — basic checks succeeded."
    exit 0
} else {
    Write-Output "`nOverall: WARN — some checks need attention."
    exit 2
}
