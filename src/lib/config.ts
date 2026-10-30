// Centrale plek voor de app-naam: pas hem hier aan en hij verandert overal.
export const APP_NAME = "Liftlog";
export const APP_DESCRIPTION =
  "Powerlift tracker voor sporter en coach: log je sets met RPE-voorstellen en schijvencalculator, volg je squat, bench en deadlift, en werk het schema van je coach af.";

/**
 * Publieke URL van de site, voor absolute links in metadata, sitemap en de
 * preview-afbeelding. Volgorde: zelf ingesteld (NEXT_PUBLIC_SITE_URL), dan de
 * productie-URL die Vercel automatisch meegeeft, en anders lokaal.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");
