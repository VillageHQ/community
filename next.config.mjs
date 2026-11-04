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

const UPLOADED_IMAGE_CONTENT_SECURITY_POLICY = `default-src 'none'; sandbox; ${CONTENT_SECURITY_POLICY}`;

export const nextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: { "/*": ["./drizzle/**/*"] },
  headers: async () => [
    { source: "/:path*", headers: SECURITY_HEADERS },
    {
      source: "/api/branding/logo",
      headers: [{ key: "Content-Security-Policy", value: UPLOADED_IMAGE_CONTENT_SECURITY_POLICY }],
    },
  ],
  redirects: async () => [{ source: "/admin/village", destination: "/admin", permanent: false }],
};

export default nextConfig;
