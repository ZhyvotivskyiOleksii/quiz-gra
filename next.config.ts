import type {NextConfig} from 'next';
import crypto from 'crypto';

// Generate a stable build ID based on timestamp (changes on each deploy)
const generateBuildId = () => {
  return crypto.randomBytes(8).toString('hex');
};

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  outputFileTracingRoot: __dirname,
  
  // Generate unique build ID for each deployment
  generateBuildId: async () => {
    return process.env.BUILD_ID || generateBuildId();
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
      {
        protocol: 'https',
        hostname: 'gateway.score-buster.dev.royal-gambit.io',
        port: '',
        pathname: '/**',
      },
    ],
  },
  turbopack: {
    root: __dirname,
  },
};
export default nextConfig;
