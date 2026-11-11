// The made-up people's pictures, bundled in public/demo/: a generated portrait per person (none is a real person,
// see public/demo/CREDITS.md), a drawn mark per company.
// Demo mode and the test fakes hand these out as the pictures public profiles found.

const DEMO_PICTURES_PATH = "/demo";

export function toPictureSlug(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toDemoFaceUrl(name: string) {
  return `${DEMO_PICTURES_PATH}/faces/${toPictureSlug(name)}.webp`;
}

export function toDemoLogoUrl(company: string) {
  return `${DEMO_PICTURES_PATH}/logos/${toPictureSlug(company)}.svg`;
}

export function toDemoDomain(company: string) {
  return `${toPictureSlug(company)}.example`;
}
