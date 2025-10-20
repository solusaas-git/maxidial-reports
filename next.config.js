/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // On Vercel, don't externalize anything - let webpack bundle and use postinstall
      // Locally, externalize for faster dev builds
      if (!process.env.VERCEL) {
        config.externals = config.externals || [];
        if (Array.isArray(config.externals)) {
          config.externals.push('canvas');
        }
      }
      
      // Copy PDFKit font files to the output directory
      config.module.rules.push({
        test: /\.afm$/,
        type: 'asset/resource',
        generator: {
          filename: 'static/fonts/[name][ext]'
        }
      });
    }
    return config;
  },
}

module.exports = nextConfig

