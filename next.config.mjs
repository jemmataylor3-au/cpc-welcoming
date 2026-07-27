/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Supabase's realtime (websocket) feature isn't used in this app, but
  // its code gets pulled into the Edge Runtime middleware bundle anyway,
  // where it references Node-only globals (__dirname etc.) that don't
  // exist in that environment and crash at runtime. Excluding it here
  // avoids bundling code we never call.
  webpack: (config, { nextRuntime }) => {
    if (nextRuntime === "edge") {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@supabase/realtime-js": false,
      };
    }
    return config;
  },
};

export default nextConfig;
