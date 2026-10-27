// Haalt het ID uit een Google Sheets-deellink:
// "https://docs.google.com/spreadsheets/d/ABC123…/edit#gid=0" → "ABC123…".
// Apart bestand (geen "use server"), zodat het ook in tests te gebruiken is.
export function extractSheetId(link: string): string | null {
  return link.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/)?.[1] ?? null;
}

export function exportUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
}
