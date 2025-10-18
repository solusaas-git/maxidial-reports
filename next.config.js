/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize PDFKit, Canvas, and ChartJS to prevent webpack bundling issues
      config.externals = config.externals || [];
      config.externals.push(
        'canvas',
        'pdfkit',
        'chartjs-node-canvas'
      );
    }
    return config;
  },
}

module.exports = nextConfig

