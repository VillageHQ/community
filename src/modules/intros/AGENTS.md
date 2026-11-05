# Intros

A member asks another member for an introduction to someone in their network. Toggleable. Needs network.

- `contract.ts`: states, allowed moves and limits. `INTRO_TRANSITIONS` is the state machine.
- `service.ts`: create an ask and move it between states.
- `reads.ts`, `reads-open-asks.ts`: boards, counts, details. Expiry happens at read time, because there are no scheduled jobs.
- `service-blocks.ts`: what a block does to open asks. The block route passes it to members.
- `email.ts`: the notices. `limits.ts`: rate limits. `copy.ts`: words.
- `queries.ts`: client requests. `components/`: the UI.
- `components/connector-ask.tsx`: fills the network slots with the ask dialog and the promise line.

Rules:

- Every move is one conditional `UPDATE`, so two simultaneous moves can't both land.
- The browser sends slugs and a note. The server reads everything else from that member's own cached paths.
- A requester hears nothing about why an ask was withheld.
