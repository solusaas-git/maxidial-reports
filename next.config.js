/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Alias 'canvas' to our compatibility layer that uses @napi-rs/canvas
      config.resolve.alias = {
        ...config.resolve.alias,
        'canvas': path.resolve(__dirname, 'lib/canvas-compat.ts'),
      };
      
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

