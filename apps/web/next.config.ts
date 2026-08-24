import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const networkHosts = Object.values(networkInterfaces())
  .flatMap((addresses) => addresses ?? [])
  .filter((address) => address.family === "IPv4" && !address.internal)
  .map((address) => address.address);
const configuredHosts = (process.env.CYBERSCRY_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);
const allowedNetworkHosts = [...new Set([...networkHosts, ...configuredHosts])];

const config: NextConfig = {
  transpilePackages: ["@cyberscry/database"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  allowedDevOrigins: allowedNetworkHosts,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
      allowedOrigins: allowedNetworkHosts,
    },
  },
};

export default config;
