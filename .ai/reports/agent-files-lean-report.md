# Agent files — lean report (2026-11-10)

> ⚠ RECONSTRUCTED from code on 2026-11-10 by `autobuild onboard` — needs confirmation.

25 agent files, 320 lines, 3732 words. Claude Code loads the root files in every session and a
nested file when it works in that folder, so a rule repeated down the tree is read twice. Nothing here was changed: the lean
pass on the root AGENTS.md / CLAUDE.md is its own PR (test cases first, scored before and after, reviewed); the rest follow
one file at a time.

| File | Lines | Words | Repeated lines | Dead pointers | Unbacked claims |
|---|---|---|---|---|---|
| `src/modules/job-board/AGENTS.md` | 25 | 462 | 0 | 0 | 0 |
| `src/modules/intros/AGENTS.md` | 26 | 448 | 0 | 0 | 0 |
| `src/modules/asks/AGENTS.md` | 27 | 421 | 0 | 0 | 0 |
| `CLAUDE.md` | 39 | 388 | 0 | 2 | 2 |
| `src/modules/members/AGENTS.md` | 27 | 368 | 0 | 0 | 0 |
| `src/modules/chat/AGENTS.md` | 23 | 345 | 0 | 0 | 0 |
| `src/modules/network/AGENTS.md` | 23 | 330 | 0 | 0 | 0 |
| `src/modules/admin/AGENTS.md` | 20 | 245 | 0 | 0 | 0 |
| `src/AGENTS.md` | 25 | 222 | 1 | 0 | 0 |
| `src/modules/messages/AGENTS.md` | 18 | 150 | 0 | 0 | 0 |
| `src/modules/feed/AGENTS.md` | 17 | 145 | 0 | 0 | 0 |
| `src/modules/perks/AGENTS.md` | 15 | 130 | 0 | 0 | 0 |
| `scripts/AGENTS.md` | 11 | 66 | 1 | 0 | 0 |
| `scripts/CLAUDE.md` | 2 | 1 | 0 | 0 | 0 |
| `src/CLAUDE.md` | 2 | 1 | 0 | 0 | 0 |
| `src/modules/admin/CLAUDE.md` | 2 | 1 | 0 | 0 | 0 |
| `src/modules/asks/CLAUDE.md` | 2 | 1 | 0 | 0 | 0 |
| `src/modules/chat/CLAUDE.md` | 2 | 1 | 0 | 0 | 0 |
| `src/modules/feed/CLAUDE.md` | 2 | 1 | 0 | 0 | 0 |
| `src/modules/intros/CLAUDE.md` | 2 | 1 | 0 | 0 | 0 |
| `src/modules/job-board/CLAUDE.md` | 2 | 1 | 0 | 0 | 0 |
| `src/modules/members/CLAUDE.md` | 2 | 1 | 0 | 0 | 0 |
| `src/modules/messages/CLAUDE.md` | 2 | 1 | 0 | 0 | 0 |
| `src/modules/network/CLAUDE.md` | 2 | 1 | 0 | 0 | 0 |
| `src/modules/perks/CLAUDE.md` | 2 | 1 | 0 | 0 | 0 |

## Per file




### `CLAUDE.md`
- Dead pointers: backtick: .ai/tmp/ (line 9); backtick: .ai/logs/ (line 9)
- Claims the code doesn't back: `.ai/tmp/`, `.ai/logs/`






### `src/AGENTS.md`
- Repeats rules from: `CLAUDE.md` (1 line, e.g. "⚠ reconstructed from code on 2026-11-10 — needs confirmation")





### `scripts/AGENTS.md`
- Repeats rules from: `CLAUDE.md` (1 line, e.g. "⚠ reconstructed from code on 2026-11-10 — needs confirmation")













