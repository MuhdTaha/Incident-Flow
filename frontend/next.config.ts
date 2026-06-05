import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Monorepo has a root package-lock.json; pin tracing/turbopack to frontend.
  outputFileTracingRoot: path.join(frontendDir, ".."),
  turbopack: {
    root: frontendDir,
  },
};

export default nextConfig;
