import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray lockfile in $HOME otherwise
  // confuses Turbopack's root inference).
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
