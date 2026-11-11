import { directoryFiltersSchema, UPDATED_WITHIN_DAYS, type DirectoryFilters } from "./contract-profile.ts";

const SEARCH_PARAM = "q";
const TAG_PARAM = "tag";
const STAGE_PARAM = "stage";
const SECTOR_PARAM = "sector";
const CITY_PARAM = "city";
const COHORT_PARAM = "cohort";
// Founderhall's name for the "Updated" filter; "updated" still reads, for older links.
const UPDATED_PARAM = "fresh";
const OLD_UPDATED_PARAM = "updated";
const HIRING_PARAM = "hiring";
const PAGE_PARAM = "page";

export const EMPTY_DIRECTORY_FILTERS: DirectoryFilters = { search: "", tag: "", stage: "", sector: "", city: "", cohort: "", updatedWithinDays: 0, hiring: false, page: 1 };

type SearchParamValue = string | string[] | undefined;

function readFirstValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function readPage(value: string | undefined) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

export function readUpdatedWithinDays(value: string | undefined) {
  return UPDATED_WITHIN_DAYS.find((days) => String(days) === value) ?? 0;
}

export function parseDirectoryFilters(params: Record<string, SearchParamValue>): DirectoryFilters {
  const filters = directoryFiltersSchema.safeParse({
    search: readFirstValue(params[SEARCH_PARAM]),
    tag: readFirstValue(params[TAG_PARAM]),
    stage: readFirstValue(params[STAGE_PARAM]),
    sector: readFirstValue(params[SECTOR_PARAM]),
    city: readFirstValue(params[CITY_PARAM]),
    cohort: readFirstValue(params[COHORT_PARAM]),
    updatedWithinDays: readUpdatedWithinDays(readFirstValue(params[UPDATED_PARAM]) ?? readFirstValue(params[OLD_UPDATED_PARAM])),
    hiring: readFirstValue(params[HIRING_PARAM]) === "1",
    page: readPage(readFirstValue(params[PAGE_PARAM])),
  });
  return filters.success ? filters.data : EMPTY_DIRECTORY_FILTERS;
}

export function hasDirectoryFilters({ search, tag, stage, sector, city, cohort, updatedWithinDays, hiring }: DirectoryFilters) {
  return Boolean(search || tag || stage || sector || city || cohort || updatedWithinDays || hiring);
}

export function toDirectoryQueryString({ search, tag, stage, sector, city, cohort, updatedWithinDays, hiring, page }: DirectoryFilters) {
  const params = new URLSearchParams();
  if (search) params.set(SEARCH_PARAM, search);
  if (tag) params.set(TAG_PARAM, tag);
  if (stage) params.set(STAGE_PARAM, stage);
  if (sector) params.set(SECTOR_PARAM, sector);
  if (city) params.set(CITY_PARAM, city);
  if (cohort) params.set(COHORT_PARAM, cohort);
  if (updatedWithinDays) params.set(UPDATED_PARAM, String(updatedWithinDays));
  if (hiring) params.set(HIRING_PARAM, "1");
  if (page > 1) params.set(PAGE_PARAM, String(page));
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}
