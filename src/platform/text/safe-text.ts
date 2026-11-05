const NULL_BYTES = /\0/g;
const BIDI_CONTROLS = /[؜‎‏‪-‮⁦-⁩]/g;

export function removeNullBytes(text: string) {
  return text.replace(NULL_BYTES, "");
}

export function removeBidiControls(text: string) {
  return text.replace(BIDI_CONTROLS, "");
}
