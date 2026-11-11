# Demo portraits

**Status:** built (pull request open).

The demo's made-up people (members, invitees, the outside people in search and intro paths, the fake Village set)
each have a realistic portrait of a person who does not exist, in `public/demo/faces/<name-slug>.webp` (256 × 256,
under 10 KB each, about 240 KB in all). `toDemoFaceUrl` in `src/platform/demo/pictures.ts` builds the link; demo mode,
the demo reset and the test fake Village all use it, so a reset keeps the same pictures.

Each portrait was generated from a text prompt alone with an open image model on the maintainer's machine, at no
cost; `public/demo/CREDITS.md` records the model, licence, prompt and seed of every file. Never add a photo of a real
person. Company marks stay drawn SVGs; thirteen of the plainest were redrawn as marks tied to the company's name.

To add a person: generate a portrait the same way (same prompt shape, plain warm grey background), crop head and
shoulders to a square, save 256 × 256 webp, and add its line to the credits. `src/platform/demo/pictures.test.ts`
fails when a made-up person has no bundled face.
