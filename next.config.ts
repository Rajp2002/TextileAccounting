import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  turbopack: {},
};

export default withSentryConfig(withPWA(nextConfig), {
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
});
