import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Support for GitHub Pages static export
  output: process.env.NEXT_EXPORT === 'true' ? 'export' : undefined,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',
  trailingSlash: true,
  images: {
    unoptimized: true, // Required for static export
  },
  // Headers only work in server mode, not in static export
  // For static export, headers are set via meta tags in layout.tsx
  ...(process.env.NEXT_EXPORT !== 'true' && {
    headers() {
      // Required by FHEVM 
      return Promise.resolve([
        {
          source: '/',
          headers: [
            {
              key: 'Cross-Origin-Opener-Policy',
              value: 'same-origin',
            },
            {
              key: 'Cross-Origin-Embedder-Policy',
              value: 'require-corp',
            },
          ],
        },
      ]);
    }
  }),
};

export default nextConfig;

