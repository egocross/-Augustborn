import { readFileSync } from "node:fs";

import type { NextConfig } from "next";

const envFiles = [".env.development.local", ".env.local", ".env.development", ".env"];

const appUrlFromEnvFile = () => {
  for (const file of envFiles) {
    try {
      const match = readFileSync(file, "utf8").match(/^\s*APP_URL\s*=\s*(.+)$/m);
      if (match) return match[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      // The file is optional; keep looking.
    }
  }
  return undefined;
};

// Public preview and tunnel hosts must be allowed explicitly, otherwise the dev
// server blocks /_next/* for them and the page never hydrates after a payment
// redirect back from Alipay.
const publicHost = (value?: string) => {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && url.hostname ? url.host : undefined;
  } catch {
    return undefined;
  }
};

const allowedDevOrigins = [
  ...(process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "").split(","),
  publicHost(process.env.APP_URL) ?? publicHost(appUrlFromEnvFile()) ?? "",
]
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
};

export default nextConfig;
