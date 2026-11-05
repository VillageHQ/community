-- Accounts that predate invites were created by whoever holds the deploy password, so the email check already trusts them.
UPDATE "user" SET "email_verified" = true
WHERE "email_verified" = false
  AND "id" NOT IN (SELECT "accepted_user_id" FROM "invite" WHERE "accepted_user_id" IS NOT NULL);
