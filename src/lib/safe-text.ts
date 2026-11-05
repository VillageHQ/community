const NULL_BYTES = /\0/g;

export function removeNullBytes(text: string) {
  return text.replace(NULL_BYTES, "");
}
