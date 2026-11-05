export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const [{ migrateOnBoot }, { getDatabase }, { sealVillageSecretOnBoot }] = await Promise.all([
    import("./platform/database/migrate-on-boot"),
    import("./platform/database/client"),
    import("./platform/village/settings"),
  ]);
  await migrateOnBoot(process.env, undefined, () => sealVillageSecretOnBoot(getDatabase(), process.env));
}
