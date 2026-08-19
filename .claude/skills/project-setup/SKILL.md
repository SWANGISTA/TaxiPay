---
name: project-setup
description: Get a freshly cloned or pulled project actually ready to run — install dependencies with the right package manager, create the .env file and fill in real values for any secrets by asking the user, run database migrations if the project has them, flag any required global tools (Docker, Postgres, a specific Node/Python version) that aren't installed, and set up git hooks or recommended editor extensions if the project defines them. Works on any stack by inspecting the project first. Use this whenever the user asks to "set up this project", "get this repo running", "install everything I need for this app", right after using github-sync to clone something new, or when they say something like "I just pulled this down, what do I need to do to run it" or "why won't this project start" for a project they've never run before (as opposed to one that's already set up and just broken — that's app-health-check's job).
---

# Project Setup

The goal here is to take a project from "just cloned, zero local setup" to "ready to actually run" — the tedious first-time checklist every project has (install deps, make an env file, wire up a database, maybe some editor/git config) that's easy to get wrong or forget a step of. Do this thoroughly and in the right order, because these steps depend on each other: installing dependencies before you know which package manager the project uses wastes time, and running database migrations before the database connection is configured just fails confusingly.

Work through the sections in order. Each one explains why the order matters — don't skip ahead even if a later step seems more interesting.

## 1. Figure out what you're dealing with

Same idea as reading a room before you start rearranging furniture — look at the project root (and `frontend/`/`backend/` subfolders if it's a split repo) before running anything:

| Signal | Tells you |
|---|---|
| `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` / `bun.lockb` | Which Node package manager to use — matching the lockfile matters, using the wrong one can produce a different dependency tree than what the project was built and tested against |
| `requirements.txt`, `Pipfile`, `pyproject.toml` (+ `poetry.lock`) | Python, and which tool manages it (pip, pipenv, poetry) |
| `go.mod`, `Gemfile`, `composer.json`, `Cargo.toml` | Go, Ruby, PHP, Rust respectively |
| `.nvmrc`, `.python-version`, an `"engines"` field in `package.json` | A specific runtime version the project expects — worth checking against what's actually installed |
| `docker-compose.yml` / `compose.yaml` | Services the project expects running alongside it — very often a database, sometimes Redis, etc. |
| `migrations/`, `prisma/schema.prisma`, `alembic/`, `db/migrate/` | A database with a migration system — note which one (Prisma, Django, Alembic, Rails, raw SQL files) so you know what command runs them |
| `.husky/`, `.pre-commit-config.yaml`, `"husky"` in `package.json` | Git hooks the project wants set up |
| `.vscode/extensions.json` | Recommended editor extensions |

## 2. Check for required global tools before doing anything that depends on them

If step 1 turned up an `.nvmrc` or an `engines` field, compare it to what's actually installed (`node -v`, `python --version`, etc.) — a version mismatch is a common source of "works on my machine" bugs and worth a heads-up even if you proceed anyway. If there's a `docker-compose.yml`, check `docker --version` / `docker compose version` actually work, since you'll likely need it in step 5.

Report gaps plainly as you find them rather than pushing forward and letting a later step fail mysteriously — "this project wants Node 20 but you have Node 18 installed" said up front is much more useful than a cryptic dependency install failure five minutes later that turns out to be the same root cause.

## 3. Set up the .env file

Look for `.env.example`, `.env.sample`, or `.env.template`. If one exists and there's no `.env` already, copy it to `.env`. If a `.env` already exists, leave it alone — don't overwrite it. It may hold real secrets from a previous setup, and clobbering it is exactly the kind of silent data loss this skill should never cause. If both exist, compare them and mention any new keys in the example that are missing from the existing `.env`, so the user can add just those rather than losing what's already configured.

Once you have a `.env` to work with, go through its keys and sort them into two buckets:

- **Already has a usable value** — the example shipped with a sensible default (`PORT=3000`, `NODE_ENV=development`, a value that's clearly a placeholder like `localhost` for a URL). Leave these as-is.
- **Needs a real value** — empty, or an obvious placeholder (`your_api_key_here`, `xxx`, `changeme`, a value that's clearly fake). These need the user's real secrets before the app will actually work.

For each variable in the second bucket, ask the user for it one at a time rather than dumping a wall of "please provide: X, Y, Z, W" — that's overwhelming and error-prone to answer all at once in a chat. For each one, give them useful context if you can infer it: the variable name itself is often a strong hint (`STRIPE_SECRET_KEY` → Stripe dashboard, `DATABASE_URL` → wherever their DB is hosted or the local one from `docker-compose`), and check the `.env.example` file and README for comments that explain where a value comes from. Write each answer into `.env` as they give it to you. If the user doesn't have a value yet and wants to skip one, that's fine — leave it as the placeholder and note it clearly in the final summary rather than blocking the rest of setup on it.

## 4. Install dependencies

Now that you know the package manager (step 1) and have the right runtime version (step 2), install. Use the manager that matches the lockfile you found, not whichever one happens to be your default — `npm install` on a project with a `yarn.lock` can produce a subtly different dependency tree than what the project actually expects.

## 5. Bring up any required services and run database migrations

If there's a `docker-compose.yml` with a database (or other) service the app needs, start it (`docker compose up -d <service>`) — check the compose file for the service name rather than guessing. Give it a moment to be ready (check for a "healthy" status if the compose file defines a healthcheck, or just retry the connection briefly) before moving on, since migrations will fail if they run before the database has finished starting up.

Then run migrations using whatever the project's tool is — `npx prisma migrate dev`, `python manage.py migrate`, `alembic upgrade head`, `rails db:migrate`, etc. If migrations fail because a `DATABASE_URL` or similar is still a placeholder from step 3, that's expected — say so plainly rather than treating it as a mysterious new problem, and note in the final summary that migrations are still pending on that value being filled in.

## 6. Git hooks and editor setup

If the project defines git hooks (a `.husky/` folder, `"prepare": "husky install"` in `package.json`'s scripts, or a `.pre-commit-config.yaml`), run whatever sets them up (`npm run prepare`, `pre-commit install`, etc.) so the user's commits get the same checks the project expects.

If there's a `.vscode/extensions.json` with recommended extensions, just mention them in the summary — VS Code already prompts users to install workspace-recommended extensions on its own, so you don't need to do anything beyond flagging that they exist.

## Report format

Finish with a short, scannable summary — this is what tells the user whether they can actually run the app now or if something still needs their attention:

```
Project Setup — <project name>

✅ Dependencies installed (npm, matched package-lock.json)
✅ .env created from .env.example — 2 values filled in (DATABASE_URL, STRIPE_SECRET_KEY), 1 left as placeholder (SENDGRID_API_KEY — you said you'd add it later)
✅ Database service started (docker compose) and migrations ran (3 applied)
⚠️ Node version mismatch: project expects 20 (.nvmrc), you have 18 installed
✅ Git hooks installed (husky)

Summary: setup's done and the app should run. One thing to fix when you get a chance: switch to Node 20 to match what the project expects, and add a real SENDGRID_API_KEY whenever you're ready to test email sending.
```

Use ✅ for steps that completed successfully, ⚠️ for things that need the user's attention but didn't block setup (version mismatches, skipped secrets, missing optional tools), and be specific about what's still needed rather than vague. If the user wants to confirm the app actually boots after this, that's a good moment to mention they can also ask for an app health check (the `app-health-check` skill), but don't run one automatically as part of this skill.
