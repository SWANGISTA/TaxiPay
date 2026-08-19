---
name: clear-n-run
description: Frees up the local dev server port(s) for this portfolio project and launches it. Use whenever the user asks to "run the project", "start the server", "clear the ports and run", "clear-n-run", or reports the local server won't start / "port already in use".
---

# Clear-n-Run

This project (`Portfolio/`) is a static site (plain HTML/CSS/JS — no `package.json`, no build step). It's served locally with Python's built-in HTTP server on **port 8000**. Any previous run left over (e.g. a stray `python -m http.server` process, or a crashed session) can leave that port occupied, so this skill always clears it before starting a fresh server.

## Ports to clear

Primary port: **8000** (`python -m http.server`).

Also sweep these common local dev ports in case a different static server was used previously, so "clear all needed ports" is actually true rather than just clearing the one this skill starts:

- 8000 (Python http.server — primary)
- 5500 (VS Code Live Server default)
- 3000 (`npx serve` default)

## Step 1: Kill anything listening on those ports

Use the PowerShell tool (this is a Windows environment):

```powershell
$ports = 8000, 5500, 3000
foreach ($port in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        Write-Host "Killing PID $($c.OwningProcess) on port $port"
        Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}
```

If `Get-NetTCPConnection` isn't available for some reason, fall back to `netstat -ano | findstr :<port>` to find the PID in the last column, then `taskkill /PID <pid> /F`.

Don't treat "no process found on a port" as an error — it just means that port was already free.

## Step 2: Start the server

Run from the `Portfolio/` project directory (not the repo root, which only holds `.claude/`):

```powershell
Start-Process python -ArgumentList "-m http.server 8000" -WorkingDirectory "c:\Users\10029404\Personal\Portfolio\Portfolio" -WindowStyle Hidden
```

This detaches the server as its own process so it keeps running after the tool call returns (don't run it as a blocking foreground command — it never exits on its own).

If `python` isn't found, try `python3` or `py` before giving up.

## Step 3: Verify and report

Confirm it's actually listening before declaring success:

```powershell
Start-Sleep -Milliseconds 500
Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
```

Then tell the user the site is running at **http://localhost:8000** and open it in the default browser with `Start-Process "http://localhost:8000"` unless they indicated they don't want the browser opened.

## Notes

- This kills *any* process bound to ports 8000/5500/3000, not just ones related to this project — flag it if `Get-NetTCPConnection` shows a PID whose process name looks unrelated (e.g. not `python`, `node`, or a dev-server binary) before killing it, in case the user has something unrelated running on one of those ports.
- If the user later adds a real backend/build tool to this project (e.g. a `package.json` with its own dev script), update the port list and the Step 2 run command here to match.
