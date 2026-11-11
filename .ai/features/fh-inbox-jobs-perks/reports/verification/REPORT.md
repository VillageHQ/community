# Independent verification (a separate agent that did not write the code)

Round 0 on a fresh demo database and a production build, signed in as Sam; pairs in this folder (Founderhall left,
Community right). Round 1 re-checked only what failed and what changed.

## Acceptance shots
| Shot | 1280 | 390 | Differences other than community data |
|---|---|---|---|
| member-inbox-list | PASS | PASS | Shell items only (see below). |
| member-inbox-empty | PASS | PASS | Shell items only; the empty card is pixel-identical at 1280. |
| member-inbox-thread | PASS | PASS | "Block Priya" (Community-only, kept). Back-link chevron slightly smaller (shared `BackLink`); Send about 2 px wider. |
| member-message-new | PASS (round 1) | PASS (round 1) | Round 0: Inbox not lit. Fixed. |
| member-message-sent-thread | PASS | PASS | "Block Ada" (kept). Round 0: hydration error. Fixed. |
| member-jobs-board | PASS | PASS | Shell items only; logos are data. |
| public-jobs-board | PASS | PASS | Footer hosting text comes from the demo's data-location setting (data). |
| member-perks-on | PASS (expected) | PASS (expected) | The demo's made-up deals fill the frame (Founderhall's demo frame is blank). |
| member-perks-off | PASS (round 1) | PASS (round 1) | Round 0: status 200. Fixed: 404, in the app frame, title "Not found · Northwind Founders". |

Shell items owned by the foundation, not this area: count badges on menu items, the "NF" fund mark, the phone-foot
"Jobs · Perks" links, the Perks menu item (Perks is on in Community's demo), the sidebar sitting 2 px higher.

## Break attempts (all PASS after round 1)
- `/messages`, `/messages/<id>`, `/public/jobs` → 308 to `/inbox`, `/inbox/<id>`, `/jobs` (query kept).
- `/messages/new`: an existing conversation opens it; a blank message sends nothing and creates nothing; a double-clicked
  Send stores one message; own id, garbage or unknown ids show "That page isn’t here".
- Visitor at `/jobs`: the public board, no sharer's name or email in text, HTML or payload; `?company=` filters,
  unknown company 404; board not public → sign-in.
- Delete your own message and report the other member's still work; admins can't open members' conversations.
- The new-message email never carries the message (a marker string never reached subject, text or html).
- `src/proxy.ts` fetches the in-app 404 from the app's own address, never the Host header (spoofed Host tested).

## Left open (reported, not fixed here)
- Other in-app "not found" answers (unknown conversation, `/messages/new?to=garbage`, unknown company when signed in)
  answer 200 under the app's loading screen with the right words, as every in-app 404 in Community does today.
- If a host can't reach its own public address, the switched-off page falls back to the right words with status 200.
- The reply-did-not-go-through email keeps Community's specific reasons as its first line.
