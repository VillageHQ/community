# Charter: realistic portraits of made-up people for the demo

Approved by the owner as the build plan (the owner's pick); this page records that scope.

## Direction
The demo's drawn SVG faces look gimmicky. Replace every face in `public/demo/faces/` (the demo members, the
invitees, the outside people in search and intro paths, the preview's fake Village set) with a realistic portrait of a
person who does not exist: matching each name's apparent gender, a mix of ages and backgrounds, square, small
(≤ 40 KB each, webp or jpg), consistent lighting.

In: the face files, the code that builds face links (`.svg` → the new format), the fake Village, tests, and a
CREDITS file that records each file's source and licence. A check of the company marks; the weakest few redrawn.
Out: real people's photos of any kind (no stock photos, no avatar services that serve real photos); any paid image
service unless the owner agrees to the spend first.

## Deciding facts
- Source: generated on the maintainer's own machine with an open image model whose licence claims no rights over
  what it makes (Stable Diffusion XL base 1.0, CreativeML Open RAIL++-M). No money spent.
- Every generated face is reviewed by eye; any that looks like a known person is regenerated.
- Format: webp, 256 × 256, ≤ 40 KB each, ≤ 2 MB in all.
- Company logos stay drawn marks.

## Journeys and tests
Today, the directory, a profile, search with paths. Tests: `src/platform/demo/pictures.test.ts`,
`src/modules/network/fill-in.test.ts`, lint, typecheck, architecture tests; CI runs the full suite.

## Proof
Screenshots of Today, the directory, a profile and search with paths at 390 px.
Acceptance: every face is a realistic portrait with a licence line; none is a real person; total faces ≤ 2 MB; demo
reset keeps them.
