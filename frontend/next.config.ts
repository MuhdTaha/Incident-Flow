import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const frontendDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin to the frontend app dir (not ".."). In Docker WORKDIR is /app, so
  // parent would be / and Tailwind/Next resolve modules from the wrong root.
  outputFileTracingRoot: frontendDir,
  turbopack: {
    root: frontendDir,
  },
};

export default nextConfig;
