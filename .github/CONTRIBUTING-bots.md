# Contributing rules for SigilForge bots

1. Work on a branch named `<bot-slug>/<topic>`. Never push to main. Never merge. Never touch PR #36.
2. Commit freely; Knox's merge is the approval.
3. Write the commit message to a file, then commit with it:
       printf '%s\n' 'docs(studio/press): add press kit v1' > /tmp/msg.txt
       git commit -F /tmp/msg.txt
   Never pass messages through nested `wsl -e bash -lc "..."` quoting; it cuts text at the colon.
4. Use Conventional Commits prefixes (https://www.conventionalcommits.org/en/v1.0.0/):
   feat, fix, docs, data, copy, chore, refactor. Scope is the folder, e.g. `docs(studio/conventions): ...`.
5. PR title uses the same format. Knox squash merges, so the PR title becomes the commit on main. Fix a bad title yourself with `gh pr edit <n> --title "..."`.
6. Fill every section of the PR template. Put the decision Knox needs at the top.
7. Add your `bot:` label and one `type:` label.
8. Private notes go in Cradlepoint-TTRPG under Studio/. Public copy goes in veildaemon. Tooling goes in VeilForge.
9. Use `git worktree add` from the existing repo, with sparse checkout of only your folder.
10. Post the PR link once in the room. Do not ask Knox in chat; the daily brief lists your PR.
