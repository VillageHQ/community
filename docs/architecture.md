# Architecture

The app is one Next.js deployment made of feature modules on a shared platform. Tests enforce the boundaries.

## The tree

```text
src/
  app/          Pages and route handlers. They parse, call one thing, and respond.
  shell/        Code that knows several modules: navigation, badges, setup progress,
                next steps, onboarding, the app shell UI.
  modules/
    members/    Core. Directory, profiles, invites, LinkedIn claim, blocks.
    feed/       Posts, replies, reactions, pins.
    messages/   Direct messages.
    network/    Village search, sync, group, paths, credits.
    intros/     Warm intros. Needs network.
    admin/      Core. Roster, reports, audit view, health.
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
members <- messages, feed, network
network <- intros
all     <- admin
```

`shell` exists because `navigation-badges`, `admin-setup` and `next-steps` each read several modules. They have to sit above all of them.

## File roles in a module

A public file may be imported by a higher module. `src/app` and `src/shell` may import any file in a module. A role can take a topic: `service-invites.ts`, `reads-credits.ts`, `contract-profile.ts`.

| File | Role | Public |
|---|---|---|
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

- **Blocks.** `setMemberBlocked(context, body, onBlocked)` runs the effect in its own transaction. The block route passes the intros effect that closes open asks.
- **Open asks.** `readMemberPaths(context, slug, readOpenAsks)` takes the reader as an argument. The paths route passes the one from intros.

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

`createMemberRoute` in `platform/village/member-routes.ts` handles origin, session, admin check, body limit and Zod parsing. It's built from two parts:

- `platform/http/member-route.ts`: the generic wrapper, which takes a list of error responders.
- `platform/village/route-errors.ts`: turns Village failures into friendly responses.

A service throws `RequestError` to send a status and code. The wrapper turns it into a response.

## Tests

`src/test/architecture/boundaries.test.ts` builds the import graph with `ts.preProcessFile` and fails when:

- an import breaks the layer rules, or reaches another module's internals
- any file cycle exists
- any cycle between modules exists
- code loaded outside Next reaches `server-only` or the `@/` alias
- a module has no `AGENTS.md`

Route tests sit next to their module and call the real route handlers against a real database.

Tests have to hold up on a busy machine. Scrypt is the slow part of a test member, so `createSignedInMember` hashes once per run and creates the session directly. Wait for an outcome with `vi.waitFor` and `EVENTUALLY` from `src/test/async-timeouts.ts`, not a fixed sleep.

## Where new code goes

- A feature: `src/modules/<name>/`, with thin route files in `src/app/api/<name>/` and pages in `src/app/(app)/<name>/`.
- Something every feature needs, with no product opinion: `src/platform/`.
- Something that reads several modules for one screen: `src/shell/`.
- UI with no module knowledge: `src/components/`.
