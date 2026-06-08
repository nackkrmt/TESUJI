import type { NextConfig } from "next";

const supabaseStorageHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseStorageHost
      ? [
          {
            protocol: "https",
            hostname: supabaseStorageHost,
            pathname: "/storage/v1/object/public/tournament-banners/**",
          },
          {
            protocol: "https",
            hostname: supabaseStorageHost,
            pathname: "/storage/v1/object/sign/slips/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
