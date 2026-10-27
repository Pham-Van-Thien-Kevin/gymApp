import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components staat bewust uit: elke pagina in deze app hangt af van de
  // ingelogde gebruiker (cookies), dus er valt niets statisch te prerenderen.
  // Zonder deze vlag is een pagina die cookies leest gewoon dynamisch.
  cacheComponents: false,
  // Het zwevende dev-icoontje van Next.js valt op mobiel over de tabbalk en op
  // desktop over de zijbalk. Fouten verschijnen nog steeds in de dev-overlay.
  devIndicators: false,
  // Enkel in development: Next.js laat zijn dev-scripts standaard alleen via
  // "localhost" laden. Lokale Supabase stuurt mails en redirects naar
  // 127.0.0.1:3000, dus dat adres moet ook volledig werken.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      // Een .xlsx-upload gaat via een Server Action. De standaardlimiet is 1 MB;
      // Google Sheets-exports met veel tabs kunnen groter zijn.
      bodySizeLimit: "5mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
