/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // DO NOT externalize canvas, pdfkit, or chartjs-node-canvas on Vercel
      // Let webpack bundle them with the serverless function
      if (!process.env.VERCEL) {
        // Only externalize in local development
        config.externals = config.externals || [];
        config.externals.push(
          'canvas',
          'pdfkit',
          'chartjs-node-canvas'
        );
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

