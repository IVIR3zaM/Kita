# Kita weekly hours tracker
status: READY
created: 2026-10-05 · updated: 2026-10-05
goal: A dark, mobile-first static web app that tracks a child's weekly Kita hours against an allowance, with its Hetzner/Cloudflare deploy and project docs
verify: node --test
commit: per-node
push: per-node
budgets: 2 tries per brief · 2 replans per node
tier: M

## Intent

Goal: Parents open one page on their phone and, with a tap or two a day, log when their child was dropped off and picked up at the Kita. The page shows how much of the weekly allowance is used and suggests the remaining days' hours so the week stays within budget.

In scope: An inline settings strip (weekly allowance, opening hours, normal start) stored in IndexedDB behind one storage module; a Mon-Fri week view of the current ISO week with one bar per day across the opening hours, pre-filled from the settings; "now" drop-off and pick-up buttons for today and 5-minute steppers for any day; no-Kita days; a pure, test-first recalculation that spreads the remaining budget evenly in 5-minute steps over the remaining days, capped at closing time with warnings; a header with used vs allowed time and an over-limit warning; color-coded bar segments that tell actual from suggested time; prev/next week navigation over weeks stored per ISO week; German (default) and English, remembered per browser; a Terraform plus install.sh deploy to the existing Gateway VM modelled on Sonar's; AGENTS.md, CLAUDE.md and README.md.

Out of scope: Any backend or sync, accounts, more than one child, weekends, a light theme, PWA or offline install, CI pipelines, and actually running terraform or touching the VM.

Constraints: Vanilla HTML, CSS and ES modules with no build step and no npm dependencies; tests use Node 22's built-in `node --test`. Domain logic lives in pure modules written test-first, with `today` and `now` always passed in; DOM and IndexedDB are a thin shell. KISS and YAGNI. No real domain, token or secret enters the repo; terraform.tfvars is gitignored. LICENSE stays as it is and the planzilla block of AGENTS.md is kept unchanged. The confirmed Decisions below bind every node.

Definition of done: `node --test` is green; the app served by `python3 -m http.server` works in dark mode at 375px and on desktop and shows the worked example (Mon 08:00-13:40, Tue start 08:20 give Tue planned end 14:25 and Wed-Fri 08:00-14:05); `bash -n` passes on install.sh and `terraform fmt -check` passes where terraform is installed; AGENTS.md, CLAUDE.md and README.md are in place; a human approves the look at the final visual gate.

## Decisions

- D1 The plan only writes deploy files; no node runs terraform init, plan or apply, or opens SSH to the VM | confirmed
- D2 Opening hours are one open/close pair for all weekdays; times use the browser's local clock; the shell computes `today` (YYYY-MM-DD) and `now` and passes them into pure functions | confirmed
- D3 Push after each node's commit to origin, branch claude/nifty-shannon-yg96l1 (config push: per-node) | confirmed
- D4 Data model: all times are integer minutes since midnight; settings {allowanceMinutes 1800, openMinutes 420, closeMinutes 1020, normalStartMinutes 480}; week {key "YYYY-Www", allowanceMinutes, openMinutes, closeMinutes, days: 5 x {date, plannedStart, actualStart|null, actualEnd|null, noKita}} | confirmed
- D5 A weekday with no actual times that is not no-Kita stays a remaining day and gets a planned share even when it is in the past, so the budget function needs no `today` | confirmed
- D6 When a day's share does not fit before closing time, its end is capped and the day shows a warning; the lost minutes are not moved to other days | confirmed
- D7 The header's "used" time counts complete days only (actual start and end) | confirmed
- D8 Settings edits update the current week's record at once: allowance and opening hours fully, normal start only for days dated today or later; past weeks keep their snapshot; a week without a record is built from the current settings when shown and saved on its first edit | confirmed
- D9 Steppers and buttons: a start stepper on an unset start steps from the day's planned start; the end stepper is disabled until the day has an actual start and steps from the planned end when unset; end never goes below start; "now" rounds to the nearest 5 minutes; each day has a "clear" that removes its actual times | confirmed
- D10 Each day row shows its bar and times; tapping a row expands its controls (steppers, no-Kita, clear); today's row is expanded by default and the drop-off/pick-up "now" buttons sit above the week | confirmed
- D11 Week navigation goes back without limit; "next" stops at the current week; past weeks stay editable | confirmed
- D12 Layout: index.html and styles.css at the repo root; pure modules in src/domain/; src/i18n.js, src/storage.js (IndexedDB, also holds the language), src/app.js and src/ui/; tests in test/*.test.js; no package.json, since Node 22 detects ES module syntax | confirmed
- D13 Colors: open-unused dim slate, no-Kita a muted red hatch over the whole bar, actual solid teal, planned amber with diagonal stripes so it differs by pattern too; a legend under the week | confirmed
- D14 nginx serves the checkout /opt/kita with an allow-list (/, /index.html, /styles.css, /src/), 404 for everything else and Cache-Control no-cache; install.sh runs as root with no service user, cert in /etc/kita/tls | confirmed
- D15 N09 is a live human visual gate after the N08 acceptance check | confirmed

## Graph

| id | title | type | deps | model | try | rp | status | note |
|----|-------|------|------|-------|-----|----|--------|------|
| N01 | preflight | check | - | -/- | 0 | 0 | TODO | |
| N02 | time and week domain | exec | N01 | sonnet/sonnet | 0 | 0 | TODO | |
| N03 | budget recalculation rule | exec | N01 | opus/sonnet | 0 | 0 | TODO | |
| N04 | i18n and storage modules | exec | N01 | sonnet/sonnet | 0 | 0 | TODO | |
| N05 | deploy to the Gateway VM | exec | N01 | sonnet/sonnet | 0 | 0 | TODO | |
| N06 | app shell and week view | exec | N02,N03,N04 | opus/sonnet | 0 | 0 | TODO | |
| N07 | project docs | exec | N05,N06 | sonnet/sonnet | 0 | 0 | TODO | |
| N08 | plan acceptance | check | N07 | -/sonnet | 0 | 0 | TODO | |
| N09 | visual gate | gate | N08 | -/- | 0 | 0 | TODO | |

## N01 preflight
Do: Confirm the starting point before any work: verify passes on the untouched tree, Node is 22, the push
remote accepts this branch, a local static server and a browser for the visual checks exist, the public repo
that install.sh will clone answers, and the read-only Sonar deploy reference is present. terraform is not
installed here; later nodes skip `terraform fmt` when it is missing (D1), so it is not checked.
Done when:
- C1 [cmd] `node --test`
- C2 [cmd] `node --version | grep -q '^v22\.'`
- C3 [cmd] `git push --dry-run origin HEAD`
- C4 [cmd] `python3 -m http.server 8099 --bind 127.0.0.1 >/dev/null 2>&1 & p=$!; sleep 1; curl -sf -o /dev/null http://127.0.0.1:8099/; r=$?; kill $p; exit $r`
- C5 [cmd] `test -x /opt/pw-browsers/chromium-1194/chrome-linux/chrome`
- C6 [cmd] `git ls-remote https://github.com/IVIR3zaM/Kita HEAD`
- C7 [cmd] `test -f /home/user/ivir3zam/sonar/deploy/terraform/files/install.sh && command -v bash`

## N02 time and week domain
Do: Add two pure ES modules, test-first. src/domain/time.js: parse "HH:MM" to minutes, format minutes to
"HH:MM", round minutes to the nearest 5, and step a time by +/-5 clamped to 00:00..23:55. src/domain/week.js:
ISO week key ("YYYY-Www") of a date, the Mon-Fri dates of a key, shift a key by +/-1 week, compare keys,
create a week from settings, apply settings to a week given `today`, set or clear a day's actual start/end,
and toggle a day's no-Kita flag. All functions take dates as "YYYY-MM-DD" strings and return new objects.
Context: D2 local time; `today` and `now` are parameters, never `new Date()` or `Date.now()` inside src/domain.
  D4 shapes: settings {allowanceMinutes, openMinutes, closeMinutes, normalStartMinutes}; week {key,
  allowanceMinutes, openMinutes, closeMinutes, days: 5 x {date, plannedStart, actualStart|null,
  actualEnd|null, noKita}}; a new week gets plannedStart = normalStartMinutes and null actuals.
  D8 applying settings copies allowance and opening hours, and sets plannedStart only on days dated >= today.
  D9 setting an end below the day's start clamps it to the start.
  D12 no package.json; tests import ../src/domain/*.js with relative paths and use node:test, node:assert.
Read: `.plan/config.md`
Write: `src/domain/time.js`, `src/domain/week.js`, `test/time.test.js`, `test/week.test.js`
Test first: 2026-10-05 is key 2026-W41 with Mon 2026-10-05..Fri 2026-10-09; 2027-01-01 is 2026-W53; shifting
  2026-W01 back gives 2025-W52; "13:42" rounds to 13:40 and 13:43 to 13:45; applying normalStart 09:00 on
  Wednesday changes Wed-Fri plannedStart only.
Done when:
- C1 [cmd] `node --test test/time.test.js test/week.test.js`
- C2 [cmd] `! grep -rnE 'new Date\(\)|Date\.now' src/domain`
- C3 [review] week.js covers key, dates, shift, compare, create, apply-settings (D8), set/clear actuals with
  the end clamp (D9) and no-Kita toggle, each with a test; no function mutates its input.
- C4 [cmd] `node --test`

## N03 budget recalculation rule
Do: Add src/domain/budget.js, test-first, with one pure function `planWeek(week)` that returns, per day, the
shown start and end, a kind (complete, started, planned or noKita) and a capped flag, plus totals: used
minutes (D7), planned minutes, and the flags overAllowance and overClosing.
Context: D4 week shape {allowanceMinutes, openMinutes, closeMinutes, days: 5 x {date, plannedStart,
  actualStart|null, actualEnd|null, noKita}}, all minutes since midnight. The rule: a day is complete when it
  has actual start and end and is not noKita. remaining = allowance - sum of complete days' minutes. Remaining
  days are those neither noKita nor complete. Split max(0, remaining) evenly over them, floored to 5-minute
  steps; leftover 5-minute steps go one each to the earliest remaining days, so the sum never exceeds the
  budget. A started day (start, no end) ends at actualStart + share; a planned day runs plannedStart + share.
  D5 past unlogged days are ordinary remaining days; the function takes no `today`.
  D6 an end past closeMinutes is cut to closeMinutes and flagged capped; nothing is redistributed.
  overAllowance: used + planned > allowance. overClosing: any capped day or any complete day ending after close.
  noKita days ignore any stored actual times.
Write: `src/domain/budget.js`, `test/budget.test.js`
Test first: the worked example, allowance 1800 with Mon 08:00-13:40 complete and Tue actual start 08:20, gives
  Tue 08:20-14:25 started and Wed-Fri 08:00-14:05 planned, used 340; plus: 30h from 08:00 with no actuals gives
  08:00-14:00 on all five days; leftover steps go to the earliest days; a noKita day raises the others' share;
  a share past 17:00 is capped and flagged; actuals above the allowance give share 0 and overAllowance.
Done when:
- C1 [cmd] `node --test test/budget.test.js`
- C2 [review] test/budget.test.js has a test named for the worked example asserting exactly Tue end 14:25 and
  Wed-Fri 08:00-14:05, and tests for each other case in Test first.
- C3 [review] budget.js is pure (no Date, no DOM, no input mutation) and its leftover rule never makes the
  planned total exceed max(0, remaining).
- C4 [cmd] `node --test`

## N04 i18n and storage modules
Do: Add src/i18n.js, a pure module holding the German and English strings for every label, button, warning
and weekday the UI shows, and a `t(lang, key, params)` lookup with {name} interpolation, defaulting to German.
Add src/storage.js, the only module that touches IndexedDB: one database "kita" with stores for settings
(also the chosen language) and weeks keyed by ISO week key, exposing async loadSettings, saveSettings,
loadWeek, saveWeek, loadLang and saveLang, so a backend can replace it later.
Context: D4 settings defaults {allowanceMinutes 1800, openMinutes 420, closeMinutes 1020, normalStartMinutes
  480}; week records keyed "YYYY-Www". D12 the language lives in IndexedDB through storage.js; supported
  languages are "de" and "en". storage.js is a thin browser shell and gets no node test; keep it free of
  domain logic. Keys the UI will need: app title, settings labels, used-of-allowance header, over-limit and
  closing-time warnings, drop-off now, pick-up now, no-Kita, clear, prev/next week, week label, legend items
  (unused, no-Kita, actual, planned) and Mon-Fri names.
Write: `src/i18n.js`, `src/storage.js`, `test/i18n.test.js`
Test first: German and English have identical key sets; an unknown language falls back to German; {name}
  placeholders are filled; every weekday has a name in both languages.
Done when:
- C1 [cmd] `node --test test/i18n.test.js`
- C2 [review] storage.js exposes exactly the six async functions above, opens one "kita" database, and holds
  no domain logic; i18n.js imports nothing from the DOM or storage.
- C3 [cmd] `node --test`

## N05 deploy to the Gateway VM
Do: Add deploy/ modelled on Sonar's (read-only reference): terraform that looks up the existing Gateway VM by
label selector without managing it, adds a proxied Cloudflare A record for `var.kita_hostname`, and over SSH
copies and runs files/install.sh. install.sh (args REPO_URL GIT_REF HOSTNAME) installs git, nginx and openssl,
clones or fetches github.com/IVIR3zaM/Kita into /opt/kita, checks out the full SHA detached, makes a
self-signed origin cert once, installs the nginx conf.d server block, checks nginx loads it, reloads nginx
and curls the site locally. No systemd unit, no volume, no random provider. Add deploy/README.md,
terraform.tfvars.example with placeholder values only, and gitignore entries for tfvars and state.
Context: D1 nothing is applied or run against the VM. D14 nginx root /opt/kita, allow-list /, /index.html,
  /styles.css, /src/, everything else 404, Cache-Control no-cache; cert /etc/kita/tls; root, no service user.
  Reference: lookup and postcondition main.tf:10-19, DNS record main.tf:81-88, SSH install main.tf:90-138,
  variables incl. SHA validation variables.tf, providers versions.tf:1-18, install.sh:68-107, server block
  sonar.conf.tftpl:1-18, conf.d include README.md:72-82 (paths under /home/user/ivir3zam/sonar/deploy/).
  kita_git_ref must be a 40-char lowercase SHA. deploy/README.md must say that `terraform validate` was not run
  and must be run (`terraform init && terraform validate`) before the first apply if the registry is
  unreachable; use example.com placeholders only.
Read: `/home/user/ivir3zam/sonar/deploy/README.md`, `/home/user/ivir3zam/sonar/deploy/terraform/`
Write: `deploy/**`, `.gitignore`
Test first: -
Done when:
- C1 [cmd] `bash -n deploy/terraform/files/install.sh`
- C2 [cmd] `if command -v terraform >/dev/null 2>&1; then terraform -chdir=deploy/terraform fmt -check -recursive; else echo "terraform not installed: fmt skipped"; fi`
- C3 [cmd] `git check-ignore -q deploy/terraform/terraform.tfvars && git check-ignore -q deploy/terraform/x.tfstate`
- C4 [cmd] `! grep -rniE 'systemd|hcloud_volume|random_password' deploy/terraform`
- C5 [review] main.tf only reads the server (data source with a one-match postcondition), the A record is
  proxied, install.sh is idempotent with `set -euo pipefail`, the conf has the D14 allow-list, and no real
  domain, token or secret appears anywhere under deploy/.
- C6 [cmd] `node --test`

## N06 app shell and week view
Do: Build the page: index.html (dark, mobile-first, loads src/app.js as a module), styles.css, src/ui/view.js
(pure: settings, week, planWeek result, `today` and `now` in, a view model out, including bar segments as
percent offsets across the opening hours) and src/app.js (the thin shell: storage, events, rendering, and the
only place that reads the clock). Header: language toggle, used vs allowance, over-limit warning. Then the
inline settings, the "now" buttons, prev/next week, the five day rows with bars and controls, and a legend.
Context: Use src/domain/time.js, week.js, budget.js (`planWeek`), src/i18n.js and src/storage.js as built.
  D4 times in minutes. D7 header shows used = complete days. D8 settings edits update the current week
  (normal start only for days >= today); a missing week is built from settings and saved on first edit.
  D9 start stepper steps from planned start when unset; end stepper disabled until there is an actual start;
  end never below start; "now" rounds to the nearest 5 and applies to today only (hidden on weekends);
  per-day clear. D10 tap a row to expand its controls, today expanded, "now" buttons above the week.
  D11 next stops at the current week. D13 colors and the stripe pattern for planned; legend. Capped days
  and the over-limit state show visible warnings. German by default.
Read: `src/domain/budget.js`, `src/domain/week.js`, `src/i18n.js`, `src/storage.js`
Write: `index.html`, `styles.css`, `src/app.js`, `src/ui/**`, `test/view.test.js`
Test first: view.js maps the worked example's planWeek output to segments: Mon one actual segment
  08:00-13:40, Tue an actual start with a planned segment to 14:25, Wed-Fri planned 08:00-14:05, each as the
  right percent of 07:00-17:00; a noKita day yields one whole-bar noKita segment.
Done when:
- C1 [cmd] `node --test test/view.test.js`
- C2 [visual] At 375px, a fresh profile shows German, dark, no horizontal scroll, settings 30h, 07:00-17:00,
  08:00, and all five days planned 08:00-14:00; after setting Mon 08:00-13:40 and Tue start 08:20 by steppers,
  Tue shows planned end 14:25 and Wed-Fri 08:00-14:05, with actual and planned visibly different.
- C3 [visual] Marking Wed no-Kita shades its whole bar and raises the other remaining days; switching to
  English and reloading keeps English and the entered times; prev week shows an empty week, next returns.
- C4 [review] Only src/app.js reads the clock or calls storage; view.js is pure.
- C5 [cmd] `node --test`

## N07 project docs
Do: Make AGENTS.md the single source of truth: what the app is, setup, run (`python3 -m http.server`), test
(`node --test`, Node 22) and deploy pointer, the file layout as it now exists, and the engineering rules
(strict TDD, KISS, YAGNI, pure functional core with `today`/`now` passed in, DOM and IndexedDB as a thin
shell behind src/storage.js, no npm dependencies, no build step). Keep the planzilla block byte for byte.
CLAUDE.md is the single line `@AGENTS.md`. README.md for humans: what it is, run locally, test, deploy
pointer to deploy/README.md, license Apache-2.0. Do not touch LICENSE.
Context: D12 layout; D1 deploy is documented, never run. Read the tree with `git ls-files` to describe it.
Read: `AGENTS.md`, `deploy/README.md`
Write: `AGENTS.md`, `CLAUDE.md`, `README.md`
Test first: -
Done when:
- C1 [cmd] `test "$(cat CLAUDE.md)" = "@AGENTS.md"`
- C2 [cmd] `test "$(git show 4b40306:AGENTS.md | sed -n '/planzilla:begin/,/planzilla:end/p')" = "$(sed -n '/planzilla:begin/,/planzilla:end/p' AGENTS.md)"`
- C3 [cmd] `git diff --quiet 4b40306 -- LICENSE && grep -q 'Apache' README.md && grep -q 'deploy/README.md' README.md`
- C4 [review] AGENTS.md lists every top-level path and src/ module that exists and states each rule named in Do.
- C5 [cmd] `node --test`

## N08 plan acceptance
Do: Check the whole plan against its Definition of done on the final tree.
Done when:
- C1 [cmd] `node --test`
- C2 [cmd] `bash -n deploy/terraform/files/install.sh && if command -v terraform >/dev/null 2>&1; then terraform -chdir=deploy/terraform fmt -check -recursive; else echo "terraform not installed: fmt skipped"; fi`
- C3 [cmd] `test ! -e package.json && test ! -e node_modules && ! grep -rnE "from ['\"][^./]" src`
- C4 [cmd] `python3 -m http.server 8098 --bind 127.0.0.1 >/dev/null 2>&1 & p=$!; sleep 1; curl -sf http://127.0.0.1:8098/ | grep -q 'type="module"' && curl -sf -o /dev/null http://127.0.0.1:8098/src/app.js; r=$?; kill $p; exit $r`
- C5 [visual] At 375px and at 1280px, dark by default and German: with Mon 08:00-13:40 and Tue start 08:20,
  Tue planned end reads 14:25 and Wed-Fri 08:00-14:05; actual and planned segments differ in color and pattern;
  the header shows 5 h 40 min used of the 30 h allowance (any clear h:mm wording); nothing overflows sideways.
- C6 [visual] Raising Fri's share past closing (e.g. Wed and Thu no-Kita) shows a capped-day warning and the
  over-limit warning; the legend names all four segment types.
- C7 [review] AGENTS.md, CLAUDE.md, README.md and deploy/README.md agree with the tree and with D1-D15.

## N09 visual gate
Do: The user looks at the running app (`python3 -m http.server 8080 --bind 127.0.0.1`, then
http://127.0.0.1:8080) on a phone-sized window and on desktop and approves or lists defects (D15).
Done when:
- C1 [human] The look and feel at 375px and desktop is approved: colors, legend, tap targets and the
  expand-row controls (D10, D13) are fine to ship.

## Log
