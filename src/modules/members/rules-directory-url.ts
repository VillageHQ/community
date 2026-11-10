import { directoryFiltersSchema, UPDATED_WITHIN_DAYS, type DirectoryFilters } from "./contract-profile.ts";

const SEARCH_PARAM = "q";
const TAG_PARAM = "tag";
const STAGE_PARAM = "stage";
const SECTOR_PARAM = "sector";
const COHORT_PARAM = "cohort";
const UPDATED_PARAM = "updated";
const PAGE_PARAM = "page";

export const EMPTY_DIRECTORY_FILTERS: DirectoryFilters = { search: "", tag: "", stage: "", sector: "", cohort: "", updatedWithinDays: 0, page: 1 };

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
    cohort: readFirstValue(params[COHORT_PARAM]),
    updatedWithinDays: readUpdatedWithinDays(readFirstValue(params[UPDATED_PARAM])),
    page: readPage(readFirstValue(params[PAGE_PARAM])),
  });
  return filters.success ? filters.data : EMPTY_DIRECTORY_FILTERS;
}

export function hasDirectoryFilters({ search, tag, stage, sector, cohort, updatedWithinDays }: DirectoryFilters) {
  return Boolean(search || tag || stage || sector || cohort || updatedWithinDays);
}

export function toDirectoryQueryString({ search, tag, stage, sector, cohort, updatedWithinDays, page }: DirectoryFilters) {
  const params = new URLSearchParams();
  if (search) params.set(SEARCH_PARAM, search);
  if (tag) params.set(TAG_PARAM, tag);
  if (stage) params.set(STAGE_PARAM, stage);
  if (sector) params.set(SECTOR_PARAM, sector);
  if (cohort) params.set(COHORT_PARAM, cohort);
  if (updatedWithinDays) params.set(UPDATED_PARAM, String(updatedWithinDays));
  if (page > 1) params.set(PAGE_PARAM, String(page));
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}
