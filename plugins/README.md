Plugins
=======

- personas/ — text persona definitions (hot-swappable). Place .txt persona files here. The selector UIs load from this folder.

Notes
-----

- packs/ remains for logic/AR packs (YAML). meltdown_core.yaml is a logic pack, not a persona.
- Existing code still writes the active persona to current_persona.txt. Selectors now copy from plugins/personas.
