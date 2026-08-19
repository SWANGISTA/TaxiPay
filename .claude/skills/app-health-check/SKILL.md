---
name: app-health-check
description: Verify that a full-stack app actually works end to end — backend starts cleanly, frontend starts cleanly, the frontend can actually talk to the backend (not just that both processes are running), key pages load without errors, and any existing test suite passes. Works on any stack (Node, Python, Go, Rails, etc.) by inspecting the project first rather than assuming a framework. Use this whenever the user asks to "check if my app is working", "make sure everything's connected", "test my app end to end", "verify frontend and backend are talking to each other", "sanity check my project before I push/deploy", or after pulling new code / making changes and wanting confidence nothing broke. Also trigger if the user describes a symptom like "my frontend isn't getting data from my backend" or "something's broken but I don't know what" — this skill's whole job is finding exactly that.
---

# App Health Check

The single most common way a full-stack app is "broken" isn't a syntax error — it's that the backend runs fine, the frontend runs fine, and they simply aren't talking to each other correctly (wrong port, CORS, a stale API URL in an env file, a proxy misconfigured). A check that only confirms "both servers started" misses this every time. This skill exists to catch the real failure mode, not just the easy one.

Work through the checks below in order, stop and report clearly the moment something fails (no point running a browser check against a backend that never started), and always finish with the summary format at the bottom — even a partial run.

## 1. Figure out what you're dealing with

Don't assume a framework. Look at the project root and any obvious subfolders (`frontend/`, `backend/`, `client/`, `server/`, `api/`, `web/`) for the signals below, and use whichever apply:

| Signal file | Tells you |
|---|---|
| `package.json` | Node project — check scripts for `dev`/`start`/`build`/`test`, and dependencies for the framework (React, Vue, Next.js, Express, Fastify, NestJS...) |
| `requirements.txt` / `pyproject.toml` / `Pipfile` | Python project — look for Flask/Django/FastAPI, and a `manage.py` (Django) or `main.py`/`app.py` entrypoint |
| `go.mod` | Go project — `go run .` or check for a `Makefile`/`cmd/` entrypoint |
| `Gemfile` | Rails — `bin/rails server` |
| `docker-compose.yml` / `compose.yaml` | The project may expect to run via `docker compose up` rather than each piece separately — this is often the intended way to run it, so prefer it if present and Docker is available |
| `.env` / `.env.example` / `.env.local` | Config the servers need — note the API base URL, ports, and any keys the app expects, since these are exactly where frontend/backend mismatches hide |

If it's a monorepo with a clear frontend/backend split, treat them as two things to start and check independently, then a third check for whether they connect. If it's one unified app (e.g. Next.js API routes, Django serving templates), adjust — there's no separate "frontend server" to start, so skip straight to checking the app serves pages and its own API routes correctly.

If you genuinely can't tell how the project is meant to run after checking the above, look for a README — it usually says. If it's still unclear, ask the user rather than guessing wrong and reporting a false failure.

## 2. Make sure dependencies are actually installed

A missing `node_modules` or a Python env that's never been set up will look exactly like a crash, and it's a waste of the user's time to report "backend broken" when the real issue is nobody ran `npm install`. Check for the installed state (`node_modules/` exists, a venv is active or `pip list` shows the requirements, etc.) before starting anything. If dependencies look missing, install them (`npm install`, `pip install -r requirements.txt`, etc.) and mention you did — don't silently skip this and report a misleading failure.

## 3. Start the backend and watch for real errors

Start it the way the project defines (its dev/start script, not a guess), capturing stdout/stderr rather than discarding it. A process that's technically running but spamming stack traces or "ECONNREFUSED to database" in its logs is not healthy, even if the port is open — read the first several seconds of output, not just the exit code. Note which port it's listening on; you'll need it for step 5.

If it fails to start, capture the actual error and stop here for the backend — report it plainly (e.g. "backend crashes on startup: `Error: connect ECONNREFUSED 127.0.0.1:5432` — looks like it can't reach a database") rather than a bare "failed."

## 4. Start the frontend and watch for real errors

Same idea. Dev servers for things like Vite/webpack/Next print a "ready" message and a local URL when healthy — confirm you see that, not just that the process didn't immediately exit. Note the port/URL.

## 5. Confirm the frontend can actually reach the backend

This is the check that matters most and is the easiest to skip by accident. Don't just check both ports are open — prove data actually flows between them:

- Find where the frontend expects the API to be. Check its env vars (`VITE_API_URL`, `REACT_APP_API_URL`, `NEXT_PUBLIC_API_URL`, etc.), a proxy config (`vite.config.js` proxy block, `package.json` `"proxy"` field for CRA, `next.config.js` rewrites), or hardcoded fetch URLs in the source if nothing else is configured.
- Hit a real backend endpoint the frontend actually calls (not just `/health` if the app has one — a real data endpoint is a better test) using the same URL the frontend would use, and confirm you get a real response, not a CORS error, 404, or connection refused.
- If you can run a headless browser (Playwright/Puppeteer, especially if already a dependency of the project — check `package.json`), load the frontend's actual page and confirm a real network request to the backend succeeds and the data shows up in the DOM, rather than just curling the API directly. This catches issues curl alone won't, like CORS, which only bites in an actual browser context. If no headless browser tooling is available, the direct-curl check above is still meaningful — just say in the report that browser-level CORS wasn't verified.

A mismatch here — frontend configured for port 3000, backend actually running on 5000, or a CORS policy that only allows a different origin — is the single most common "why doesn't my app work" bug. Don't skip this step even if steps 3 and 4 both looked clean.

## 6. Check key pages/features load

If you have headless browser tooling available (Playwright/Puppeteer/similar already in the project's dependencies), open the main page and any obviously important routes (login, dashboard, whatever the app's core feature is — check the router/routes file for a sense of what matters), and watch for browser console errors, not just a 200 status. A page can return 200 and still be broken (blank due to a JS exception).

If no browser tooling is available in the project and installing a whole new one seems like overkill for a quick check, fall back to curling each key route and confirming it returns real HTML (not an error page or a blank shell with an error trapped in JS you can't see from curl) — and say plainly in the report that this was a lighter check than a real browser render, so the user knows the limits of what was verified.

## 7. Run the existing test suite, if there is one

Check for a test script in `package.json`, a `pytest`/`tests/` setup, `go test ./...`, `bundle exec rspec`, etc. If one exists, run it and report pass/fail counts. If there's no test suite, say so plainly rather than silently skipping — "no automated tests found" is useful information, not a gap to paper over.

## 8. Clean up

If you started any servers in steps 3/4 that weren't already running before you began, stop them when you're done (kill the processes) — don't leave background dev servers running on the user's ports after the check finishes. If something was already running before you started (e.g. the user had `npm run dev` going in another terminal), leave it as you found it.

## Report format

Always end with a short, scannable summary — this is what the user actually wants, not a wall of command output. Use this shape:

```
App Health Check — <project name>

✅ Backend starts cleanly (port 5000)
✅ Frontend starts cleanly (port 3000)
❌ Frontend → backend connection: frontend calls http://localhost:8000, backend is on 5000 — mismatched API URL in .env
✅ Key pages load without console errors
⚠️ No automated tests found

Summary: 1 real problem found — fix the API URL in frontend/.env (should be http://localhost:5000) and re-run.
```

Use ✅ for passed, ❌ for a real failure with a specific cause (not just "failed"), and ⚠️ for things that are informational rather than pass/fail (no tests present, a check had to fall back to a lighter method). Always end with one plain-language line on what to do next — the user should know exactly what to fix, not just that something's wrong.
