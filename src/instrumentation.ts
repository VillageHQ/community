export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { migrateOnBoot } = await import("./database/migrate-on-boot");
  await migrateOnBoot(process.env);
}
