import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent browser from MIME-sniffing the response
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  // Anti-clickjacking protection
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  // Force HTTPS for 2 years including subdomains and preloading (HSTS)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Protect referrer leakage across origins
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  // DNS prefetching optimization
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  // Disable Flash/PDF cross-domain policy execution
  {
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none",
  },
  // Legacy XSS filter protection for older browsers
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  // Window opener isolation while permitting OAuth and payment popups
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
  // Restrict sensitive browser APIs & permissions
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(self 'https://sdk.cashfree.com')",
  },
  // Hardened Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self';",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http: https://sdk.cashfree.com https://www.youtube.com https://accounts.google.com https://apis.google.com;",
      "style-src 'self' 'unsafe-inline' https: http: https://fonts.googleapis.com https://accounts.google.com;",
      "font-src 'self' data: https: http: https://fonts.gstatic.com;",
      "img-src 'self' data: blob: https: http:;",
      "connect-src 'self' https: http: wss: ws: https://accounts.google.com https://api.zelton.co.in https://sdk.cashfree.com;",
      "frame-src 'self' https: http: https://www.youtube.com https://sdk.cashfree.com https://accounts.google.com;",
      "object-src 'none';",
      "base-uri 'self';",
      "form-action 'self' https: http:;",
      "frame-ancestors 'self';",
    ].join(" "),
  },
];

const nextConfig: NextConfig = {
  // Hide Next.js fingerprinting to prevent attacker tech-stack reconnaissance
  poweredByHeader: false,
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "api.zelton.co.in" },
      { protocol: "https", hostname: "www.api.zelton.co.in" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "via.placeholder.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
