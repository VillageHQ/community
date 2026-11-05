import { z } from "zod";

import { removeBidiControls, removeNullBytes } from "./safe-text.ts";

const REPEATED_BLANK_LINES = /\n{3,}/g;

const WINDOWS_LINE_BREAK = /\r\n?/g;

const VISIBLE_CHARACTER = /[\p{L}\p{N}\p{P}\p{S}]/u;

function normalizeLineBreaks(text: string) {
  return text.replace(WINDOWS_LINE_BREAK, "\n").replace(REPEATED_BLANK_LINES, "\n\n");
}

export function feedTextSchema(label: string, maximumLength: number) {
  return z
    .string({ error: `Write ${label} first.` })
    .overwrite(removeNullBytes)
    .overwrite(removeBidiControls)
    .overwrite(normalizeLineBreaks)
    .trim()
    .refine((text) => VISIBLE_CHARACTER.test(text), `Write ${label} first.`)
    .refine((text) => text.length <= maximumLength, `Keep ${label} under ${maximumLength.toLocaleString("en-US")} characters.`);
}
