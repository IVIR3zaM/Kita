# Planzilla config (FORMAT §8). A missing key takes its default; a plan's header wins over this file.
# Engineering rules (TDD, KISS, YAGNI, layout) live in AGENTS.md, not here.

verify: node --test
verify_fast: node --test
commit: per-node
push: per-node
retention: keep
visual_recipe: python3 -m http.server 8080 --bind 127.0.0.1 from the repo root in the background, then open http://127.0.0.1:8080 and check every changed view at 375px and desktop (dark is the default theme)
models: planner=opus, exec=sonnet, verify=sonnet
preauthorized: start a local static server for smoke runs and visual checks
always_review: no
