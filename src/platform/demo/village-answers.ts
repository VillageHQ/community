import { DEMO_OUTSIDERS, DEMO_PEOPLE, toDemoEmail, toDemoSlug, type DemoOutsider, type DemoPerson } from "./people.ts";
import { toDemoDomain, toDemoFaceUrl, toDemoLogoUrl } from "./pictures.ts";

// Canned, made-up Village answers for demo mode, in the shapes Village's API uses. No key is checked and nothing is
// stored: every member is connected and synced, search returns the same invented people, every path runs through
// a demo member who shares their network, and the profile fill-in finds each demo member with a portrait and a drawn logo.

const TOKEN_PREFIX = "demo-token.";
const TIMESTAMP = "2026-01-01T00:00:00.000Z";
const REQUEST_ID = "req_demo";
const LINKEDIN_PREFIX = "https://www.linkedin.com/in/";
const GROUP = { id: "00000000-0000-4000-8000-00000000d3e0", name: "Northwind Founders", inviteLink: "https://village.demo.invalid/join/northwind" };

export const DEMO_VILLAGE_KEYS = { publicKey: "pk_demo_northwind", secretKey: "sk_demo_northwind_made_up" };
export const DEMO_VILLAGE_GROUP = GROUP;

const CONNECTORS = DEMO_PEOPLE.filter(({ sharesNetwork }) => sharesNetwork);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function data(body: unknown, metadata: object = {}) {
  return json(200, { data: body, metadata: { request_id: REQUEST_ID, ...metadata } });
}

function notFound() {
  return json(404, {
    error: { type: "not_found", title: "Not found", status: 404, detail: "Nobody by that name in the demo.", trace_id: "trace_demo" },
    metadata: { request_id: REQUEST_ID, timestamp: TIMESTAMP },
  });
}

function readField(body: unknown, field: string) {
  if (typeof body !== "object" || body === null) return "";
  const value = (body as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

function encodeCaller(externalId: string, email: string) {
  return `${TOKEN_PREFIX}${Buffer.from(JSON.stringify([externalId, email])).toString("base64url")}`;
}

function readCallerEmail(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith(`Bearer ${TOKEN_PREFIX}`)) return null;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(authorization.slice(`Bearer ${TOKEN_PREFIX}`.length), "base64url").toString());
    return Array.isArray(decoded) && typeof decoded[1] === "string" ? decoded[1] : "";
  } catch {
    return "";
  }
}

function splitName(name: string) {
  const [first = "", ...rest] = name.split(" ");
  return { first_name: first, last_name: rest.join(" ") };
}

function toSearchPerson(person: DemoOutsider, index: number) {
  return {
    id: index + 1,
    ...splitName(person.name),
    full_name: person.name,
    linkedin_url: `${LINKEDIN_PREFIX}${person.slug}`,
    headline: `${person.title} at ${person.company}`,
    about_me: null,
    location: { city: person.location, state: null, country: null },
    work_relevant: {
      title: person.title,
      start_date: TIMESTAMP,
      end_date: null,
      company: { id: index + 1, name: person.company, domain: toDemoDomain(person.company), image_url: toDemoLogoUrl(person.company) },
    },
    education_relevant: null,
    image_url: toDemoFaceUrl(person.name),
    relationship_cached: { id: `relationship-${index}`, linkedin_identifier: person.slug, paths: { count: 1, avatars: [], team_only: false }, warmth_score: 2 },
    last_enrichment_at: TIMESTAMP,
  };
}

function readSlug(linkedinUrl: string) {
  return linkedinUrl.replace(/\/+$/, "").split("/in/")[1]?.split(/[/?#]/)[0] ?? "";
}

// Picks the same connector for the same target every time, so the demo tells one story per person.
function pickConnector(slug: string, callerEmail: string) {
  const candidates = CONNECTORS.filter((person) => !callerEmail.startsWith(`${person.key}@`));
  const hash = [...slug].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return candidates[hash % candidates.length] ?? CONNECTORS[0];
}

function toPaths(linkedinUrl: string, callerEmail: string) {
  const slug = readSlug(linkedinUrl);
  const outsider = DEMO_OUTSIDERS.find((person) => person.slug === slug);
  const target = outsider ?? DEMO_PEOPLE.find((person) => toDemoSlug(person) === slug);
  if (!target) return null;
  const connector = pickConnector(slug, callerEmail);
  if (!connector) return null;
  const connectorProfile = {
    ...splitName(connector.name),
    linkedin_url: `${LINKEDIN_PREFIX}${toDemoSlug(connector)}`,
    headline: `${connector.title} at ${connector.company}`,
    avatar: toDemoFaceUrl(connector.name),
    title: connector.title,
    company: connector.company,
  };
  const why = `${connector.name.split(" ")[0]} worked with ${target.name.split(" ")[0]} for two years and they still talk.`;
  return {
    person: { linkedin_url: linkedinUrl, avatar: toDemoFaceUrl(target.name), village_url: "", ...splitName(target.name), full_name: target.name, headline: `${target.title} at ${target.company}` },
    summary: { score: 2, score_label: "Strong", description: `A warm path through ${connector.name}.` },
    count: 1,
    paths: [
      {
        degree: 2,
        summary: { score: 2, score_label: "Strong", description: why },
        introducer: { profile: connectorProfile, score: 2, score_label: "Strong", score_meta: [{ title: "Worked together", description: why }] },
        starters: [
          {
            profile: { first_name: "You", last_name: "", linkedin_url: "", headline: "", avatar: "", title: "", company: "" },
            score: 2,
            score_label: "Strong",
            score_description: "Strong",
            score_meta: [{ title: "Same community", description: `You're both in ${GROUP.name}.` }],
            is_current_user: true,
          },
        ],
        score_meta: [],
      },
    ],
  };
}

// The public profile the fill-in finds for a demo member: their own card, with a portrait and a drawn company logo.
export function toDemoProfile(person: DemoPerson) {
  return {
    full_name: person.name,
    linkedin_url: `${LINKEDIN_PREFIX}${toDemoSlug(person)}`,
    avatar: toDemoFaceUrl(person.name),
    headline: `${person.title} at ${person.company}`,
    location: { city: person.location, state: null, country: null },
    work_relevant: {
      title: person.title,
      start_date: TIMESTAMP,
      end_date: null,
      company: { id: null, name: person.company, domain: toDemoDomain(person.company), image_url: toDemoLogoUrl(person.company) },
    },
    work_history: [],
    last_enrichment_at: TIMESTAMP,
  };
}

function findDemoPerson(body: unknown) {
  const email = readField(body, "email").toLowerCase();
  const slug = readSlug(readField(body, "linkedin_url"));
  return DEMO_PEOPLE.find((person) => (email && toDemoEmail(person) === email) || (slug && toDemoSlug(person) === slug)) ?? null;
}

async function readBody(request: Request): Promise<unknown> {
  const text = await request.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function answerDemoVillage(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname;
  const body = request.method === "GET" ? null : await readBody(request);

  if (path === "/v2/auth/tokens") {
    const token = encodeCaller(readField(body, "external_user_id"), readField(body, "email"));
    return data({ token, token_type: "Bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600 });
  }
  const callerEmail = readCallerEmail(request);
  if (callerEmail === null) return json(401, { error: { type: "authentication_error", title: "Demo", status: 401, detail: "demo", trace_id: "trace_demo" } });

  switch (path) {
    case "/v2/app":
      return data({ title: GROUP.name, description: "Demo", domain_name: "northwind.example", logo: null, public_key: DEMO_VILLAGE_KEYS.publicKey, is_active: true });
    case "/v2/user/status":
      return data({
        status: "ready",
        email: callerEmail || null,
        integrations: [{ id: 1, type: "linkedin", status: "synced", account: null, last_synced_at: TIMESTAMP }],
        network_updated_at: TIMESTAMP,
      });
    case "/v2/groups":
      return request.method === "GET"
        ? data({ groups: [{ id: GROUP.id, name: GROUP.name, logo: null, invite_link: GROUP.inviteLink, is_admin: true }] })
        : json(201, { data: { id: GROUP.id, name: GROUP.name, logo: null, invite_link: GROUP.inviteLink }, metadata: { request_id: REQUEST_ID } });
    case "/v2/groups/join":
      return data({ success: true, message: "Joined" });
    case "/v2/groups/leave":
      return data({ success: true, message: "Left" });
    case "/v2/people/search":
      return json(200, {
        data: DEMO_OUTSIDERS.map(toSearchPerson),
        metadata: {
          request_id: REQUEST_ID,
          mode: "simple",
          source: "network",
          network_stage_complete: true,
          generated_sql: "",
          search_engine: "demo",
          screening_criteria: [],
          counts_token: "",
          search_execution_token: "",
        },
        pagination: { cursor: "", has_next_page: false, count: DEMO_OUTSIDERS.length },
      });
    case "/v2/people/paths": {
      const paths = toPaths(readField(body, "linkedin_url"), callerEmail);
      return paths ? data(paths, { counts: { total: { value: paths.paths.length } } }) : notFound();
    }
    case "/v2/people/enrich":
    case "/v2/people/enrich/by-email": {
      const person = findDemoPerson(body);
      return person ? data(toDemoProfile(person)) : notFound();
    }
    default:
      return notFound();
  }
}
