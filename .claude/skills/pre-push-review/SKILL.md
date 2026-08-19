---
name: pre-push-review
description: Review the code the user is about to push — everything committed since the last push, plus any uncommitted changes still sitting in the working tree — for real bugs and logic errors, security issues like hardcoded secrets or injection risk, leftover debug code, and inconsistent error handling. This is a second pair of eyes on your OWN changes before they go up to GitHub, separate from github-sync (which does the actual pushing) and separate from a general code explanation. Use this whenever the user asks to "review my changes before I push", "check my code before pushing", "look over what I'm about to push", "did I leave anything sloppy in here", or wants a sanity check on recent commits before sharing them. Also trigger if the user seems about to push (e.g. just finished a feature and says "ok let's push this") and hasn't asked for review yet — offering a quick review first is exactly this skill's purpose.
---

# Pre-Push Review

This is a review of the user's own unpushed work, done right before it leaves their machine — the moment a second pair of eyes is most useful and cheapest to get, because nothing has shipped yet. The point isn't to nitpick style or rewrite their code to match your preferences; it's to catch the kind of thing that's easy to miss when you've been staring at your own diff for an hour: a leftover `console.log`, a null check that got deleted along with the code around it, an API key that snuck into a config file, an error that's silently swallowed instead of handled.

Be a good reviewer, not a pedantic one. A real reviewer flags "this will break in production" and stays quiet about "I'd have named this variable differently." If you find yourself about to flag something purely stylistic, ask whether it would actually cause a bug, a security issue, or genuinely confuse the next person reading this file — if not, leave it out. A report full of low-value nitpicks trains the user to stop reading it.

## 1. Gather the right diff

The point of a pre-push review is to look at everything that's about to leave the machine, so gather both pieces:

**Committed but unpushed work** — this is the main thing being reviewed. Find the upstream branch (`git rev-parse --abbrev-ref --symbolic-full-name @{u}`) and diff against it (`git diff @{u}...HEAD`, or `git log @{u}..HEAD` for the commit list first if that's a clearer starting point). If there's no upstream configured yet — a branch that's never been pushed — fall back to diffing against the repo's default branch (check `git symbolic-ref refs/remotes/origin/HEAD`, or try `main` then `master`) so you're still reviewing "everything new on this branch" rather than nothing.

**Uncommitted changes still in the working tree** — check `git status`. If there's anything staged or modified that isn't committed yet, review that too. It's about to become part of what gets pushed (once committed), and skipping it would mean the most recent edits — often the freshest and least-reviewed code — never get looked at. Mention clearly in the report which findings are in already-committed code versus the uncommitted working tree, since that changes what "fixing it" looks like (amend a commit vs. just edit the file).

If there's nothing new in either place, say so and stop — there's nothing to review.

## 2. Read the actual diff, not just the file names

For each changed file, look at both the diff and enough surrounding context in the file to judge it fairly — a three-line diff can look fine in isolation and still be wrong given what's around it. Look for:

**Real bugs and logic errors.** Off-by-one errors, a condition that looks inverted, a variable that's shadowing another, a comparison that should be `===` vs `==` (or the language equivalent), an async call that's missing its `await`, a return value that's ignored when it shouldn't be. Prioritize things you can actually explain the failure mode for — "this will throw when X is null" is a real finding; "this looks a bit off" is not.

**Security issues.** Hardcoded API keys, passwords, or tokens (anything that looks like a real secret rather than a placeholder — check against the same placeholder patterns you'd expect in a `.env.example`: `xxx`, `changeme`, `your_key_here` are fine, something that looks like an actual live key is not). SQL built via string concatenation with user input instead of parameterized queries. User input passed into `eval`, `exec`, `dangerouslySetInnerHTML`, or similar without any sanitization. These are worth flagging even if you're not 100% sure it's exploitable — better to ask than to let a real one through.

**Leftover debug/junk code.** `console.log`/`print`/`debugger` statements that look like they were added for debugging rather than intentional logging, large commented-out code blocks, `TODO`/`FIXME` markers that suggest unfinished work, imports that are no longer used after the change. These aren't bugs, but they're exactly the kind of thing that's easy to forget to clean up and mildly embarrassing to have someone else notice later.

**Inconsistent error handling.** A risky call (network request, file read, JSON parse, database query) with no error handling where the rest of the codebase wraps equivalent calls in try/catch or checks a returned error. An error that's caught and then silently ignored (`catch (e) {}`) rather than logged or handled. To judge "inconsistent" fairly, glance at how similar code elsewhere in the same file or a nearby file handles the same kind of operation — matching the codebase's own convention is the bar, not some external best-practice checklist.

## 3. Report findings

Group by file, and within each file, order by severity — real problems first, informational notes last. For each finding, name the actual failure mode or risk, not just what's different — "X could cause Y when Z happens" is far more useful than "this looks risky."

```
Pre-Push Review — 3 files changed, 2 unpushed commits + uncommitted changes in 1 file

src/api/users.js (committed)
  🔴 Line 42: SQL built with string concatenation from `req.params.id` — vulnerable to SQL injection. Use a parameterized query instead.
  🟡 Line 58: console.log("here") left in — looks like debug output, not intentional logging.

src/auth/login.js (uncommitted)
  🔴 Line 15: catch block is empty — a failed login attempt fails silently instead of showing the user an error. Every other auth function in this file logs the error at minimum.

src/utils/format.js (committed)
  No issues found.

Summary: 2 real issues found (1 security, 1 error handling) — both worth fixing before pushing. 1 minor cleanup item (leftover log line).
```

Use 🔴 for things that would actually cause a bug, a security problem, or a real gap in error handling, and 🟡 for lower-stakes cleanup items like debug logs or unused imports. If a file has no issues, say so plainly rather than omitting it — that confirms it was actually reviewed, not skipped.

If you found nothing at all across every file, say that clearly and don't manufacture a finding to seem thorough — "no issues found" is a completely valid and useful result.

## 4. If you found real (🔴) issues, check in before assuming they'll push anyway

This skill doesn't do the pushing itself — that's `github-sync` — but if you found genuine problems, don't just silently print the report and move on as if the conversation is over. Ask plainly whether the user wants to fix these first or is fine pushing as-is (some findings turn out to be false alarms, or the user may have context you don't — that's their call, not yours to force). If everything found was 🟡-level cleanup only, or nothing was found, there's no need to ask anything — just deliver the report.
