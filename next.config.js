/** @type {import('next').NextConfig} */
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
    }
    return config;
  },
}

module.exports = nextConfig

