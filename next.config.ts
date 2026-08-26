import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the file-tracing root to this project. A stray lockfile in $HOME otherwise
  // makes Next infer the home directory as the workspace root and trace unrelated files.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
