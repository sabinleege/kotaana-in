import type { MetadataRoute } from "next";

/** Lets people add Kotaana to their phone's home screen and open it like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kotaana — Train. Track. Achieve.",
    short_name: "Kotaana",
    description: "Daily workouts, nutrition and health tracking built around you and your coach.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#090a0c",
    theme_color: "#ff6b00",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
