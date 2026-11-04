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

export const nextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: { "/*": ["./drizzle/**/*"] },
  headers: async () => [{ source: "/:path*", headers: SECURITY_HEADERS }],
};

export default nextConfig;
