const TAG_SEPARATOR = ",";
const TAGS_FIELD = "tags";

export function parseTagsText(tagsText: string) {
  return tagsText
    .split(TAG_SEPARATOR)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function toProfileBody(formData: FormData) {
  const { [TAGS_FIELD]: tagsText, ...fields } = Object.fromEntries(formData);
  return {
    ...fields,
    ...(typeof tagsText === "string" ? { tags: parseTagsText(tagsText) } : {}),
  };
}
