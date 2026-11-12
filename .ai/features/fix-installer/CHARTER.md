# Charter: fix build, installer bugs from the real-machine test (`fix-installer`)

Approved scope: the orchestrator's brief of 2026-11-12 (`brief-fix-installer.md`), from the run of `install.sh` on a
rented Fly.io machine (`.workspace/scratch/founderhall-vs-community/installer-test-2026-11-12/report.md`). One cleanup
build (`fix-cleanup`) runs in parallel on app code and does not touch `install.sh` or `deploy/vps/`. One pull request;
the orchestrator merges it.

## Direction
1. **A failed build is always blamed on memory.** Keep the build output in `install.log`, print its last lines on
   failure, and say "out of memory" only when the build really died of memory (the kernel's OOM count went up, or the
   output shows a kill or a heap limit).
2. **A re-run crashes in the memory step.** Read active swap from `/proc/swaps` (Fly's `swapon` has no `--show`). Only
   touch a `/swapfile` the installer made (a mark file), turn it off before removing it, and never stop the run here.
3. **A first install that stops after step 8 counts as an upgrade forever.** "Set up" means the first admin exists
   (the app's `first_admin_user_id` claim). Until then a re-run keeps the saved settings but ends with the setup token
   and the "open /setup" steps.
4. **DNS behind NAT, a list of addresses, and the build's resolver.** When the server's outgoing address is not on
   any of its own network cards (NAT, as on Fly), the DNS advice says the record may be right and shows
   `COMMUNITY_SERVER_IP=<that address>`. `COMMUNITY_SERVER_IP` takes a list (commas or spaces, IPv4 and IPv6). The
   source build runs with `--network host`, so it uses the server's own resolver (an IPv6-only one included).
5. **The image source and its visibility stay as they are.** When the pull fails, the installer still builds from
   source and says plainly that this takes a long time on a small server, suggesting a bigger machine for the first
   install.

Out: publishing the image or changing its default, `docker builder prune` after a build, ufw on Fly, Fly's client IP
behind Caddy.

## Proof and tests
A failing case per item in `deploy/vps/test-installer.sh` first (Docker containers with stubs), then the fix; the
script passes on ubuntu 26.04, 24.04, 22.04 and debian 12. Typecheck, lint and the full suite on a throwaway Postgres.
A separate agent runs the installer cases again and tries to break them. Docs: the README's install section and the
VPS guide's troubleshooting.
