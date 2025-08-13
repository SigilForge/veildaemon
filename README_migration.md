# VeilDaemon ↔ StreamDaemon monorepo split

This migration separates the core runtime (VeilDaemon) from the paid pack (StreamDaemon).

## New layout

- `veildaemon/` — core runtime & SDK (apps/, bus/, stage/, hrm/, safety/, voice/, memory/, overlay/, tools/, tests/)
- `streamdaemon/` — paid pack (personas/, scenes/, overlays/, plugins/, assets/, config/, docs/)
- `data/` — models, DBs, checkpoints
- `outputs/` — logs, run artifacts
- `scripts/` — launchers and setup scripts
- `migration/` — move plan and scripts

## How to apply

1. Commit your work-in-progress (clean tree).
2. Run one of:
   - Bash: `bash migration/apply_moves.sh`
   - PowerShell: `powershell -ExecutionPolicy Bypass -File migration/apply_moves.ps1`
3. Update imports (see Import Patch List below).
4. Install packages in editable mode:
   - `python -m pip install -e ./veildaemon`
   - `python -m pip install -e ./streamdaemon`
5. Quick smoke:
   - `python veildaemon/apps/orchestrator/main.py --dry-run`

Rollback at any time:

- Bash: `bash migration/rollback_moves.sh`
- PowerShell: `powershell -ExecutionPolicy Bypass -File migration/rollback_moves.ps1`

## Plugin hook

StreamDaemon exposes `streamdaemon.plugins.register(director, quip_bank)` for the core to load scenes and persona banks when present.

## Notes

- Windows/Linux friendly scripts; use `git mv` to preserve history.
- No deletions performed. Large artifacts are relocated under `/data` and `/outputs`.
- Ensure `.gitignore` excludes `/data` and `/outputs` if you don't want them tracked.
