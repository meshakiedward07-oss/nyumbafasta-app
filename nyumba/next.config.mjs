/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,

  // Skip lint/type checks during build — tsc and eslint run separately in CI
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '*.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    deviceSizes: [390, 430, 640, 750, 828, 1080, 1200],
    imageSizes: [48, 64, 96, 128, 256],
  },

  // sharp must be external so Vercel doesn't try to bundle the native binary
  serverExternalPackages: ['sharp'],

  experimental: {
    // Tree-shake this package so only used functions are bundled.
    // (lucide-react and @tabler/icons-react were listed here previously but
    // aren't installed dependencies — this app uses @tabler/icons-webfont,
    // a CSS webfont, which optimizePackageImports doesn't apply to anyway.)
    optimizePackageImports: ['@supabase/supabase-js'],
  },

  async headers() {
    return [
      {
        // Security headers kwa routes zote
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), autoplay=*, fullscreen=*',
          },
          // HTTPS enforcement — browsers refuse HTTP for 1 year (incl. subdomains)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // Content-Security-Policy — locks down where scripts/styles/connections can load from.
          // 'unsafe-inline' + 'unsafe-eval' on script-src are required by Next.js 14 App Router
          // hydration; everything else is tightly scoped to known origins.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // ESRI satellite tiles + OSM street tiles + Leaflet CDN marker icons
              "img-src 'self' data: blob: https://res.cloudinary.com https://*.cloudinary.com https://*.supabase.co https://images.unsplash.com https://*.arcgisonline.com https://*.tile.openstreetmap.org https://cdnjs.cloudflare.com",
              "font-src 'self' https://fonts.gstatic.com",
              // media-src: required for Supabase Storage AND Cloudinary video ads
              "media-src 'self' https://*.supabase.co https://res.cloudinary.com https://*.cloudinary.com blob:",
              // Geoapify geocoding/autocomplete API
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.resend.com https://api.cloudinary.com https://api.geoapify.com",
              "worker-src 'self' blob:",
              // Admin panel embeds dalali business-license PDFs (raw Cloudinary
              // uploads) inline via <iframe> instead of linking out to them.
              "frame-src 'self' https://res.cloudinary.com https://*.cloudinary.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        ],
      },
      {
        // Long-term cache kwa static assets za Next.js
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Long-term cache for public/ images (logos, icons, placeholders)
        source: '/(.*\\.(?:jpg|jpeg|png|gif|ico|svg|webp|avif|woff2|woff))',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

export default nextConfig
