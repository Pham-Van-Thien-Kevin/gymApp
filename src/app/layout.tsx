// Server Component: de root layout heeft geen interactiviteit nodig en rendert
// alleen de <html>-structuur, het lettertype en de globale CSS.
import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import { APP_DESCRIPTION, APP_NAME, SITE_URL } from "@/lib/config";
import { themeScript } from "@/components/theme/theme";
import "./globals.css";

// next/font downloadt het lettertype tijdens de build en serveert het zelf:
// geen request naar Google bij elke pageview en geen layout-verspringing.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // metadataBase maakt relatieve URLs (zoals de preview-afbeelding) absoluut.
  metadataBase: new URL(SITE_URL),
  title: { default: `${APP_NAME}: powerlift tracker voor sporter en coach`, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: ["powerlifting", "krachttraining", "RPE", "squat", "bench press", "deadlift", "trainingslogboek", "coach", "schema"],
  // Open Graph = de preview als je de link deelt (WhatsApp, Instagram, LinkedIn, …).
  openGraph: { type: "website", locale: "nl_BE", siteName: APP_NAME, url: "/", title: APP_NAME, description: APP_DESCRIPTION },
  twitter: { card: "summary_large_image", title: APP_NAME, description: APP_DESCRIPTION },
};

export const viewport: Viewport = {
  // Kleur van de adresbalk op mobiel, per systeemthema.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0f" },
    { media: "(prefers-color-scheme: light)", color: "#f6f6f1" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning op <html>: het themascript zet data-theme vóór React
    // laadt, dus de browser-HTML wijkt bewust af van die van de server.
    <html lang="nl" className={`${spaceGrotesk.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* suppressHydrationWarning: extensies zoals ColorZilla zetten eigen
          attributen op <body> (bv. cz-shortcut-listen) vóór React laadt. Dat geeft
          een onschuldige "hydration mismatch". Dit geldt enkel voor de attributen
          van <body> zelf, niet voor wat erin staat. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
