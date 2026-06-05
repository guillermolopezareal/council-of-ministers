/** @type {import('next').NextConfig} */
const nextConfig = {
  // react-force-graph-2d is browser-only; handled via dynamic() with ssr:false.
  // No special webpack config needed when using that pattern.
  experimental: {
    // Allow server actions if needed in future
  },
}

module.exports = nextConfig
