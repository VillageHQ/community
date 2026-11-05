export type EmailConfirmationCopy = { title: string; description: string };

export function describeEmailConfirmation(communityName: string, isEmailConfigured: boolean): EmailConfirmationCopy {
  if (isEmailConfigured) {
    return {
      title: "Check your email to confirm it's you",
      description: `We sent you a link. Open it and confirm, and network search turns on. If it doesn't arrive, ${communityName} can confirm you instead.`,
    };
  }
  return {
    title: `Waiting for ${communityName} to confirm you`,
    description: "They just need to confirm this email is yours. Network search turns on after that, and you don't need to do anything.",
  };
}
