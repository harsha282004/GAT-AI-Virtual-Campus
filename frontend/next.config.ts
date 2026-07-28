import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disabled due to a known upstream React/Next.js dev-mode bug where the
  // *first* mount's effects aren't correctly double-invoked under Strict
  // Mode (https://github.com/vercel/next.js/issues/65655). That leaves
  // Framer Motion's mount-triggered `initial -> animate` transition stuck
  // at its SSR-baked `initial` state (e.g. opacity: 0) until a manual
  // refresh re-establishes a normal mount. Strict Mode's extra dev-only
  // checks never run in `next build`/`next start`, so this has zero effect
  // on production behavior.
  reactStrictMode: false,
  images: {
    // Only the logo/hero placeholders under public/ are SVGs we authored
    // ourselves — safe to allow through next/image with a locked-down CSP.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
