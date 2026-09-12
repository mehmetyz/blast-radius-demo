import { execSync } from "node:child_process";
import type { NextConfig } from "next";

function gitSha(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  if (process.env.SERVICE_VERSION) return process.env.SERVICE_VERSION;
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  env: {
    SERVICE_VERSION: gitSha(),
  },
};

export default nextConfig;
