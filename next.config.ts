import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These resolve native binaries relative to their own install path, so they must not be bundled.
  serverExternalPackages: ["ffmpeg-static", "@ffprobe-installer/ffprobe", "sharp"],
  poweredByHeader: false,
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
