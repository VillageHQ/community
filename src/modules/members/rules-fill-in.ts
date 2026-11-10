import { FILL_IN_FIELDS, type FillInField } from "./contract-fill-in.ts";

type ShownLine = { value: string; filledAt: Date };

type OwnCard = { title: string | null; company: string | null; location: string | null; avatarUrl: string | null };

export type ShownCard = {
  title: string | null;
  company: string | null;
  location: string | null;
  headline: string | null;
  imageUrl: string | null;
  // Lines on show that came from public profiles, and the newest of their dates.
  filledFields: FillInField[];
  filledAt: Date | null;
};

// The member's own words always win. A filled-in line shows only where they wrote nothing, and a
// filled-in face or company logo only when they have no uploaded photo.
export function readShownCard(own: OwnCard, shown: ReadonlyMap<FillInField, ShownLine>): ShownCard {
  const used: { field: FillInField; line: ShownLine }[] = [];
  const pick = (ownValue: string | null, field: FillInField) => {
    if (ownValue) return ownValue;
    const line = shown.get(field);
    if (!line) return null;
    used.push({ field, line });
    return line.value;
  };
  const card = {
    title: pick(own.title, FILL_IN_FIELDS.title),
    company: pick(own.company, FILL_IN_FIELDS.company),
    location: pick(own.location, FILL_IN_FIELDS.location),
    headline: pick(null, FILL_IN_FIELDS.headline),
    imageUrl: own.avatarUrl ?? pick(null, FILL_IN_FIELDS.face) ?? pick(null, FILL_IN_FIELDS.companyLogo),
  };
  const dates = used.map(({ line }) => line.filledAt.getTime());
  return { ...card, filledFields: used.map(({ field }) => field), filledAt: dates.length > 0 ? new Date(Math.max(...dates)) : null };
}
