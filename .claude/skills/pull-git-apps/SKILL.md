---
name: pull-git-apps
description: Fetches an application's source code from a public GitHub repository, detects its project type (Node/npm/yarn/pnpm, Python, Rust, Go, Java/Maven/Gradle, Ruby, PHP, .NET, or Docker-based), installs its dependencies, and builds it so it's ready to run. Use this skill whenever the user asks to pull, grab, get, clone, download, install, set up, or try out an app, tool, project, or repo from GitHub — whether they give a full github.com URL, an owner/repo shorthand (e.g. "expressjs/express"), or just describe the tool by name and want it fetched and working locally. Also use it when the user pastes a GitHub link and asks what it does or wants to run it.

Pull Git Apps

Fetch a public GitHub project, figure out how it's built, install its dependencies, and get it into a runnable state — the same sequence a developer would go through by hand after cloning a new repo.

Why this matters

"Pull this app from GitHub" almost never means "just clone it." A bare clone is source code sitting on disk with no dependencies installed, no lockfile resolved, and often no clear entry point. The useful outcome is a working checkout the user can immediately run, edit, or inspect — so this skill treats cloning as step one of a short pipeline, not the whole job.

Step 1: Resolve the repo reference

The user might give you any of these — normalize to owner/repo and a clone URL:

A full URL (https://github.com/owner/repo, with or without .git, possibly pointing at a subpath, branch, or PR — strip down to the repo root unless they specifically want a branch/tag/commit)
Shorthand like owner/repo
Just a project name or description ("that CLI tool for renaming files in bulk"). In this case, search first (GitHub's search UI/API via WebFetch/WebSearch, or gh search repos if the gh CLI is available) and confirm the match with the user before pulling — don't guess when several repos could plausibly fit.

This skill is scoped to public repositories only. If a clone fails with an authentication error, don't try to work around it — tell the user the repo appears private (or doesn't exist) and that they'd need to set up their own GitHub credentials for private access.

Step 2: Clone it
bash
git clone --depth 1 <url> <destination>

Use a shallow clone (--depth 1) by default — the goal is a working copy, not full history, and shallow clones are dramatically faster for large repos. Only fetch full history if the user specifically asks for git log/blame/tag history. If git clone isn't available or fails for a plausible network reason, fall back to downloading the repo as a zip archive (https://github.com/<owner>/<repo>/archive/refs/heads/<default-branch>.zip) and extracting it.

Pick a sensible destination directory (e.g. the repo name in the current workspace) and check it doesn't already exist before cloning into it.

Step 3: Detect the project type

Look for marker files at the repo root (and check common subdirectories like server/, backend/, frontend/ if the root looks like a monorepo with no single obvious entry point):

Marker file(s)	Project type	Install command
package.json	Node.js	npm ci (falls back to npm install if no lockfile), or yarn install / pnpm install if a yarn.lock / pnpm-lock.yaml is present
requirements.txt, pyproject.toml, setup.py	Python	pip install -r requirements.txt --break-system-packages or pip install -e . --break-system-packages; prefer a virtualenv if the repo suggests one
Cargo.toml	Rust	cargo build
go.mod	Go	go build ./...
pom.xml	Java (Maven)	mvn install
build.gradle, build.gradle.kts	Java/Kotlin (Gradle)	./gradlew build
Gemfile	Ruby	bundle install
composer.json	PHP	composer install
*.csproj, *.sln	.NET	dotnet build
Dockerfile, docker-compose.yml (and nothing else obviously simpler)	Docker-based	note the build/run commands for the user rather than building automatically — a Docker build can be slow and heavy, so surface docker build . / docker compose up as the next step instead of running it unprompted

A repo can match more than one row (e.g. a Node app with a Dockerfile) — prefer the native toolchain over Docker unless the README specifically steers toward Docker.

If nothing matches, read the README (it's almost always the fastest way to learn how a repo is meant to be set up) before giving up — many projects use a Makefile, a custom setup script (./setup.sh, ./install.sh), or a less common toolchain.

Step 4: Install dependencies and build

Run the install command detected above. Capture and read the output rather than assuming success — dependency installs fail often (version mismatches, native build tools missing, network hiccups) and it's better to catch that now than to report a false "done."

After dependencies are installed, look for a build step if the project needs compiling or bundling (e.g. npm run build for a frontend project, cargo build, go build). Not every project needs this — an interpreted script or a simple library may already be usable right after install.

Step 5: Report back

Tell the user, in plain language:

What was cloned and where it landed
What kind of project it is
What install/build steps ran and whether they succeeded
How to actually run or use it — check the README or package.json scripts block for the real run command rather than guessing (e.g. npm start, python main.py, cargo run, go run .) and surface that command to the user

If something in steps 3–4 failed (missing system dependency, a native toolchain not present in this environment, etc.), say so plainly and give the user the exact error rather than silently leaving a half-set-up project — a partial failure reported clearly is far more useful than a vague "done."

Notes on safety

Installing dependencies and running build scripts executes code that the repo's authors (and their dependencies' authors) wrote — that's true of any npm install or pip install and is expected, normal behavior here since the user explicitly asked for the app. It's still worth a brief heads-up if a repo looks unusual for what was asked (e.g. the user asked for a small CLI tool and the repo turns out to be something else entirely, or a postinstall script does something surprising like reaching out to an unrelated network endpoint) — flag it and let the user decide whether to continue, rather than silently proceeding.