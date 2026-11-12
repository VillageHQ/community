---
id: fix-installer
status: in-progress
waits-on: []
touches: ["install.sh", "deploy/vps/test-installer.sh", "README.md", "docs/self-host-vps.md"]
---
# Fix build: installer bugs from the real-machine test (`fix-installer`)

What these fixes do now. Charter: [CHARTER.md](CHARTER.md).

- **Build failures:** the source build's output goes to `/opt/community/install.log`; on failure the installer prints
  its last lines and blames memory only when the build was killed for memory, or names a lookup failure.
- **Swap:** active swap is read from `/proc/swaps`; the installer only ever turns on, off or removes a `/swapfile` it
  made itself, and the memory step never stops the run.
- **First install vs upgrade:** a re-run before the first admin exists keeps the settings and still ends with the
  setup token and "open /setup".
- **DNS:** behind NAT the advice offers `COMMUNITY_SERVER_IP`; it takes several addresses; the source build uses the
  server's own network and resolver.
- **No ready-made image:** the installer says the build can take 30 minutes or more on a small server and suggests a
  bigger one for the first install.

## Depends on / check-ins
- None. Shared files touched lightly: `README.md`.
