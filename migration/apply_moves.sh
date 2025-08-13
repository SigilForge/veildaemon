#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PLAN="migration/move_plan.json"

ensure_dir() { mkdir -p "$1"; }

if command -v jq >/dev/null 2>&1; then
  echo "Applying move plan using jq..."
  jq -r '.[] | [.src, .dst] | @tsv' "$PLAN" | while IFS=$'\t' read -r SRC DST; do
    echo "-- $SRC -> $DST"
    ensure_dir "$(dirname "$DST")"
    git mv -v -- "$SRC" "$DST"
  done
else
  echo "jq not found; using embedded plan fallback."
  # Fallback: embed the same pairs here to avoid jq dependency
  while IFS= read -r line; do
    SRC="${line%%=>*}"; DST="${line##*=>}"
    [ -z "$SRC" ] && continue
    echo "-- $SRC -> $DST"
    ensure_dir "$(dirname "$DST")"
    git mv -v -- "$SRC" "$DST"
  done <<'EOF'
StreamDaemon/event_bus.py=>veildaemon/apps/bus/event_bus.py
StreamDaemon/event_routes.yaml=>veildaemon/apps/bus/event_routes.yaml
StreamDaemon/stage_director.py=>veildaemon/apps/stage/stage_director.py
StreamDaemon/state_engine.py=>veildaemon/apps/stage/state_engine.py
StreamDaemon/stream_convo_engine.py=>veildaemon/apps/stage/stream_convo_engine.py
StreamDaemon/game_agent.py=>veildaemon/apps/stage/game_agent.py
StreamDaemon/game_controller.py=>veildaemon/apps/stage/game_controller.py
StreamDaemon/overlay_server.py=>veildaemon/apps/overlay/overlay_server.py
captioned_channels.json=>veildaemon/apps/overlay/captioned_channels.json
StreamDaemon/asr_watcher.py=>veildaemon/apps/watchers/asr_watcher.py
StreamDaemon/vision_watcher.py=>veildaemon/apps/watchers/vision_watcher.py
StreamDaemon/audio_router.py=>veildaemon/apps/watchers/audio_router.py
twitch_vtt_watcher.py=>veildaemon/apps/watchers/twitch_vtt_watcher.py
twitch_chat_watcher.py=>veildaemon/apps/watchers/twitch_chat_watcher.py
twitch_multi_watcher.py=>veildaemon/apps/watchers/twitch_multi_watcher.py
StreamDaemon/api_sniffer.py=>veildaemon/apps/api/api_sniffer.py
wick_api_adapter.py=>veildaemon/apps/api/wick_api_adapter.py
StreamDaemon/fetch_piper_voice.py=>veildaemon/apps/api/fetch_piper_voice.py
tools/piper_fetch_voice.py=>veildaemon/apps/tools/piper_fetch_voice.py
twitch_auth.py=>veildaemon/apps/api/twitch_auth.py
twitch_to_shadow.py=>veildaemon/apps/api/twitch_to_shadow.py
twitch_refresh_exchange.py=>veildaemon/apps/api/twitch_refresh_exchange.py
discover_captioned_channels.py=>veildaemon/apps/tools/discover_captioned_channels.py
merge_chat_and_captions.py=>veildaemon/apps/tools/merge_chat_and_captions.py
StreamDaemon/safety/normalize.py=>veildaemon/apps/safety/normalize.py
StreamDaemon/safety/quip_bank.py=>veildaemon/apps/safety/quip_bank.py
StreamDaemon/safety/rewrite.py=>veildaemon/apps/safety/rewrite.py
StreamDaemon/safety/span_map.py=>veildaemon/apps/safety/span_map.py
StreamDaemon/license_gate.py=>veildaemon/apps/safety/license_gate.py
StreamDaemon/cooldowns.py=>veildaemon/apps/safety/cooldowns.py
secrets_check.py=>veildaemon/apps/safety/secrets_check.py
StreamDaemon/hrm_control_loop.py=>veildaemon/apps/hrm/hrm_control_loop.py
StreamDaemon/hrm_moderation.py=>veildaemon/apps/hrm/hrm_moderation.py
StreamDaemon/hrm_feedback.py=>veildaemon/apps/hrm/hrm_feedback.py
StreamDaemon/hrm_memory.py=>veildaemon/apps/hrm/hrm_memory.py
StreamDaemon/hrm_trainer.py=>veildaemon/apps/hrm/hrm_trainer.py
StreamDaemon/hrm_local_llm.py=>veildaemon/apps/hrm/hrm_local_llm.py
StreamDaemon/hrm_afk_trainer.py=>veildaemon/apps/hrm/hrm_afk_trainer.py
StreamDaemon/hrm_metrics.py=>veildaemon/apps/hrm/hrm_metrics.py
hrm_engine.py=>veildaemon/apps/hrm/hrm_engine.py
hrm_shadow_bootstrap.py=>veildaemon/apps/hrm/hrm_shadow_bootstrap.py
hrm_shadow_miner.py=>veildaemon/apps/hrm/hrm_shadow_miner.py
hrm_training_examples.yaml=>veildaemon/apps/hrm/examples/hrm_training_examples.yaml
hrm_training_examples.smoke.yaml=>veildaemon/apps/hrm/examples/hrm_training_examples.smoke.yaml
hrm_core=>veildaemon/apps/hrm/hrm_core
StreamDaemon/tts_budget.py=>veildaemon/apps/voice/tts_budget.py
StreamDaemon/tts_audition.py=>veildaemon/apps/voice/tts_audition.py
daemon_tts.py=>veildaemon/apps/voice/daemon_tts.py
edge_tts_test.py=>veildaemon/apps/voice/edge_tts_test.py
whisper_trigger.py=>veildaemon/apps/voice/whisper_trigger.py
StreamDaemon/audio_state.py=>veildaemon/apps/voice/audio_state.py
StreamDaemon/piper_models=>data/voice/piper_models
knowledge_store.py=>veildaemon/apps/memory/knowledge_store.py
journal_manager.py=>veildaemon/apps/memory/journal_manager.py
task_store.py=>veildaemon/apps/memory/task_store.py
task_store_sqlite.py=>veildaemon/apps/memory/task_store_sqlite.py
veil_daemon_chat_bound.py=>veildaemon/apps/orchestrator/main.py
daemon_brain.py=>veildaemon/apps/orchestrator/daemon_brain.py
daemon_shell.py=>veildaemon/apps/orchestrator/daemon_shell.py
core_context.py=>veildaemon/apps/orchestrator/core_context.py
VeilDaemon_Launcher.py=>veildaemon/apps/orchestrator/VeilDaemon_Launcher.py
StreamDaemon/streamdaemon_main.py=>streamdaemon/config/streamdaemon_main.py
StreamDaemon/streamdaemon_twitch.py=>streamdaemon/config/streamdaemon_twitch.py
packs/stream_avatar.yaml=>streamdaemon/scenes/stream_avatar.yaml
packs/meltdown_core.yaml=>streamdaemon/scenes/meltdown_core.yaml
StreamDaemon/plugins=>streamdaemon/plugins
StreamDaemon/personas=>streamdaemon/personas
persona_selector.py=>streamdaemon/personas/persona_selector.py
persona_selector_bound_voice.py=>streamdaemon/personas/persona_selector_bound_voice.py
pack_loader.py=>streamdaemon/plugins/pack_loader.py
packs_integration.py=>streamdaemon/plugins/packs_integration.py
plugins/README.md=>streamdaemon/docs/README.md
StreamDaemon/train.jsonl=>data/datasets/streamdaemon_train.jsonl
StreamDaemon/hrm_tasks.sqlite-wal=>data/db/hrm_tasks.sqlite-wal
StreamDaemon/hrm_tasks.sqlite-shm=>data/db/hrm_tasks.sqlite-shm
StreamDaemon/hrm_learned_rules.json=>data/hrm/hrm_learned_rules.json
twitch_multi_chat_log.json=>outputs/logs/twitch_multi_chat_log.json
hrm_shadow_log.json=>outputs/logs/hrm_shadow_log.json
checkpoints=>data/checkpoints
models=>data/models
model=>data/model
wandb=>outputs/wandb
migrate_secrets.py=>veildaemon/apps/tools/migrate_secrets.py
StreamDaemon/migrate_rules.py=>veildaemon/apps/tools/migrate_rules.py
run_veil.bat=>scripts/run_veil.bat
VeilDaemon_Launcher.bat=>scripts/VeilDaemon_Launcher.bat
setup_venv_311.bat=>scripts/setup_venv_311.bat
installer.bat=>scripts/installer.bat
stop_watchers.ps1=>scripts/stop_watchers.ps1
start_workday.bat=>scripts/start_workday.bat
workday_runner.ps1=>scripts/workday_runner.ps1
tests/smoke_hrm.py=>veildaemon/tests/smoke_hrm.py
EOF
fi

echo "Move plan applied. Review changes with 'git status'."
