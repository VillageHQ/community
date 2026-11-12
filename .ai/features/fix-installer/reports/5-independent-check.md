# Independent check (a separate agent that wrote none of the code)

Round 1, 2026-11-13. It re-ran the stubbed tests (ubuntu 24.04 and 22.04: 0 failures), reproduced each original
failure against the new installer and tried to break it, with its own scenario scripts on debian 12, ubuntu 24.04 and
22.04. All five items: PASS. Injection through `COMMUNITY_SERVER_IP` (`;id`, `$(touch …)`) is refused and never
reaches `.env`. A real `docker build --network host` worked on Docker Desktop's default builder.

| # | Found | Severity | Repair |
|---|---|---|---|
| 1 | On a real upgrade with a failed pull, "use a bigger server for the first install: press Ctrl+C" (a new server would be a new, empty community) | should-fix | Said only while setup isn't finished |
| 2 | Behind NAT with an old record, the advice no longer said to remove it (two records, the check fails forever); the NAT detour came before the record | should-fix | The record comes first; the NAT part says "If not, change or delete the record that points at …" |
| 3 | An upgrade whose build failed ended "up to date" (older bug) | should-fix | Ends "still runs the version you had" |
| 4 | A re-run of an unfinished first install said "Already set up", "already uses them", and would warn about a missing backup | nit | "An earlier run checked this"; no backup warning before setup |
| 5 | A real upgrade with Postgres stopped opened with "pick up where it stopped" | nit | Neutral wording: "found the settings from an earlier run" |
| 6 | A pre-mark `/swapfile`, switched off, was called "a file we didn't make" | nit | "isn't turned on, and we didn't mark it as ours" |
| 7 | `COMMUNITY_SERVER_IP` accepted `:`, `::::`, `999.1.1.1`; newline-separated values were dropped | nit | Stricter checks; newlines and tabs split like commas |
| 8 | Without the `ip` command, NAT detection is off (old advice) | nit | Left: every supported image ships `ip` (iproute2) |
| 9 | The README's NAT example left out the curl part and the domain | nit | Full command |

Re-check after the repair: the stubbed suite on all four images (972 checks, 0 failures) and the real-Docker case on
all four; new cases cover 1, 2, 3 and 7. Messages after the repair: `4-messages-after-fix.txt`.
