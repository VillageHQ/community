const VILLAGE_TOKEN_KEY = "village.token";
const IDENTIFIED_MEMBER_KEY = "community.village-member";

export function clearVillageBrowserSession() {
  document.cookie = `${VILLAGE_TOKEN_KEY}=; Max-Age=0; path=/`;
  sessionStorage.removeItem(VILLAGE_TOKEN_KEY);
  localStorage.removeItem(IDENTIFIED_MEMBER_KEY);
}

export function claimVillageBrowserSession(externalId: string) {
  if (localStorage.getItem(IDENTIFIED_MEMBER_KEY) !== externalId) clearVillageBrowserSession();
  localStorage.setItem(IDENTIFIED_MEMBER_KEY, externalId);
}
