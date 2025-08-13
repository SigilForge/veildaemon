# Final release checklist (copy-paste, don’t improvise)

```powershell
# sync and sanity
git pull
python tools/gen_nav.py
python -m pip install -e .\veildaemon
python veildaemon\tests\test_imports.py
$env:VD_ENFORCE_ROOT_CLEAN="1"; pytest -q tests\test_root_clean.py

# lints (CI runs these too, but fail now not later)
python -m pip install ruff black isort
ruff check veildaemon
black --check veildaemon
isort --check-only veildaemon

# prove packs aren’t leaking
git ls-files streamdaemon StreamDaemon packs | sort

# commit any NAV/doc drift
git add -A
git commit -m "release: v0.0.3 docs/nav sync" || echo "no changes"

# tag + push
git tag -a v0.0.3 -m "VeilDaemon v0.0.3 — clean root, guards, entrypoints"
git push --tags
```

# Release notes (drop-in for GitHub)

```
## VeilDaemon v0.0.3

Boring on purpose. This tag makes the SDK stable for StreamDaemon and future clients.

### Highlights
- Clean root: runtime code moved into `veildaemon/` or `scripts/`; root guarded by test.
- Operational Guards documented (see ARCHITECTURE.md ▸ Operational Guards).
- Pre-commit: blocks `.trash/`, auto-formats staged SDK Python.
- CI: lint/format checks + whitespace/tab guard + root-clean enforcement.
- Entry points: `veildaemon-shell`, `veildaemon-chat`, plus `python -m veildaemon`.
- NAV auto-generated; README pointer to Operational Guards.
- StreamDaemon fenced: private by default; local shims allowed for smoke tests.

### Developer knobs
- Persona scene caps in `personas/<name>/scene_limits.yaml`
  - `cap_ms: { default: 1200, high_risk: 500, dead_air: 2000 }`
  - `deflect_max_words: 5`

### Breaking-ish
- Legacy root imports (`event_bus`, `stage_director`, `daemon_tts`) are deprecated; use `veildaemon.apps.*` / `veildaemon.tts.*`.
- Root shims are removed/ignored; your code should already use canonical imports.

### Housekeeping
- `.trash/` ignored and excluded from source dists.
- Tools/scripts guarded to not execute on import; pack smoke script provided.
```

# Post-tag smoke (two commands, then breathe)

```powershell
# install from tag in a fresh venv (paranoia pass)
python -m venv .venv-test
. .\.venv-test\Scripts\Activate.ps1
python -m pip install -e .\veildaemon
python -c "import veildaemon; print('ok', veildaemon.__version__ if hasattr(veildaemon,'__version__') else 'nover')"
```

# “Go Live” sanity ticks (last time)

* Cancel-by-ID preempts ≤150 ms on a forced raid beat.
* Mid-clause deflect fires at 60% budget with a 4–5 word quip.
* No speech while risk ≥ 0.45.
* `safe_mode_ratio < 0.2` during rehearsal.

You’ve got docs that point to the rules, NAV that actually lists them, CI that tattles, and a repo that won’t trip you up on stream day. Ship it and let the goblin talk; the scaffolding won’t collapse just because chat types “first.”
