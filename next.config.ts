import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages use native bindings / dynamic requires (WASM workers,
  // native canvas, PDF parsing) that Next's server bundler shouldn't try
  // to trace and bundle — run them as plain Node `require`s instead.
  serverExternalPackages: ["tesseract.js", "pdf-parse", "@napi-rs/canvas", "@anthropic-ai/sdk", "mongoose"],
};

export default nextConfig;
