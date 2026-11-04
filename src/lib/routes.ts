export const ROUTES = {
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  setup: "/setup",
  landing: "/start",
  network: "/network",
  admin: "/admin",
} as const;

export const AUTH_BASE_PATH = "/api/auth";

export const API_ROUTES = {
  setup: "/api/setup",
  branding: "/api/admin/branding",
  brandingLogo: "/api/branding/logo",
  setupDomain: "/api/admin/setup/domain",
  networkStatus: "/api/network/status",
  networkLinkedin: "/api/network/linkedin",
  networkConsent: "/api/network/consent",
  networkSearch: "/api/network/search",
  networkPaths: "/api/network/paths",
  networkLeave: "/api/network/leave",
  villageKeys: "/api/admin/village/keys",
  villageGroup: "/api/admin/village/group",
  villageLinks: "/api/admin/village/links",
  villageLinkReset: "/api/admin/village/links/reset",
} as const;
