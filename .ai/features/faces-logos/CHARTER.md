# Faces and company logos everywhere — charter

Approved scope: the owner's build plan for the Founderhall → Community merge (wave 1, item "faces-logos").
The maintainer agreed and reviews after merge.

## Direction
Village's profile fill-in already saves a member's public face (`face`) and company logo (`company_logo`), but the app
shows the face only in the directory and on the profile, never shows a logo, and outside people in network search
have no picture. Show them wherever a person or a company appears, like Founderhall does.

In:
1. One shared "shown face": the member's uploaded photo, else the filled-in face. Used by every read that draws a
   member: header and Today, New this week, asks, intros, messages, feed, network connectors, Admin → Members, and
   `readAvatarUrl`.
2. One company-logo rule (Founderhall's): the filled logo shows only while the company on show is the one Village
   found (the member typed no company, or the same one, and the filled company line is not hidden). A small logo
   before the company name on the directory, the profile, Today, asks rows and the members' job board (a company's
   logo when a member of that company has one). The logo is no longer a stand-in face.
3. Outside people in search results and paths get Village's picture (`image_url` / `avatar`), through a new picture
   field on the network contracts.
4. The fill-in also reads `company.domain` (a new "Company website" line); the member's data export lists the face and
   logo links.
5. `readSafeImageUrl` also accepts the app's own `/demo/...` pictures; remote links still need https.
6. Demo mode and the test fake Village answer with bundled made-up faces and drawn logos under `public/demo/`.
7. The roadmap line that called faces and logos done is corrected.

Out: emails stay text-only; the public job board and its widget stay text-only; no change to how photos are uploaded.

## Decisions taken
- The demo faces are drawn (simple SVG portraits), not stock photos of real people, because the public repo carries
  no real people. The logos are drawn marks.
- `company_domain` is stored as one more fill-in line (migration 0027 widens the field check); it is listed on the
  card's "From public profiles" panel and in the export, and shown nowhere else.
- A logo needs a company name beside it: no shown company, no logo.

## Acceptance (made-up data, 390 and 1280 px)
After a fill-in the member's face shows on every screen in 1; a logo shows next to the company only under the rule;
outside people in search and paths show pictures; an uploaded photo always wins over the filled face; demo mode
shows faces and logos after "Try it as…".
