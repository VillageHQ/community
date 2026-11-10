import type { Metadata } from "next";

const DEFAULT_DESCRIPTION = "A private community for your network, powered by Village.";

type MetadataBranding = { name: string; descriptor: string; logo: { url: string } | null };

export const PAGE_TITLES = {
  feed: "Feed",
  home: "Home",
  today: "This week",
  messages: "Messages",
  network: "Network",
  intros: "Intros",
  intro: "Intro",
  introConsent: "An intro for you",
  members: "Members",
  editCard: "Your card",
  yourData: "Your data",
  profile: "Member",
  welcome: "Welcome",
  join: "Your invite",
  confirmEmail: "Confirm your email",
  unsubscribe: "Email settings",
  weeklyAnswer: "Your weekly email",
  adminMembers: "Members admin",
  adminReports: "Reports",
  adminAuditLog: "Audit log",
  adminReport: "Partner report",
  adminCredits: "Credits",
  adminFeatures: "Features",
  adminSettings: "Settings",
  adminWeeklyEmail: "Weekly email",
  admin: "Admin",
  setup: "Set up",
  signIn: "Sign in",
  forgotPassword: "Forgot your password",
  resetPassword: "Choose a new password",
  recoverAdmin: "Recover your admin account",
  signUp: "Sign-up is closed",
  notFound: "Page not found",
};

export function toRootMetadata({ name, descriptor, logo }: MetadataBranding): Metadata {
  return {
    title: { default: name, template: `%s · ${name}` },
    description: descriptor || DEFAULT_DESCRIPTION,
    icons: logo ? { icon: logo.url } : undefined,
  };
}
