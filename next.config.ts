import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libSQL ships native bindings for local file DBs; keep it out of the bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
  poweredByHeader: false,
};

export default nextConfig;
