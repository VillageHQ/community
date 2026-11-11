// Ports Founderhall's portal stylesheet (public/app.css) into src/app/parts.css, so Community's parts use the same
// rules value for value. Every class is prefixed `fh-` (Tailwind owns names such as .grid, .hidden and .block), bare
// element rules and the font faces are dropped (globals.css and next/font own those), and the result sits in the
// `components` layer, below Tailwind's utilities.
//   node .ai/features/fh-foundation/port-css.mjs <path to founderhall>/portal/public/app.css
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [source] = process.argv.slice(2);
if (!source) throw new Error("Pass the path to Founderhall's app.css");
const css = readFileSync(source, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

// Selectors whose element part belongs to the page itself, not to a part.
const DROP_SELECTOR = /^(html|body|a|a:hover|button|input|textarea|select|h1|h2|h3|h4|p|\*|::selection|::-webkit-scrollbar.*|:focus-visible|:root|html\.js .*|body\.embed.*)$/;
const RENAME_SELECTOR = [[/^body\.public\b/, ".public"]];

function prefixSelector(selector) {
  let text = selector.trim();
  for (const [pattern, replacement] of RENAME_SELECTOR) text = text.replace(pattern, replacement);
  return text.replace(/\.(-?[a-zA-Z_][\w-]*)/g, ".fh-$1");
}

function convertSelectorList(list) {
  const kept = list
    .split(",")
    .map((selector) => selector.trim())
    .filter((selector) => selector && !DROP_SELECTOR.test(selector))
    .map(prefixSelector);
  return kept.join(",");
}

// A small block parser: enough for a hand-written stylesheet with @media nesting and no strings holding braces.
function convert(text) {
  let output = "";
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf("{", index);
    if (open === -1) break;
    const head = text.slice(index, open).trim();
    let depth = 1;
    let cursor = open + 1;
    while (depth > 0 && cursor < text.length) {
      if (text[cursor] === "{") depth += 1;
      if (text[cursor] === "}") depth -= 1;
      cursor += 1;
    }
    const body = text.slice(open + 1, cursor - 1);
    index = cursor;
    if (head.startsWith("@font-face")) continue;
    if (head.startsWith("@media")) {
      const inner = convert(body);
      if (inner.trim()) output += `${head}{\n${inner}}\n`;
      continue;
    }
    const selectors = convertSelectorList(head);
    if (selectors) output += `${selectors}{${body.trim()}}\n`;
  }
  return output;
}

const header = `/* Founderhall's part styles (its portal's public/app.css, "app design v05"), ported value for value by
   .ai/features/fh-foundation/port-css.mjs. Every class carries the fh- prefix; use the React parts in
   src/components/ui where one exists. Tokens (--ink, --paper, --fund…) live in globals.css. Do not edit by hand:
   change the source and rerun the script, or add an override in globals.css. */\n`;

const out = resolve(import.meta.dirname, "../../../src/app/parts.css");
writeFileSync(out, `${header}@layer components {\n${convert(css)}}\n`);
console.log(`wrote ${out}`);
