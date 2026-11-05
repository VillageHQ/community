import { readFirstName } from "@/lib/design/avatar-identity";

const ENCRYPTION_NOTE =
  "Messages aren't end-to-end encrypted, so whoever runs this community's database could read them.";

export const ADMIN_PRIVACY_NOTE = `Admins can't open your messages in the app, and see one only if it's reported. ${ENCRYPTION_NOTE}`;

export function describeBlock(memberName: string) {
  const firstName = readFirstName(memberName);
  return `${firstName} won't be told. Nothing ${firstName} sends from now on will reach you, including intro asks. You can unblock any time.`;
}

export function describeThreadPrivacy(memberName: string) {
  return `Only you and ${readFirstName(memberName)} can read this in the app, and admins see a message only if it's reported. ${ENCRYPTION_NOTE}`;
}
