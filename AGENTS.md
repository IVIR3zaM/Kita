# Kita

Kita is a small weekly hours tracker for a daycare (Kita) allowance. It is a static, offline-first web app
with a German (default) and English UI. A week holds a minute allowance (settings: allowance, opening time,
closing time, usual drop-off time); each day has a planned or actual drop-off and pick-up, or is marked
"no Kita". The app recalculates the remaining budget for the week (a day never runs past closing time; the rest
goes to the other days), warns when the allowance is exceeded and shows how much would stay unused. Settings,
language and weeks are stored in the browser's IndexedDB.

This file is the single source of truth for the project; `CLAUDE.md` only imports it, and `README.md` is for
humans.

## Setup, run, test, deploy

- Setup: nothing to install. There are no npm dependencies and no build step. Node 22 is needed only to run
  the tests.
- Run: `python3 -m http.server`, then open http://localhost:8000/. Any static file server works; ES modules
  need http, not `file://`.
- Test: `node --test` (Node 22, built-in test runner, runs `test/*.test.js`).
- Deploy: Terraform and nginx on the Gateway VM; see `deploy/README.md`. CI (`.github/workflows/ci.yml`)
  deploys `main`. Deploying is documented, never run by agents.

## File layout

- `index.html`: the single page; loads `src/app.js` as an ES module.
- `styles.css`: all styles.
- `icons/`: `icon.svg` (favicon, the source) and `apple-touch-icon.png` (180×180, rendered from it with
  `rsvg-convert -w 180 -h 180 icons/icon.svg -o icons/apple-touch-icon.png`).
- `src/app.js`: the thin shell. Wires storage, events and rendering; the only module that reads the clock.
- `src/storage.js`: the only module that touches IndexedDB (settings, language, weeks). No domain logic.
- `src/i18n.js`: pure string tables (`de`, `en`) and lookup.
- `src/domain/time.js`: pure parsing, formatting, rounding and stepping of times in minutes.
- `src/domain/week.js`: pure week keys, week navigation, week creation and edits (settings, actual start/end,
  no-Kita toggle).
- `src/domain/budget.js`: pure weekly budget recalculation (`planWeek`).
- `src/ui/view.js`: pure view model (settings, week, plan, today and now in; plain data out). No DOM.
- `test/`: `node --test` tests, one file per pure module: `budget`, `i18n`, `time`, `view`, `week`.
- `deploy/`: `README.md` and `terraform/` (Gateway VM deploy; `files/install.sh`, `templates/kita.conf.tftpl`,
  `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf`, `backend.hcl.example`, `terraform.tfvars.example`).
- `.github/workflows/ci.yml`: workflow `CI`: `node --test` on every push and pull request; deploys `main` with
  Terraform on the R2 backend.
- `.plan/`, `.planzilla/`, `.agents/`, `.claude/`: Planzilla plans and vendored tooling (see below).
- `.gitignore`: ignores Terraform state, variable files, backend config and local `.terraform/` data.
- `LICENSE`: Apache-2.0. Do not edit it.
- `AGENTS.md`, `CLAUDE.md`, `README.md`: project docs.

## Engineering rules

- Strict TDD: write the failing test first, see it fail, write the minimal code to pass, refactor, rerun.
- KISS and YAGNI: the simplest thing that works; nothing for a future that is not asked for.
- Pure functional core: `src/domain/`, `src/i18n.js` and `src/ui/view.js` are pure. They never read the
  clock, the DOM or storage, and never mutate their input. `today` and `now` are passed in as arguments;
  only `src/app.js` reads the clock.
- Thin shell: the DOM (`src/app.js`, `index.html`) and IndexedDB (only behind `src/storage.js`) hold no
  domain logic. Nothing else touches IndexedDB.
- No npm dependencies and no build step. The browser loads the source files as they are.
- Tests cover the pure core; the shell stays too thin to need its own.

<!-- planzilla:begin -->
## Planzilla

This repo plans its work with Planzilla. Plans live in `.plan/`.

- Never read or edit plan state by hand. Use only the CLI `.planzilla/plz`; `.planzilla/plz --help` lists the commands.
- To plan a task, follow the skill `plz-new-plan`: `.agents/skills/plz-new-plan/SKILL.md`.
- To run a plan, follow the skill `plz-run-plan`: `.agents/skills/plz-run-plan/SKILL.md`.
- The same skills are in `.claude/skills/`.
- Subagents follow the role prompt for their job:
  - `.planzilla/roles/planner.md`
  - `.planzilla/roles/executor.md`
  - `.planzilla/roles/verifier.md`
  - `.planzilla/roles/visual.md`
- `.planzilla/` is vendored. Never edit it; upgrade by re-running `planzilla install`.
<!-- planzilla:end -->
