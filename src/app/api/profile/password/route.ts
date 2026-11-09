import { addPasswordBodySchema } from "@/modules/members/contract-invites";
import { membersRoutes } from "@/modules/members/routes";
import { addPassword } from "@/platform/auth/password-setup";

const CONFLICT_STATUS = 409;

export const POST = membersRoutes.member("profile-password", addPasswordBodySchema, async ({ database, member }, { password }) => {
  if (!(await addPassword(database, member.id, password))) {
    return Response.json(
      { code: "password_exists", message: "You already have a password. To change it, use Forgot your password on the sign-in page." },
      { status: CONFLICT_STATUS },
    );
  }
  return Response.json({ message: "Password added. You can sign in with it now." });
});
