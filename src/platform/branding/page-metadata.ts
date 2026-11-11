import type { Metadata } from "next";

const DEFAULT_DESCRIPTION = "A private community for your network, powered by Village.";

type MetadataBranding = { name: string; descriptor: string; logo: { url: string } | null };

export const PAGE_TITLES = {
  feed: "Feed",
  home: "Home",
  today: "This week",
  messages: "Inbox",
  network: "Search",
  introAsk: "Ask for an intro",
  myNetwork: "Connect your network",
  intros: "Intros",
  intro: "Intro",
  introConsent: "An intro for you",
  members: "Members",
  editCard: "Your card",
  yourData: "Your data",
  profile: "Member",
  welcome: "Welcome",
  join: "Join",
  confirmEmail: "Confirm your email",
  unsubscribe: "Email settings",
  weeklyAnswer: "Your weekly email",
  adminSetup: "Set up",
  adminMembers: "Members admin",
  adminReports: "Reports",
  adminAuditLog: "Audit log",
  adminReport: "Partner report",
  adminFeatures: "Features",
  adminSettings: "Settings",
  adminWeeklyEmail: "Weekly email",
  adminVillage: "Village",
  adminMail: "Mail",
  adminImport: "Import members",
  adminLinks: "Sign-in links",
  adminIntegrations: "Integrations",
  adminPerks: "Perks",
  adminAsks: "Asks admin",
  perks: "Perks",
  admin: "Console",
  setup: "Set up",
  signIn: "Sign in",
  forgotPassword: "Forgot your password",
  resetPassword: "Choose a new password",
  recoverAdmin: "Recover your admin account",
  signUp: "Sign-up is closed",
  notFound: "Not found",
  checkEmail: "Check your email",
  linkNotValid: "Link not valid",
};

export function toRootMetadata({ name, descriptor, logo }: MetadataBranding): Metadata {
  return {
    title: { default: name, template: `%s · ${name}` },
    description: descriptor || DEFAULT_DESCRIPTION,
    icons: logo ? { icon: logo.url } : undefined,
  };
}
