const CONTENT_SECURITY_POLICY = [
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const SECRET_LINK_HEADERS = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex" },
];

const UPLOADED_IMAGE_CONTENT_SECURITY_POLICY = `default-src 'none'; sandbox; ${CONTENT_SECURITY_POLICY}`;

// The website widget's frame is the only page any site may frame. Its route sets its own policy (frame-ancestors *),
// so the framing rules above skip that one path and every other path keeps them.
const WIDGET_FRAME_PATH = "/api/job-board/embed";
const EVERY_PATH_BUT_THE_WIDGET_FRAME = "/:path((?!api/job-board/embed$).*)";

const WIDGET_FRAME_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors *",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
];

// /perks frames BuiltFirst's marketplace, so that page (and the admin's preview) may frame BuiltFirst and nothing else.
// Kept in step with PERKS_FRAME_SOURCES in src/modules/perks/contract.ts.
const PERKS_CONTENT_SECURITY_POLICY = `frame-src https://builtfirst.com https://*.builtfirst.com; ${CONTENT_SECURITY_POLICY}`;

const BUILD_OUTPUT = process.env.COMMUNITY_STANDALONE_BUILD === "true" ? "standalone" : undefined;

export const nextConfig = {
  output: BUILD_OUTPUT,
  poweredByHeader: false,
  outputFileTracingIncludes: { "/*": ["./drizzle/**/*"] },
  headers: async () => [
    { source: EVERY_PATH_BUT_THE_WIDGET_FRAME, headers: SECURITY_HEADERS },
    { source: WIDGET_FRAME_PATH, headers: WIDGET_FRAME_HEADERS },
    {
      source: "/api/branding/logo",
      headers: [{ key: "Content-Security-Policy", value: UPLOADED_IMAGE_CONTENT_SECURITY_POLICY }],
    },
    {
      source: "/api/members/:memberId/avatar",
      headers: [{ key: "Content-Security-Policy", value: UPLOADED_IMAGE_CONTENT_SECURITY_POLICY }],
    },
    { source: "/perks", headers: [{ key: "Content-Security-Policy", value: PERKS_CONTENT_SECURITY_POLICY }] },
    { source: "/admin/perks", headers: [{ key: "Content-Security-Policy", value: PERKS_CONTENT_SECURITY_POLICY }] },
    { source: "/join/:token", headers: SECRET_LINK_HEADERS },
    { source: "/meet/:token", headers: SECRET_LINK_HEADERS },
    { source: "/confirm-email", headers: SECRET_LINK_HEADERS },
    { source: "/reset-password", headers: SECRET_LINK_HEADERS },
    { source: "/sign-in/link", headers: SECRET_LINK_HEADERS },
  ],
  redirects: async () => [
    { source: "/feed", destination: "/", permanent: false },
    // Demo faces moved from drawn .svg to .webp portraits; a demo seeded before that keeps the old links until its reset.
    { source: "/demo/faces/:name([a-z0-9-]+)\.svg", destination: "/demo/faces/:name.webp", permanent: true },
    // Search took Founderhall's address; old links and bookmarks (and their ?q=) land on it.
    { source: "/network", destination: "/search", permanent: true },
  ],
};

export default nextConfig;
