# How the installer fixes work

All in `install.sh`; cases in `deploy/vps/test-installer.sh` (Docker containers with stubs on PATH).

- **Build output and its cause.** `build_from_source` runs `docker build --network host … >>install.log 2>&1`,
  remembers how many lines the log had before, and on failure prints the build's last 15 lines.
  `build_failure_advice` blames memory only when `/proc/vmstat`'s `oom_kill` count went up during the build, or the
  output shows `exit code: 137`, `Killed`, a heap limit or `ENOMEM`; it names a DNS failure on `EAI_AGAIN`,
  `ENOTFOUND`, `getaddrinfo` and the like; otherwise it asks for those lines. A first install stops (friendly, no
  "stopped unexpectedly"); an upgrade keeps the running version.
- **Build resolver.** `--network host` gives the build the server's own network and `/etc/resolv.conf`. BuildKit copies
  an IPv6-only resolver (Fly's `fdaa::3`) into an IPv4-only build network, where lookups fail; `docker run` falls back
  to 8.8.8.8, builds don't.
- **Swap.** `has_active_swap` reads `/proc/swaps` (variable `swaps_file`, so tests can fake it) and also asks
  `swapon --show`. A `/swapfile` the installer creates gets a mark, `/opt/community/.swapfile-made-by-installer`,
  written before the file. Without the mark an existing `/swapfile` is left alone (a warning). When turning swap on
  fails, `remove_own_swap_file` runs `swapoff`, removes the file and its fstab line and the mark, each step allowed to
  fail. `main` calls `ensure_swap || warn …`, so nothing in the step can stop the run. Servers installed before the
  mark existed have their swap active, so they never reach the removal.
- **First install vs upgrade.** `is_upgrade` still means "settings exist" (keep `.env`, skip the DNS and port checks,
  back up first). `is_setup_finished` asks Postgres for `instance_settings.first_admin_user_id` (the claim
  `claimFirstAdmin` writes on `/setup`); any failure counts as not finished. `print_summary` shows the upgrade summary
  only when settings exist and setup is finished; otherwise the setup token and the `/setup` steps.
- **DNS.** `COMMUNITY_SERVER_IP` is split on commas and spaces, lowercased, and each entry must be IPv4 or IPv6
  (`read_server_ip_setting`). `is_behind_nat`: none of the detected outgoing addresses is on a local interface (`ip`),
  and neither `COMMUNITY_SERVER_IP` nor `COMMUNITY_BIND_ADDRESS` is set. Then `explain_nat` says the record may be right
  and prints the command with `COMMUNITY_SERVER_IP=<the domain's addresses>`, and "Change or delete that old record"
  is not said.
- **No ready-made image.** The image source and visibility are unchanged. The pull-failure message gives the times from
  the Fly test (about 3 minutes on 4 GB with 2 dedicated processors, 30+ minutes on 2 GB shared) and suggests a bigger
  server for the first install.
- **Running the tests on Windows.** The checkout has CRLF endings, which bash in the containers can't run; copy
  `install.sh` and `deploy/` with LF endings first (`sed -i 's/\r$//'`) and mount that copy as `/source`.
