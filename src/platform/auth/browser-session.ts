const LEGACY_VILLAGE_TOKEN_KEY = "village.token";
const LEGACY_IDENTIFIED_MEMBER_KEY = "community.village-member";

// The old Village script kept a member token on this site. Clearing it on sign-out keeps a shared browser clean.
export function clearVillageBrowserSession() {
  document.cookie = `${LEGACY_VILLAGE_TOKEN_KEY}=; Max-Age=0; path=/`;
  sessionStorage.removeItem(LEGACY_VILLAGE_TOKEN_KEY);
  localStorage.removeItem(LEGACY_IDENTIFIED_MEMBER_KEY);
}
