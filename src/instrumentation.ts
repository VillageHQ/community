export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const [{ migrateOnBoot }, { resolveMigrationPlan }, { getDatabase }, { sealVillageSecretOnBoot }, { startSelfTick }, { isDemoMode }] = await Promise.all([
    import("./platform/database/migrate-on-boot"),
    import("./platform/database/migration-plan"),
    import("./platform/database/client"),
    import("./platform/village/settings"),
    import("./platform/jobs/self-tick"),
    import("./platform/demo/mode"),
  ]);
  const isDemo = isDemoMode(process.env);
  // The weekly allowance spans Asks and Intros; intro emails say how many asks are left.
  const [{ provideWeeklyAllowance }, { readAskAllowance }] = await Promise.all([import("./platform/allowance/weekly-allowance"), import("./shell/ask-helpers")]);
  provideWeeklyAllowance(readAskAllowance);
  // Demo mode: before anything can call out, every server-side fetch goes through the demo's guard.
  if (isDemo) (await import("./platform/demo/outbound")).installDemoFetchGuard(process.env);

  const bootDemo = async () => (await import("./shell/demo-reset")).bootDemo(getDatabase(), process.env);

  await migrateOnBoot(process.env, undefined, async () => {
    await sealVillageSecretOnBoot(getDatabase(), process.env);
    if (isDemo) await bootDemo();
  });
  if (isDemo && !resolveMigrationPlan(process.env).shouldRun) await bootDemo();
  startSelfTick(process.env);
}
