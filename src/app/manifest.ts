// Web app manifest: hiermee kan je Liftlog op je beginscherm zetten ("Zet op
// beginscherm") en opent het zonder adresbalk, zoals een app.
import type { MetadataRoute } from "next";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: "/app",
    display: "standalone",
    background_color: "#0f0f0f",
    theme_color: "#0f0f0f",
    lang: "nl",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
