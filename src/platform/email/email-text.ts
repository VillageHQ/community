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

// Founderhall's emails are plain text. The HTML part shows the same words, line for line, with nothing added.
export function renderPlainTextHtml(text: string) {
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:22px;white-space:pre-wrap;max-width:600px">${escapeHtml(text)}</div>`;
}

// The one line every member email ends with (Founderhall's foot()).
export function describeEmailFoot(communityName: string) {
  return `Sent by ${communityName} via its member portal.`;
}

// "That ask is too long to quote in a subject…": cut at a word, with an ellipsis (Founderhall's clip()).
export function clipLine(text: string, maximum: number) {
  const single = text.replace(/\s+/g, " ").trim();
  return single.length > maximum ? `${single.slice(0, maximum - 1).replace(/\s+\S*$/, "")}…` : single;
}
