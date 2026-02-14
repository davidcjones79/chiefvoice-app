import type { NextConfig } from "next";

// Check if building for iOS or Tauri (static export)
const isStaticBuild = process.env.BUILD_TARGET === 'ios' || process.env.TAURI_ENV_PLATFORM !== undefined;

const nextConfig: NextConfig = {
  compress: true,
  // Exclude backend from file tracing
  outputFileTracingExcludes: {
    '*': ['./backend/**', './backend/venv/**']
  },
  // Turbopack configuration (Next.js 16+)
  turbopack: {
    resolveAlias: {},
  },
  // Exclude backend from webpack/turbopack
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/backend/**', '**/venv/**'],
    };
    return config;
  },

  // Static export settings (for iOS/Tauri builds)
  ...(isStaticBuild && {
    output: 'export',
    distDir: 'out',
    images: { unoptimized: true },
    trailingSlash: true,
  }),
};

export default nextConfig;
