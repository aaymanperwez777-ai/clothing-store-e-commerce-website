import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: 'https', hostname: 'encrypted-tbn0.gstatic.com' },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "reel-ref-try-the-look.vercel.app" },
    ],
  },
};

export default nextConfig;


