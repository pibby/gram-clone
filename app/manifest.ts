import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Installable app manifest. The share target lets you share photos/videos to the site
// from Android's share sheet (e.g. Google Photos) once it's installed ("Add to Home screen").
export default function manifest(): MetadataRoute.Manifest & { share_target?: unknown } {
  return {
    name: site.name,
    short_name: site.name,
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: { files: [{ name: "media", accept: ["image/*", "video/*"] }] },
    },
  };
}
