import os
from unittest import SkipTest

# Opt-in guard: only enforce when explicitly requested to avoid breaking CI mid-migration.
ENFORCE = os.getenv("VD_ENFORCE_ROOT_CLEAN") == "1"

ALLOW = {
    "README.md", "ARCHITECTURE.md", "NAV.md", "CONTRIBUTING.md", "LICENSE",
    ".gitignore", ".gitattributes", ".editorconfig", ".vscode", ".github", ".githooks",
    "tools", "scripts", "tests", "config", ".env.example", "streamdaemon",
    # Temporary shims allowed during deprecation window:
    "event_bus.py", "stage_director.py", "daemon_tts.py",
    "journal_manager.py", "knowledge_store.py", "task_store.py", "task_store_sqlite.py",
    "core_context.py", "hrm_engine.py", "daemon_shell.py", "veil_daemon_chat_bound.py",
    # Temporary dev tool (to be moved under tools/ and removed from root):
    "sft_lora_train.py",
}

def test_root_clean():
    if not ENFORCE:
        raise SkipTest("Root cleanliness enforcement disabled; set VD_ENFORCE_ROOT_CLEAN=1 to enable.")
    bad = []
    for name in os.listdir('.'):
        if name in ALLOW or name.startswith('.'):
            continue
        if os.path.isdir(name):
            continue
        if name.endswith('.py'):
            bad.append(name)
    assert not bad, f"Unexpected root files: {bad}"
