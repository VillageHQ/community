import { z } from "zod";

import { MAXIMUM_NAME_LENGTH } from "../../platform/auth/member-name.ts";
import { removeBidiControls, removeNullBytes } from "../../platform/text/safe-text.ts";
import { createInviteBodySchema } from "./contract-invites.ts";

// Ported from Founderhall's invite-list and member-CSV readers: the same formats and limits, Community's style.
export const MAXIMUM_LISTED_INVITES = 500;
export const MAXIMUM_CSV_ROWS = 20_000;
export const MAXIMUM_CSV_BYTES = 8 * 1024 * 1024;
const MAXIMUM_DETAIL_LENGTH = 200;
const MAXIMUM_QUOTED_LINE_LENGTH = 80;

export const BULK_INVITE_FORMATS = { list: "list", csv: "csv" } as const;
export type BulkInviteFormat = (typeof BULK_INVITE_FORMATS)[keyof typeof BULK_INVITE_FORMATS];

export type BulkPerson = { line: number; email: string; name: string | null; company: string | null; cohort: string | null };
export type BulkProblem = { line: number; text: string; why: string };
export type BulkSkip = { line: number; email: string; why: string };
export type ParsedBulkInvites = { people: BulkPerson[]; problems: BulkProblem[]; skipped: BulkSkip[] };

export class BulkInviteLimitError extends Error {}

// A cell that starts with = + - @ (or a tab or carriage return) runs as a formula when a spreadsheet opens a file
// that later holds it. Those leading characters are dropped, so nothing an admin imports can become one.
const FORMULA_START = /^[=+\-@\t\r]+/;
const ANGLE_ADDRESS = /^(.*?)<([^<>]+)>\s*$/;
const LIST_SEPARATORS = /[,;\t]/;
const HEADER_WORD = /e-?mail/i;
const BYTE_ORDER_MARK = /^﻿/;

export function toSafeCell(value: string, maximumLength = MAXIMUM_DETAIL_LENGTH) {
  const cleaned = removeBidiControls(removeNullBytes(value)).replace(/\s+/g, " ").trim();
  return cleaned.replace(FORMULA_START, "").trim().slice(0, maximumLength);
}

function toOptionalCell(value: string, maximumLength?: number) {
  return toSafeCell(value, maximumLength) || null;
}

export function readEmail(value: string) {
  const email = createInviteBodySchema.shape.email.safeParse(value.replace(/^"(.*)"$/, "$1"));
  return email.success ? email.data : null;
}

function quoteLine(text: string) {
  return toSafeCell(text, MAXIMUM_QUOTED_LINE_LENGTH);
}

class PeopleCollector {
  readonly result: ParsedBulkInvites = { people: [], problems: [], skipped: [] };
  private readonly seen = new Set<string>();

  add(person: BulkPerson) {
    if (this.seen.has(person.email)) {
      this.result.skipped.push({ line: person.line, email: person.email, why: "This email is listed twice. Only the first one is invited." });
      return;
    }
    this.seen.add(person.email);
    this.result.people.push(person);
  }

  reject(line: number, text: string, why: string) {
    this.result.problems.push({ line, text: quoteLine(text), why });
  }
}

function readListLine(line: string) {
  const angle = line.match(ANGLE_ADDRESS);
  const angleEmail = angle ? readEmail(angle[2] ?? "") : null;
  if (angle && angleEmail) return { email: angleEmail, name: (angle[1] ?? "").replace(/[",]/g, " ") };

  const cells = line.split(LIST_SEPARATORS).map((cell) => cell.trim().replace(/^"(.*)"$/, "$1").trim()).filter(Boolean);
  const emailIndex = cells.findIndex((cell) => readEmail(cell) !== null);
  if (emailIndex === -1) return null;
  return { email: readEmail(cells[emailIndex] ?? "") ?? "", name: cells.filter((_, index) => index !== emailIndex).join(" ") };
}

// One person per line: "Name, email", "Name <email>" or a bare email. A header row is skipped quietly.
export function parseInviteList(text: string): ParsedBulkInvites {
  const collector = new PeopleCollector();
  const lines = text.replace(BYTE_ORDER_MARK, "").split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const lineNumber = index + 1;
    const person = readListLine(line);
    if (!person) {
      if (!HEADER_WORD.test(line)) collector.reject(lineNumber, line, "There's no email address on this line.");
      return;
    }
    collector.add({ line: lineNumber, email: person.email, name: toOptionalCell(person.name, MAXIMUM_NAME_LENGTH), company: null, cohort: null });
  });
  if (collector.result.people.length + collector.result.skipped.length > MAXIMUM_LISTED_INVITES) {
    throw new BulkInviteLimitError(`Paste at most ${MAXIMUM_LISTED_INVITES} people at once. For more, upload a CSV file.`);
  }
  return collector.result;
}

type CsvRow = { cells: string[]; line: number };

// RFC 4180: quoted cells, doubled quotes, commas and line breaks inside quotes, CRLF or LF, a leading byte order mark.
// A file saved in a semicolon locale is read with semicolons.
// Separators outside quotes on the first line decide: a quoted "Lovelace, Ada" must not make a semicolon file comma-separated.
function detectDelimiter(source: string) {
  let commas = 0;
  let semicolons = 0;
  let isQuoted = false;
  for (const character of source) {
    if (character === '"') isQuoted = !isQuoted;
    else if (!isQuoted && (character === "\n" || character === "\r")) break;
    else if (!isQuoted && character === ",") commas += 1;
    else if (!isQuoted && character === ";") semicolons += 1;
  }
  return semicolons > commas ? ";" : ",";
}

export function parseCsvRows(text: string): { rows: CsvRow[]; unclosedQuoteLine: number | null } {
  const source = text.replace(BYTE_ORDER_MARK, "");
  const delimiter = detectDelimiter(source);
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = "";
  let isQuoted = false;
  let quoteLine = 1;
  let line = 1;
  let rowLine = 1;

  const endRow = () => {
    cells.push(cell);
    if (cells.some((value) => value.trim() !== "")) rows.push({ cells, line: rowLine });
    cells = [];
    cell = "";
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    // A line ends at LF, CRLF, or a CR on its own (old Mac exports).
    if (character === "\n" || (character === "\r" && source[index + 1] !== "\n")) line += 1;
    if (isQuoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') isQuoted = false;
      else cell += character;
    } else if (character === '"' && cell === "") {
      isQuoted = true;
      quoteLine = line;
    } else if (character === delimiter) {
      cells.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") {
        index += 1;
        line += 1;
      }
      endRow();
      rowLine = line;
    } else cell += character;
  }
  endRow();
  return { rows, unclosedQuoteLine: isQuoted ? quoteLine : null };
}

const CSV_HEADERS = {
  name: ["name", "full name", "full_name"],
  email: ["email", "e-mail", "email address", "work email"],
  company: ["company", "organisation", "organization", "startup"],
  cohort: ["cohort", "batch", "class", "fund", "year"],
} as const;

type CsvColumn = keyof typeof CSV_HEADERS;
const POSITIONAL_COLUMNS: Record<CsvColumn, number> = { name: 0, email: 1, company: 2, cohort: 3 };

function readColumns(header: string[]) {
  const names = header.map((cell) => cell.trim().toLowerCase());
  const columns: Partial<Record<CsvColumn, number>> = {};
  for (const [column, aliases] of Object.entries(CSV_HEADERS) as [CsvColumn, readonly string[]][]) {
    const index = names.findIndex((name) => aliases.includes(name));
    if (index !== -1) columns[column] = index;
  }
  return columns.email === undefined ? null : columns;
}

// Columns name, email, company, cohort in any order under a header row; without one, in that order.
export function parseInvitesCsv(text: string): ParsedBulkInvites {
  const collector = new PeopleCollector();
  const { rows, unclosedQuoteLine } = parseCsvRows(text);
  if (unclosedQuoteLine !== null) {
    collector.reject(unclosedQuoteLine, "", "A quote mark opens here and never closes, so the rest of the file was read as one cell. Fix it and upload again.");
  }
  const [firstRow] = rows;
  if (!firstRow) {
    collector.reject(1, "", "The file is empty.");
    return collector.result;
  }
  const headerColumns = readColumns(firstRow.cells);
  const columns = headerColumns ?? POSITIONAL_COLUMNS;
  const dataRows = headerColumns ? rows.slice(1) : rows;
  if (dataRows.length > MAXIMUM_CSV_ROWS) {
    throw new BulkInviteLimitError(`This file has ${dataRows.length.toLocaleString("en-US")} rows. Upload at most ${MAXIMUM_CSV_ROWS.toLocaleString("en-US")} at once.`);
  }

  for (const { cells, line } of dataRows) {
    const read = (column: CsvColumn) => {
      const index = columns[column];
      return index === undefined ? "" : (cells[index] ?? "");
    };
    const rawEmail = read("email").trim();
    if (!rawEmail) {
      collector.reject(line, cells.join(", "), "There's no email address in this row.");
      continue;
    }
    const email = readEmail(rawEmail);
    if (!email) {
      collector.reject(line, rawEmail, "This isn't a valid email address.");
      continue;
    }
    collector.add({
      line,
      email,
      name: toOptionalCell(read("name"), MAXIMUM_NAME_LENGTH),
      company: toOptionalCell(read("company")),
      cohort: toOptionalCell(read("cohort")),
    });
  }
  return collector.result;
}

// The cohort an admin types beside a pasted list: the single invite's rule (trimmed, at most the card's length).
export function readListCohort(value: string | null) {
  const parsed = createInviteBodySchema.shape.cohort.safeParse(value ?? undefined);
  if (!parsed.success) throw new BulkInviteLimitError(parsed.error.issues[0]?.message ?? "Check the cohort.");
  return parsed.data === null ? null : toOptionalCell(parsed.data);
}

// A pasted list may carry one cohort for everyone on it; a CSV names each person's in its own column.
export function parseBulkInvites(format: BulkInviteFormat, text: string, listCohort: string | null = null) {
  if (format === BULK_INVITE_FORMATS.csv) return parseInvitesCsv(text);
  const parsed = parseInviteList(text);
  return listCohort ? { ...parsed, people: parsed.people.map((person) => ({ ...person, cohort: listCohort })) } : parsed;
}

const bulkProblemSchema = z.object({ line: z.number(), text: z.string(), why: z.string() });
const bulkSkipSchema = z.object({ line: z.number(), email: z.string(), why: z.string() });

export const bulkInviteResultSchema = z.object({
  invitedCount: z.number(),
  renewedCount: z.number(),
  problems: z.array(bulkProblemSchema),
  skipped: z.array(bulkSkipSchema),
  isEmailOn: z.boolean(),
  // Only when email is off: the admin sends each link themselves, as with a single invite.
  links: z.array(z.object({ email: z.string(), name: z.string().nullable(), link: z.string() })),
});

export type BulkInviteResult = z.infer<typeof bulkInviteResultSchema>;

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

// For a file an admin downloads and opens in a spreadsheet: a cell that could run as a formula starts with a quote mark.
export function toCsvCell(value: string) {
  const safe = FORMULA_TRIGGER.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function toCsv(rows: string[][]) {
  return rows.map((row) => row.map(toCsvCell).join(",")).join("\r\n");
}
