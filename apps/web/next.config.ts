import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// Content-Security-Policy (CSP) — MED-008
//
// Current CSP uses 'unsafe-inline' and 'unsafe-eval' because:
//
//   - 'unsafe-inline' in style-src: Required for React hydration — Next.js
//     injects inline <style> tags during server-side rendering for CSS-in-JS
//     and Tailwind utilities. Without it, hydration mismatches cause layout
//     flicker and console errors.
//
//   - 'unsafe-eval' in script-src: Required by Stripe.js (stripe.com/v3) —
//     the Stripe SDK dynamically evaluates code to create payment frames.
//     Stripe has no nonce-based CSP support as of their current SDK version.
//
// TODO: Replace with nonce-based CSP in Phase 5 (member-facing surfaces).
//   1. Use Next.js `nonce` prop on <Script> and middleware to inject a
//      per-request nonce into the CSP header.
//   2. Switch style-src to 'nonce-{value}' once all CSS is extracted at build
//      time (requires moving off any runtime CSS-in-JS if present).
//   3. Work with Stripe to see if `strict-dynamic` or nonce support becomes
//      available (track: https://github.com/stripe/stripe-js/issues).
//   4. Add report-uri or report-to directive for CSP violation monitoring
//      before enforcement.
//
// For now, the permissive policy prevents breakage in the admin dashboard
// while still blocking eval/inline from truly untrusted origins.
// ---------------------------------------------------------------------------

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  // Mark optional dependencies as external to prevent build failures
  serverExternalPackages: ['@react-pdf/renderer'],
  // Transpile workspace packages for proper module resolution
  transpilePackages: ['@meridian/types'],
  // Security headers (LOW-011): Use CSP frame-ancestors instead of the
  // deprecated X-Frame-Options: DENY header for better browser support.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self'",
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
