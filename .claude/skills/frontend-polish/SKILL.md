---
name: frontend-polish
description: Give a frontend a real, cumulative improvement pass — visual design and UI polish, performance, accessibility, and code quality — designed to be run repeatedly, with each run picking up where the last one left off instead of repeating the same suggestions. Always proposes a concrete diff/summary and waits for approval before editing any files. Use this whenever the user asks to "make my frontend better", "polish the UI", "improve my frontend", "clean this up", "make this look more professional", or wants ongoing incremental improvement to a frontend's look, speed, accessibility, or code health rather than a one-off fix for a specific bug. Not for building new features or fixing a specific reported bug — those are just normal coding requests; this skill is specifically for open-ended "make it better" polish passes.
---

# Frontend Polish

There's no objective meter for "better," so the honesty of this skill depends on actually finding real, specific things to improve each time — not padding out a plausible-sounding list. The value of running this repeatedly comes from two things: each pass finds a handful of genuinely worthwhile improvements (not a rewrite), and it remembers what it already did so run five doesn't rediscover the same issues run one already fixed. Get both of those right and repeated runs produce real, compounding improvement. Get either wrong — vague suggestions, or no memory across runs — and it's just noise that looks like progress.

## 1. Check for a progress log from previous runs

Look for `.frontend-polish-log.md` in the project root. If it exists, read it — it's a running record of what's already been reviewed and changed in past runs, organized by the four focus areas below. Use it to avoid re-flagging things already fixed, and to see which areas haven't gotten attention yet (if the last three runs all touched visual design and nothing has looked at accessibility yet, that's a strong signal for where to focus this time).

If the file doesn't exist, this is the first run — note that and proceed without it. You will create it at the end of this run either way (see step 5).

## 2. Understand the project's own conventions before touching anything

This matters enormously for "visual design" and "code quality" work specifically: improvements should make the codebase more consistent with itself, not impose your own preferences on top of it. Before suggesting changes, look at:

- What styling approach is already in use (Tailwind config, a CSS-in-JS library, CSS modules, a component library like MUI/Chakra/Radix) and match it — don't introduce a second styling paradigm alongside an existing one.
- What the existing spacing/color/typography scale looks like, if there is one (a Tailwind config, CSS custom properties, a theme file) — polish should tighten adherence to the project's own system, not invent a new one.
- How components are currently structured and named, so code-quality suggestions extend the existing pattern rather than contradicting it.

A change that's objectively "nicer" but inconsistent with everything else in the app usually makes the codebase worse overall, even if that one spot looks better in isolation.

## 3. Review across all four areas, but be selective about what to act on

Look across the frontend for opportunities in each area — but the goal each run is a small number of real, high-value improvements, not an exhaustive list. A reviewer who suggests 40 things is less useful than one who suggests the 5 that matter most; the other 35 can wait for future runs (that's exactly what the progress log is for).

**Visual design / UI polish** — inconsistent spacing or alignment, typography that doesn't follow the established scale, poor visual hierarchy, layout that breaks or looks cramped at common breakpoints, missing hover/focus/loading/empty states that make the UI feel unfinished.

**Performance** — obviously oversized images that aren't optimized or lazy-loaded, expensive computations or re-renders happening on every render without memoization, render-blocking resources, a bundle bloated by an unnecessarily large dependency for something simple. Prefer changes you can point to a concrete mechanism for ("this re-renders the whole list on every keystroke because the filter isn't memoized") over vague performance folklore.

**Accessibility** — non-semantic HTML where a semantic element would work (`<div onClick>` instead of `<button>`), missing alt text on meaningful images, form inputs without associated labels, insufficient color contrast against the project's own palette, interactive elements that aren't keyboard-reachable or lack visible focus states.

**Code quality** — duplicated logic that should be a shared component or hook, components that have grown large enough to be hard to follow and have a natural seam to split along, dead code or unused exports, inconsistent naming relative to the rest of the file/folder.

If a genuinely first-run project has issues so pervasive in one area that fixing all of them at once is actually the coherent unit of work (e.g., zero images anywhere have alt text), it's fine to do more in that one area — use judgment rather than a hard cap, but always stay within a change set the user can meaningfully review in one sitting.

## 4. Propose before applying

Once you've picked what's worth doing this run, show the user a clear summary before touching any files: what you found, why it matters (the concrete failure mode or cost, not just "best practice"), and what you'd change. Group by the four areas so it's easy to scan. Wait for approval before editing.

```
Frontend Polish — proposed changes for this run

Visual design
  - Card components use 3 different padding values (12px/16px/20px) across src/components/Card*.jsx — standardize on the 16px your Tailwind config already defines as `spacing.4`

Accessibility
  - Icon-only buttons in src/components/Toolbar.jsx have no aria-label — screen reader users hear nothing when tabbing to them

Performance
  - src/components/ProductList.jsx recalculates the filtered list on every render, including on unrelated state changes — wrap in useMemo keyed on the actual filter inputs

Code quality
  - No issues worth changing this run — reviewed and skipped (see log)

Apply these 3 changes?
```

If a category has nothing worth doing this run, say so plainly rather than forcing a filler suggestion just to have something under every heading.

## 5. Apply and update the log

Once approved, make the changes. Then update (or create) `.frontend-polish-log.md` with what this run covered — both what you changed and what you deliberately reviewed and decided not to touch, so future runs don't waste a pass re-checking the same ground:

```markdown
# Frontend Polish Log

## Run 3 — <describe what prompted this run if relevant>
- Visual design: standardized Card padding to 16px across 4 components
- Accessibility: added aria-labels to Toolbar icon buttons
- Performance: memoized ProductList filtering
- Code quality: reviewed, no changes needed this run

## Run 2
...
```

This log is the mechanism that makes "better every time" actually true instead of aspirational — it's what lets you tell, at the start of the next run, that visual design and accessibility already got attention and code quality hasn't been looked at yet.

## 6. Suggest a sanity check

After applying changes, mention that running an app health check (if the user has one set up — the `app-health-check` skill) or otherwise just starting the app is a good idea before considering this run done — a visual or performance change is occasionally a build-breaking change in disguise (a typo in a class name, a hook rule violation from a new `useMemo`), and it's better to catch that immediately than on the next unrelated run.
