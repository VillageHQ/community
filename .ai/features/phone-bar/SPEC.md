---
id: phone-bar
status: building
waits-on: []
touches: ["src/shell/navigation.ts", "src/modules/registry.ts", "docs/architecture.md"]
checks: ["src/shell/navigation.test.ts", "src/shell/navigation-links.test.ts"]
---
# Intros on the phone's bottom bar

What it does now.

- **The order.** The navigation keeps its own order in `src/shell/navigation.ts`: Home (or Feed when the feed is on),
  Meet, Intros, Messages, Members, Asks, Jobs, Perks, then Admin. The module list in `src/modules/registry.ts` keeps
  its order for the admin Features page and the timed jobs. A module missing from the navigation order goes last.
- **The phone bar.** Up to five entries show as they are; with more, the first four stay and the rest go under More.
  With the default modules that is Home · Meet · Intros · Messages · More, and More holds Members and Asks.
- **Badges.** Intros shows its count on its own tab, like Messages; More adds up only the badges it holds.
- **A module off.** It drops out and the next entry moves up, so the bar never has a gap. With Intros off and the
  defaults, the bar is Home · Meet · Messages · Members · Asks.
- **The sidebar** on a wide screen lists the same entries in the same order.
