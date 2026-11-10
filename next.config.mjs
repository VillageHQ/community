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
    { source: "/join/:token", headers: SECRET_LINK_HEADERS },
    { source: "/meet/:token", headers: SECRET_LINK_HEADERS },
    { source: "/confirm-email", headers: SECRET_LINK_HEADERS },
    { source: "/reset-password", headers: SECRET_LINK_HEADERS },
    { source: "/sign-in/link", headers: SECRET_LINK_HEADERS },
  ],
  redirects: async () => [
    { source: "/admin/village", destination: "/admin", permanent: false },
    { source: "/feed", destination: "/", permanent: false },
  ],
};

export default nextConfig;
