const CONTROL_CHARACTERS = /[\p{Cc}\p{Cf}]+/gu;

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

export function toSingleLine(text: string) {
  return text.replace(CONTROL_CHARACTERS, " ").trim();
}
