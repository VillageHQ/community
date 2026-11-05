import { directoryFiltersSchema, type DirectoryFilters } from "./profile-api.ts";

const SEARCH_PARAM = "q";
const TAG_PARAM = "tag";
const PAGE_PARAM = "page";

type SearchParamValue = string | string[] | undefined;

function readFirstValue(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function readPage(value: string | undefined) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

export function parseDirectoryFilters(params: Record<string, SearchParamValue>): DirectoryFilters {
  const filters = directoryFiltersSchema.safeParse({
    search: readFirstValue(params[SEARCH_PARAM]),
    tag: readFirstValue(params[TAG_PARAM]),
    page: readPage(readFirstValue(params[PAGE_PARAM])),
  });
  return filters.success ? filters.data : { search: "", tag: "", page: 1 };
}

export function toDirectoryQueryString({ search, tag, page }: DirectoryFilters) {
  const params = new URLSearchParams();
  if (search) params.set(SEARCH_PARAM, search);
  if (tag) params.set(TAG_PARAM, tag);
  if (page > 1) params.set(PAGE_PARAM, String(page));
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}
