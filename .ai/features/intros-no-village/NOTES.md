# Intros without Village: how it works today

- **Two ways in.** A named ask from a member's profile ("Ask <name> for an intro", `ask-member-intro.tsx`): the asker
  types the person's name and company, and optionally an email or a LinkedIn link. A path ask from Village search, as
  before. Both share the same states, consent links, reminders, expiry, outcomes, allowance and connector cap.
- **No network needed.** A named ask has `is_named_target`. `hasBothParticipantsJoined`, `expireDueIntros` and
  `isActiveParticipant` (`reads.ts`, `reads-consent.ts`) skip the "joined the Village group" rule for it: two active
  members are enough, and leaving the group never closes it. Path asks keep the old rule.
- **Who the person is.** `target_linkedin_slug` holds their LinkedIn slug when the asker gave a link, else
  `~<name>|<company>` in lower case (`readNamedTargetKey`). "No thanks", "stop all asks" (an HMAC of this key) and the
  open-ask unique index all match on it. The email is never part of the key. `readTargetLinkedinSlug` hides the `~`
  key, so the UI shows the name and company with no LinkedIn link.
- **The asker's email for the person.** `suggested_target_email`, open asks only (a check constraint), cleared by
  `CLOSES_CONSENT` with the connector's own address. The connector's "Email <name>" field starts with it. A member's own
  address is refused at create.
- **Network is optional.** The manifest has no `requires` and `needsVillage: false`. Intros never imports network: the
  create route and the asks helpers pass `readIntroNetwork(database)` (`src/shell/intro-network.ts`), which gives path
  asks and the "chosen introducers" rule while Network is on, and `null` when it's off (a path ask then answers 409
  `intro_network_off`). The path-ask UI moved to `src/shell/intro-ask-dialog.tsx`, `intro-connector-ask.tsx` and
  `intro-other-paths.tsx`; `intros-network-provider.tsx` fills network's ask slots and intros' "who else can help"
  slot (`src/modules/intros/slots.tsx`). The app layout and the network page wrap in it while both modules are on.
- **"Who <name> can introduce you to"** (`network/components/member-reach-card.tsx`, while Network is on). Village never
  hands over a member's contacts, so it says whether the member shares their network (joined the group, and not left
  out by "chosen introducers", `readSharesNetwork`) and offers Search. It never lists anyone.
- **The profile button** shows for another member while Intros is on, unless the viewer blocked them or they turned
  off intro asks. A block the other way still withholds the ask silently, as before.

Known gaps: the finer intro rules in `.ai/features/intros-from-profile/SPEC.md` (7 days per step, the admin's outcome
day, an event history, the connector on the joining email) are not built.
