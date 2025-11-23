import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    // Keep empty to avoid accidental cycles during debugging
    return []
  },
  // No special rewrites; marketing routes handled via modal
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'usjnxyedapxkymlwicju.supabase.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};
export default nextConfig;
