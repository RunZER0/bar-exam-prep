/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
};

export default nextConfig;
