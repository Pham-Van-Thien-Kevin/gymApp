// robots.txt: wat zoekmachines mogen bezoeken. De publieke pagina's wel, de
// persoonlijke delen (/app, /trainer) en technische routes niet.
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/login", "/register"], disallow: ["/app", "/trainer", "/auth"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
