import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JijiSwipe",
    short_name: "JijiSwipe",
    description: "Build better outfits from the clothes you already own.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#2864f0",
    orientation: "portrait",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
