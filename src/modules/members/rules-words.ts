// Founderhall's possessive of a name: "Northwind Founders’", "Ada’s".
export function toPossessive(name: string) {
  const trimmed = name.trim();
  return /s$/i.test(trimmed) ? `${trimmed}’` : `${trimmed}’s`;
}

export function readFirstWord(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

// "Founder, Gridwise · Lagos": role and company, then the city.
export function toRoleLine({ title, company, location }: { title: string | null; company: string | null; location: string | null }) {
  const roleAndCompany = [title, company].filter(Boolean).join(", ");
  return location ? `${roleAndCompany} · ${location}` : roleAndCompany;
}

// The note a "Filled in from public profiles" sheet shows instead of lines; null when there are lines to show.
export function readFilledEmptyNote({ isFillInOn, isNotFound, hasLines, communityName }: { isFillInOn: boolean; isNotFound: boolean; hasLines: boolean; communityName: string }) {
  if (hasLines) return null;
  if (!isFillInOn) return `Nothing filled in from public profiles: ${communityName} hasn’t switched on profile fill-in.`;
  if (isNotFound) return "No public profile was found for this member.";
  return "Nothing filled in from public profiles yet.";
}

// "Northwind Founders" stays as it is; "Acme Ventures" becomes "Acme Ventures members".
export function toMembersOf(communityName: string) {
  return /\b(founders|members|community)$/i.test(communityName.trim()) ? communityName : `${communityName} members`;
}
