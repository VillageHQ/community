# Architecture

The app is one Next.js deployment made of feature modules on a shared platform. An admin turns features on and off. Tests enforce the boundaries.

## The tree

```text
src/
  app/          Pages and route handlers. They parse, call one thing, and respond.
  shell/        Code that knows several modules: navigation, badges, setup progress,
                next steps, onboarding, the app shell UI.
  modules/
    members/    Core. Directory, profiles, invites, LinkedIn claim, blocks.
    registry.ts The list of modules. A new module adds one line here.
    feed/       Toggle. Posts, replies, reactions, pins.
    messages/   Toggle. Direct messages.
    network/    Toggle. Village search, sync, group, paths, credits.
    intros/     Toggle. Warm intros. Needs network.
    asks/       Toggle, off by default. Members post what they need, others offer help.
    admin/      Core. Roster, reports, audit view, health, the features screen.
  platform/     Infrastructure with no product opinion: auth, audit, branding, database,
                design, email, http, observability, rate-limit, secrets, settings, text, village.
  components/   Generic product UI.
    ui/         shadcn.
  test/         Fake servers, fixtures and the architecture tests.
```

"Core" means a module can't be turned off. It doesn't mean it sits at the bottom. Admin is core, and it sits on top of the features it manages.

Branding lives in `platform`, not `modules`. Auth emails and the root layout read it, so as a module it would make `platform` import upward.

## Import rules

An arrow means "may import".

```text
app -> shell -> modules -> components -> platform
```

Inside `modules`:

```text
members <- messages, feed, network, asks
network <- intros
all     <- admin
```

`shell` exists because `navigation-badges`, `admin-setup` and `next-steps` each read several modules. They have to sit above all of them.

## File roles in a module

A public file may be imported by a higher module. `src/app` and `src/shell` may import any file in a module. A role can take a topic: `service-invites.ts`, `reads-credits.ts`, `contract-profile.ts`.

| File | Role | Public |
|---|---|---|
| `manifest.ts` | Pure data: identity, nav, requirements, owned paths | Yes |
| `integration.ts` | Server hooks for the registry | Registry only |
| `routes.ts` | `createModuleRoutes(manifest)` | `src/app` only |
| `service.ts` | Operations that change things | Yes |
| `reads.ts` | Read queries, with their visibility rules | Yes |
| `contract.ts` | Zod schemas, constants, API shapes. Client-safe | Yes |
| `queries.ts` | React Query factories and client requests | Yes |
| `schema.ts` | Drizzle tables, for joins from higher modules | Yes |
| `slots.tsx` | Client slots that higher modules fill | Yes |
| `limits.ts` | Rate limits | Yes |
| `components/shared/` | UI that higher modules reuse | Yes |
| `components/` | The module's UI | No |
| `rules-*.ts`, `copy.ts`, `email.ts` | Pure logic, words, email | No |
| `AGENTS.md` | Each file's job, and the rules never to break | No |

There's no `store.ts`. `service.ts` functions run reads, rule checks, writes and audit in one transaction, and Drizzle is already the typed store. A store would add pass-through functions without separating anything.

`reads.ts` is public on its own because routing reads through `service.ts` would need re-export lines, which this codebase doesn't use.

Code that `scripts/migrate.ts` or `drizzle-kit` load runs outside Next. That means `platform/database`, every `schema.ts`, and every `contract*.ts` a schema imports. Those files use relative `.ts` imports and no `server-only`.

## Slots

A lower module can't import a higher one, but its UI sometimes shows a higher module's action. The "Message" button appears on member cards, and the intro ask appears on network connector cards.

The lower module defines a slot, and the higher module fills it from a client provider:

```tsx
// src/modules/members/slots.tsx
export const MemberConversationSlotContext = createContext<((props: MemberConversationProps) => ReactNode) | null>(null);

export function MemberConversationSlot(props: MemberConversationProps) {
  const renderAction = useContext(MemberConversationSlotContext);
  return renderAction ? renderAction(props) : null;
}
```

`src/app/(app)/layout.tsx` wraps its children in `MessagesSlotProvider`. `src/app/(app)/network/page.tsx` wraps its flow in `IntrosConnectorProvider`. A slot with no provider renders nothing.

## Dependencies that point the other way

Some effects have to cross a boundary without an import. The route, which may import anything, passes them in:

- **Blocks.** `setMemberBlocked(context, body, onBlocked)` runs the effect in its own transaction. The block route passes `runMemberBlockedEffects`, which runs every module's `onMemberBlocked` hook.
- **Removals.** `removeMember(context, body, onRemoved)` works the same way through `onMemberRemoved`.
- **Open asks.** `readMemberPaths(context, slug, readOpenAsks)` takes the reader as an argument. The paths route passes the one from intros.
- **Offers as messages.** `offerHelp(context, body, deliver)` saves the note on the ask, then calls `deliver`. The offer route passes `sendOfferAsMessage` from `shell/ask-offer-delivery.ts`, which checks that messages is on and sends the note as a DM.

## Where things live

Some placements aren't obvious:

| What | Where | Why |
|---|---|---|
| `member_network` | `members/schema.ts` | The member card needs its LinkedIn columns. It also holds Village columns, and splitting it needs a data migration. |
| `member_block` | `members/schema.ts` | Intros and the profile page need blocks whatever else is on. |
| `member_removal` | `members/schema.ts` | Feed and network read it. |
| `admin_audit_entry` | `platform/audit/schema.ts` | Every module records admin actions. |
| `member_daily_usage`, daily limit | `platform/village/` | The credit ledger applies to anything that spends Village credits. |
| Reclaim and reinvite | `admin/service-roster.ts` | They hold the roster lock and call group departure. |
| Reports | `admin/service-reports.ts` | Feature routes like `/api/feed/report` call it. |
| Credit usage | `network/reads-credits.ts` | It only reads Village usage. |
| `/admin/credits`, `/api/admin/village/*` | Network | The admin URL is cosmetic. |
| `resolveOnboardingStep` | `shell/onboarding.ts` | It needs members and network. |
| Invite manager and list | `admin/components/` | They compose admin actions. |
| `API_ROUTES`, `PAGE_TITLES`, `AUDIT_ACTIONS` | `platform/` | Existing entries stay central. New modules define their own paths and titles in `contract.ts`. |

## Routes

Each module's `routes.ts` is `createModuleRoutes(manifest)`. A route file looks like this:

```ts
export const POST = introsRoutes.member("intros-create", createIntroBodySchema, async (context, body) =>
  Response.json(await createIntroRequest(context, body)),
);
```

`member` handles origin, session, admin check, body limit and Zod parsing. `memberBinary` and `adminBinary` take raw bytes. `open` is for routes that check for themselves, like invite acceptance.

The kit is built from two parts:

- `platform/http/member-route.ts`: the generic wrapper, which takes a list of error responders.
- `platform/village/route-errors.ts`: turns Village failures into friendly responses.

A service throws `RequestError` to send a status and code. The wrapper turns it into a response.

## Modules and the registry

`platform/modules/manifest.ts` defines the manifest. Here's a real one:

```ts
export const introsManifest = {
  kind: MODULE_KINDS.toggleable,
  id: "intros",
  label: "Intros",
  description: "Members ask each other for warm introductions.",
  icon: Handshake,
  isOnByDefault: true,
  needsVillage: true,
  requires: [networkManifest],
  navigation: [{ label: "Intros", href: ROUTES.intros, icon: Handshake, section: NAVIGATION_SECTIONS.primary, badge: "intros" }],
  adminTabs: [],
  paths: { pages: [ROUTES.intros], api: [API_ROUTES.intros] },
} satisfies ToggleableManifest;
```

Manifests are pure, so a route can import one without pulling in every module. `requires` holds manifest objects, so a typo can't compile. Paths match by whole segment and the longest match wins. `/` matches only itself.

`integration.ts` adds server hooks, and only `registry.ts` imports it:

```ts
export const introsModule: ModuleIntegration = {
  manifest: introsManifest,
  readNavigationBadge: async (database, memberId) => readIntroBadgeCount(await readIntroCounts(database, memberId)),
  onMemberBlocked: stopOpenAsksOnBlock,
};
```

Hook names carry a rule:

- **`read*` runs only when the module is on.** That's how badges stop being computed.
- **`on*` always runs.** It keeps retained data correct. If intros is off and a member blocks someone, their open asks must still close, or turning intros back on would revive them.

## Turning a module off

Each toggleable module has one `instance_settings` row: key `module_state:<id>`, value `on` or `off`. No row means the manifest's `isOnByDefault`. The state isn't cached, so every instance sees a change on its next request.

A module is enabled when it and everything in its `requires` chain are stored on. A dependent's stored choice survives, so turning network off pauses intros, and turning network on restores it.

When a module is off:

| Where | What happens | How |
|---|---|---|
| API routes | 404 with code `module_off` | The route kit's guard, inside route logging. It reads no body or session. A stale tab shows `ModuleOffNotice` with a way home. |
| Pages and layouts | Not-found UI | `modulePage` wraps each one. |
| Navigation | Entry hidden | `buildShellNavigation(enabledIds)` in the layout. |
| Badges | Not read | `readModuleBadges`. |
| Polling | Stops on a 404 | Every `refetchInterval` checks `isRouteGone`, so an open tab stops asking. |
| The Village mark | Hidden when nothing needs Village | `readRunsOnVillageSafely` in the root layout. |
| Setup checklist | Steps gone | `SETUP_STEP_OWNERS` in `shell/admin-setup.ts`. |
| Next steps, onboarding | Skipped | `shell/next-steps.ts` and `shell/onboarding.ts`. |
| Admin tabs | Hidden | Each manifest's `adminTabs`. |
| Emails | None sent | Intro emails only start from intros routes. |
| Data | Kept | Nothing is deleted. |

The guard is on the page because a layout can't protect its pages. Next's docs say a layout doesn't re-render on navigation and doesn't stop its child segments running (`01-app/02-guides/authentication.md`).

Hidden pages answer status 200 with the not-found UI and a `noindex` tag, because `(app)/loading.tsx` makes them stream. API routes answer a real 404.

Three things deliberately keep working:

- **Reports.** A report on a feature that's off stays visible and resolvable, labelled with that feature, and still counts toward the admin badge. Moderation can't disappear because a switch was flipped.
- **Leaving Village.** Turning network off doesn't take anyone out of the Village group. `/api/network/leave` stays open with `staysOpenWhenOff`, the only route allowed to use it, and a member still in the group gets a leave card on their own card page.
- **Departure on removal.** Removing a member still tries to take them out of the group, and the admin keeps the group row for any member still in it.

`/` always renders. With the feed off, it shows next steps and new members, and the nav gets a "Home" entry.

## The features screen

`/admin/features` lists the toggles as cards, each with a large switch. Core modules appear once, under "Always on". `POST /api/admin/modules` writes the state and the audit log in one transaction. It refuses core modules, and it refuses to turn on a module whose requirement is off.

The screen handles dependencies in words:

- Turning off a requirement says what it pauses, plus the manifest's `turnOffNote` if it has one.
- A paused feature shows "Paused: needs Network" and a button to turn on Network.

The domain and keys steps of setup also offer "Run without Village", so a new community can skip Village in one click. It confirms what happened.

## The sealed Village secret

`village_secret_key` is stored as `sealed.v1.<salt>.<iv>.<ciphertext+tag>`, in `platform/secrets/sealed.ts` and `platform/village/settings.ts`. Encryption is AES-256-GCM, with the setting key as additional data, so a ciphertext can't be copied to another setting. There's no new env var.

The key comes from `SETUP_TOKEN` through scrypt, not HKDF. HKDF assumes its input is already high entropy, and this token is a password a person chose: `readSetupToken` accepts any 32 characters with 8 distinct ones and no repeated 8-character run. Scrypt makes a stolen backup slow to guess. Each derivation costs tens of milliseconds and about 32 MiB. A process remembers its keys, shares one derivation between callers at the same moment, and forgets a failed one so it can try again.

Plaintext is sealed once at boot, after migrations, whatever the toggles say. It's also sealed on first read, for a token that appears later. Both use a compare-and-set update, so they can't overwrite keys another instance just saved. A failed attempt waits five minutes before the next. A Vercel preview never seals, and refuses to save keys, because it may share production's database and its own token would lock production out. `MIGRATE_ON_PREVIEW=true` doesn't change this: it says whether to migrate, not whether the database is separate.

The status comes from what's stored:

| Stored value | Token | Status | Result |
|---|---|---|---|
| Sealed | Matches | `sealed` | Keys work. |
| Sealed | Different | `token_different` | The app asks for the old token or the keys. One log line, no secret, no crash. |
| Sealed | Missing or too weak | `token_missing` | The app asks to restore the token, and warns that keys pasted without it are stored unencrypted. |
| Sealed | Key couldn't be derived | `unavailable` | The app says to reload. It doesn't blame the token. |
| Starts with `sealed.`, otherwise unreadable | Any, or none | `damaged` | Fails closed. It's never used as a key, or re-sealed. |
| Any | On a Vercel preview, when it can't be read or would need sealing | `preview` | Keys work if readable. Nothing is sealed or saved. |
| Plain | Usable | `sealed`, or `seal_failed` if the write failed | Keys work. `seal_failed` shows a warning. |
| Plain | Missing or too weak | `plain` | Keys work. **Settings** shows a warning, and the keys form warns before a save that it would be unencrypted. |
| Nothing | Any | `missing` | The not-configured path. |

Anything starting with `sealed.` counts as sealed, so a version this build doesn't know can't be read as a plain key. A real key starting that way round-trips when a token is set, and is refused without one.

While keys can't be opened, removing a member reports the Village departure as failed, and the admin can retry once keys work.

What this does and doesn't protect:

| Attacker has | Helps? | Why |
|---|---|---|
| A dump or read-only SQL access, taken after sealing | **Yes, for the Village secret only** | They can't call Village as this community from elsewhere, unless they guess the token. |
| A backup, disk image or WAL from before sealing | **No** | See below. |
| The same access, for anything else | **No** | Messages, emails and password hashes are all there. So is `auth_secret`, unless `BETTER_AUTH_SECRET` is set. With it and the `session` table, they can forge a session cookie and act as any member or admin in the app. |
| A forged admin session | **Partly** | They can spend credits through the app and replace the keys. They can't read the secret, because the UI only receives the public key. |
| Database write access | **No** | They can overwrite the value with their own plaintext key, and the app will use it. |
| The host's env settings, or code running on the server | **No** | They have the token and the database. |
| A leaked `SETUP_TOKEN` alone | **Yes, for the Village secret** | The sealed value is in the database. The token can still reset an admin password while email is off. |

**Sealing doesn't erase the old value.** A community that stored its key before this version keeps the plaintext in places the update can't reach: backups taken before the upgrade, and dead Postgres row versions and WAL on disk until they're vacuumed and recycled. A `pg_dump` taken after sealing is clean, but the disk may not be. If old backups or disk access are a concern, rotate the Village key in Village and paste the new one.

So this limits one thing: a database leak taken after sealing no longer hands over the fund's Village account. It doesn't make the database safe to leak.

`auth_secret` isn't sealed, because a changed token would sign everyone out, or lock them out if the token is gone. `BETTER_AUTH_SECRET` already exists for that separation. The group invite link isn't sealed yet, because `advanceNetwork` treats no group as "create one", so an unreadable link could produce a second group.

## Adding a module

Asks was the first module built on this structure. It has these files:

```text
src/modules/asks/
  manifest.ts  routes.ts  integration.ts  contract.ts  schema.ts  limits.ts
  service.ts   reads.ts   queries.ts      rules-*.ts  components/  asks.test.ts  AGENTS.md
```

```ts
// manifest.ts
export const asksManifest = {
  kind: MODULE_KINDS.toggleable,
  id: "asks",
  label: "Asks",
  description: "Members post what they need, and others step in.",
  icon: HandHelping,
  isOnByDefault: false,
  needsVillage: false,
  requires: [],
  navigation: [{ label: "Asks", href: ASKS_PAGE, icon: HandHelping, section: NAVIGATION_SECTIONS.primary, badge: "asks" }],
  adminTabs: [],
  paths: { pages: [ASKS_PAGE], api: [ASK_API_ROUTES.board] },
} satisfies ToggleableManifest;

// integration.ts
export const asksModule: ModuleIntegration = {
  manifest: asksManifest,
  readNavigationBadge: readNewOfferCount,
  onMemberBlocked: withdrawOffersBetween,
  onMemberRemoved: async (transaction, removal) => {
    if (!removal.keepsContent) await deleteMemberAsks(transaction, removal);
  },
};

// src/app/api/asks/create/route.ts
export const POST = asksRoutes.member("asks-create", createAskBodySchema, async (context, body) => {
  await enforceAskPostingLimit(context.database, context.member.id, ASK_POSTING_KINDS.ask);
  return Response.json(await createAsk(context, body));
});

// src/app/(app)/asks/page.tsx
export default modulePage(asksManifest, async function AsksPage({ searchParams }: AsksPageProps) { /* ... */ });
```

A module with no extras needs one line in `registry.ts`, a line in `ALLOWED_MODULE_IMPORTS` in `src/test/architecture/layers.ts`, and a generated migration. `drizzle.config.ts` finds the schema by glob. The tests for wrapping, ownership and 404-when-off cover the new module without any other change. `src/shell/navigation.test.ts` lists every primary nav label, so a module with a nav entry also adds its label there.

Some extras cost more than a line:

| If a module wants | It also needs | Why |
|---|---|---|
| A badge that updates without a page load | A query in `useLiveBadges` | Client code can't import the server registry. |
| Its own badge wording | A line in `BADGE_DESCRIPTIONS` | Otherwise it says "needs your attention". |
| Reportable content | A migration, a `REPORT_TARGETS` entry, a report function in `admin/service-reports.ts`, lines in `TARGET_DISPLAY`, `TARGET_FEATURES` and `DELETION_NOTES` in `report-queue.tsx`, and `REPORT_TARGET_NAMES` in `audit-log.tsx`. To be deletable from the queue, an entry in `CONTENT_DELETERS` too | `content_report_target_known` is a check constraint, and admin imports the module. |
| Audit log entries | Lines in `AUDIT_ACTIONS` and `ACTION_SENTENCES` | The list is a strict `z.enum`. |
| Content a removed member leaves behind | An `onMemberRemoved` hook, and a look at the copy in `remove-member-dialog.tsx` | The dialog says what happens to a member's content. |
| An action in another toggleable module | A function argument filled from `src/shell/`, or a slot | A module can't import a module it doesn't require. |
| An admin tab | A line in `ADMIN_TABS`, plus `adminTabs` in the manifest | The tab's badge reads facts from the shell. |
| A setup step | A line in `SETUP_STEP_OWNERS` and the checklist | No module has needed this yet. |

The phone tab bar holds five items. With more, the fifth becomes "More", a sheet with the rest, and its badge adds up theirs. Registry order decides what stays on the bar.

There's no scheduler in this deployment. Do work at read time, with `after()` if it shouldn't block the response, as intro expiry does.

## Tests

`src/test/architecture/boundaries.test.ts` builds the import graph with `ts.preProcessFile` and fails when:

- an import breaks the layer rules, or reaches another module's internals
- any file cycle exists
- any cycle between modules exists
- code loaded outside Next reaches `server-only` or the `@/` alias
- a module has no `AGENTS.md`
- a local import doesn't resolve, a file imports itself, or an import is computed, because the graph can't follow it
- `scripts/migrate.ts` doesn't start under plain Node

`schema-files.test.ts` fails when a file declares a table `drizzle.config.ts` doesn't load, or a table in the migrations has no loaded file. drizzle-kit would drop that table in the next migration.

`src/app/(app)/slot-wiring.test.ts` renders the layout and the network page, and fails when a slot provider goes missing.

`ownership.test.ts` imports every route, page and layout and fails when:

- a route handler didn't come from a route kit
- a route or page belongs to no manifest, or declares the wrong owner
- a route under `/api/admin` doesn't require an admin
- any route other than `/api/network/leave` uses `staysOpenWhenOff`
- a module folder has no registry line
- a module imports a toggleable module it doesn't list in `requires`

`disabled-modules.test.ts` turns each toggleable module off and calls everything it owns. New modules are covered automatically.

Route tests sit next to their module and call the real route handlers against a real database.

Tests have to hold up on a busy machine. Scrypt is the slow part of a test member, so `createSignedInMember` hashes once per run and creates the session directly. Wait for an outcome with `vi.waitFor` and `EVENTUALLY` from `src/test/async-timeouts.ts`, not a fixed sleep.

## Where new code goes

- A feature: `src/modules/<name>/`, with thin route files in `src/app/api/<name>/` and pages in `src/app/(app)/<name>/`.
- Something every feature needs, with no product opinion: `src/platform/`.
- Something that reads several modules for one screen: `src/shell/`.
- UI with no module knowledge: `src/components/`.
