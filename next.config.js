/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize PDFKit and ChartJS, but NOT canvas (Vercel needs to bundle it)
      config.externals = config.externals || [];
      config.externals.push(
        'pdfkit',
        'chartjs-node-canvas'
      );
      
      // Mark canvas as external for Next.js but allow Vercel to handle it
      if (process.env.VERCEL) {
        // On Vercel, don't externalize canvas
        config.externals = config.externals.filter(ext => ext !== 'canvas');
      } else {
        // In development/local, externalize canvas
        config.externals.push('canvas');
      }
    }
    return config;
  },
  // Ensure serverless functions have enough memory for canvas
  experimental: {
    serverComponentsExternalPackages: ['canvas'],
  },
}

module.exports = nextConfig

