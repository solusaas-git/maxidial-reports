/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Always externalize canvas (native module)
      // Vercel will include the pre-built binaries via includeFiles
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('canvas');
      }
      
      // Don't externalize pdfkit and chartjs-node-canvas - let webpack bundle them
      // but canvas must be external since it's a native addon
      
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

