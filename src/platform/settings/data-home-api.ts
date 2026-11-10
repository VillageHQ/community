import { z } from "zod";

// Where this install keeps its data, and whom members ask about it. Every field is optional and is shown exactly as
// the admin typed it: the app never guesses a region or claims a certification.
export const MAXIMUM_DATA_LOCATION_LENGTH = 120;
export const MAXIMUM_DATA_CONTACT_NAME_LENGTH = 80;
const MAXIMUM_EMAIL_LENGTH = 254;
// Line breaks and invisible characters (a right-to-left override can make text read backwards) are refused. The two
// joiners stay allowed: Persian names and some emoji need them.
const HIDDEN_CHARACTERS = /(?![\u200c\u200d])[\p{Cc}\p{Cf}]/u;
const PLAIN_TEXT_MESSAGE = "Use plain text on one line.";

export const dataHomeBodySchema = z
  .object({
    location: z
      .string()
      .trim()
      .max(MAXIMUM_DATA_LOCATION_LENGTH, `Keep where the data is kept under ${MAXIMUM_DATA_LOCATION_LENGTH} characters.`)
      .refine((text) => !HIDDEN_CHARACTERS.test(text), `Where the data is kept: ${PLAIN_TEXT_MESSAGE}`),
    contactName: z
      .string()
      .trim()
      .max(MAXIMUM_DATA_CONTACT_NAME_LENGTH, `Keep the contact's name or role under ${MAXIMUM_DATA_CONTACT_NAME_LENGTH} characters.`)
      .refine((text) => !HIDDEN_CHARACTERS.test(text), `The contact's name or role: ${PLAIN_TEXT_MESSAGE}`),
    contactEmail: z
      .string()
      .trim()
      .toLowerCase()
      .max(MAXIMUM_EMAIL_LENGTH, "Check the contact email: it is too long.")
      .pipe(z.union([z.literal(""), z.email("Check the contact email: it isn't an email address.")])),
  })
  .refine(({ contactName, contactEmail }) => contactName === "" || contactEmail !== "", {
    message: "Add an email for data requests, or clear the contact's name.",
    path: ["contactEmail"],
  });

export type DataHomeBody = z.infer<typeof dataHomeBodySchema>;

export type DataHome = {
  location: string | null;
  contact: { name: string | null; email: string } | null;
};

export const EMPTY_DATA_HOME: DataHome = { location: null, contact: null };

export function toDataHome({ location, contactName, contactEmail }: DataHomeBody): DataHome {
  return {
    location: location || null,
    contact: contactEmail ? { name: contactName || null, email: contactEmail } : null,
  };
}

export function isDataHomeSet({ location, contact }: DataHome) {
  return location !== null || contact !== null;
}
