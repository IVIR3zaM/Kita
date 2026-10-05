# Kita

A small weekly hours tracker for a daycare (Kita) allowance. Plan each day's drop-off and pick-up, record the
actual times, and see how much of the weekly allowance is left. The interface is German by default, with
English available. Data stays in your browser (IndexedDB).

It is a static site: plain HTML, CSS and ES modules, with no npm dependencies and no build step.

## Run locally

```bash
python3 -m http.server
```

Then open http://localhost:8000/.

## Test

Needs Node 22.

```bash
node --test
```

## Deploy

See [deploy/README.md](deploy/README.md). A GitHub Actions workflow (`.github/workflows/ci.yml`) tests every
push and deploys `main`.

## Contributing

Project structure and engineering rules are in [AGENTS.md](AGENTS.md).

## License

Apache-2.0. See [LICENSE](LICENSE).
