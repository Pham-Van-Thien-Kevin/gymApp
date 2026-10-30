// De preview-afbeelding als je een link deelt (1200×630). ImageResponse tekent
// JSX naar een PNG tijdens de build; geen los bestand om bij te houden.
import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/config";

export const alt = `${APP_NAME}: powerlift tracker voor sporter en coach`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0f0f0f", color: "#ecece4" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, fontWeight: 700, letterSpacing: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: "#d7ff3a" }} />
          {APP_NAME.toUpperCase()}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, maxWidth: 950 }}>Train volgens schema. Zie wat je echt kan.</div>
          <div style={{ marginTop: 28, fontSize: 32, opacity: 0.7 }}>Squat · Bench · Deadlift · RPE · Coach</div>
        </div>
        <div style={{ display: "flex", height: 14, width: 260, borderRadius: 7, background: "#d7ff3a" }} />
      </div>
    ),
    size,
  );
}
