# Dev tools (not shipped with the bot)

These helper scripts are for local data collection and experimentation only. They are not part of the shipping bot and can be excluded from packaging.

- auto_train_loop.py — unattended workday loop (discover → watch → seed → mine → optional train)
- twitch_multi_watcher.py — multi-channel Twitch chat watcher/rotator (Helix discovery)
- twitch_chat_watcher.py — simple single-channel watcher
- twitch_vtt_watcher.py — polls WebVTT caption URLs
- merge_chat_and_captions.py — merges chat with caption context
- twitch_to_shadow.py — converts twitch_multi_chat_log.json to hrm_shadow_log.json entries
- hrm_shadow_miner.py — mines hrm_shadow_log.json into hrm_training_examples.yaml
- hrm_shadow_bootstrap.py — seeds shadow log with synthetic examples
- discover_captioned_channels.py — lists streams advertising captions via tags; emits VTT map candidates
- hrm_core/dataset/build_text_dataset.py — converts hrm_training_examples.yaml into an HRM-compatible byte-level dataset

Notes

- These scripts expect credentials to come from secrets_store.py and/or environment variables.
- Twitch OAuth tokens (twitch.access.token, twitch.refresh.token) are for the bot reading/rotating on the Knoxmortis account. The SigilForge broadcast Stream Key (twitch.stream.key) is unrelated to API/IRC.

Text dataset builder

- Input: hrm_training_examples.yaml from hrm_shadow_miner.py (list under key training_examples with fields input and desired_reply)
- Output: data/text-sft-512/ with train/test splits in HRM format (inputs.npy, labels.npy, puzzle_identifiers.npy, puzzle_indices.npy, group_indices.npy, dataset.json)
- Run:
	- python -m hrm_core.dataset.build_text_dataset --source hrm_training_examples.yaml --output-dir data/text-sft-512 --seq-len 512
	- Requires hrm_core requirements (see hrm_core/requirements.txt)
