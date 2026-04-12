/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // better-sqlite3 is a native module — exclude from webpack bundling
      config.externals = [...(config.externals || []), 'better-sqlite3', 'pdf-parse', 'mammoth']
    }
    return config
  },
}
module.exports = nextConfig
