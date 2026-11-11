export type LegacySearchParams = Promise<Record<string, string | string[] | undefined>>;

// Keeps the query of an old address when it moves to its new one.
export function toLegacyQuery(params: Awaited<LegacySearchParams>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item);
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}
