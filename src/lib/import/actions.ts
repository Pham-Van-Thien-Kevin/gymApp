"use server";
// Server Actions van de import. Ze draaien op de server omdat:
// 1. de server de Google Sheet kan downloaden (de browser mag dat niet, CORS);
// 2. we het bestand opnieuw parsen bij "Bevestigen" i.p.v. de preview uit de
//    browser te vertrouwen: de browser stuurt enkel de keuzes (datums, koppelingen).
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { getExercises, getMemberActivity } from "@/lib/data";
import { addDays, startOfWeek } from "@/lib/dates";
import { isUuid } from "@/lib/parse";
import { createClient } from "@/lib/supabase/server";
import { buildPayload } from "./build-payload";
import { defaultChoices, findUnknownNames, type ImportChoices, type LibraryExercise, type UnknownName } from "./matching";
import { parseWorkbook } from "./parser";
import { exportUrl, extractSheetId } from "./sheet-link";
import type { ParsedWorkbook } from "./types";

const MAX_BYTES = 10 * 1024 * 1024;

export type ImportPreview = {
  label: string;
  workbook: ParsedWorkbook;
  unknown: UnknownName[];
  library: LibraryExercise[];
  defaults: ImportChoices;
};

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Mag de ingelogde gebruiker voor deze member importeren? (zichzelf, of trainer van de cliënt) */
async function checkAccess(memberId: unknown): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile) return "Je bent niet ingelogd.";
  if (!isUuid(memberId)) return "Onbekende sporter.";
  if (profile.role === "member") return memberId === profile.id ? null : "Je kan enkel voor jezelf importeren.";
  const [client] = await getMemberActivity(memberId);
  return client?.trainer_id === profile.id ? null : "Dit is niet een van je cliënten.";
}

/**
 * Op welke maandag begon week 1 bij de vorige import van deze tabs? Afgeleid uit
 * de sessies zelf: "Week 3 · Sessie 1" op maandag 26/10 → week 1 = 12/10.
 * Zo blijft een opgeschoven blok opgeschoven bij een nieuwe import.
 */
async function previousWeek1Dates(memberId: string, tabs: string[]): Promise<Record<string, string>> {
  if (tabs.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("workouts")
    .select("date, title, import_batch:import_batches!inner ( sheet_tab, member_id )")
    .eq("member_id", memberId)
    .in("import_batch.sheet_tab", tabs);
  const result: Record<string, string> = {};
  for (const row of (data ?? []) as unknown as { date: string; title: string | null; import_batch: { sheet_tab: string } }[]) {
    const week = Number(row.title?.match(/^Week\s+(\d+)/)?.[1]);
    if (!week) continue;
    const week1 = addDays(startOfWeek(row.date), -7 * (week - 1));
    const tab = row.import_batch.sheet_tab;
    if (!result[tab] || week1 < result[tab]) result[tab] = week1;
  }
  return result;
}

async function readSource(formData: FormData): Promise<Result<{ bytes: Uint8Array; label: string; source: "link" | "upload" }>> {
  const source = formData.get("source");

  if (source === "link") {
    const id = extractSheetId(String(formData.get("link") ?? ""));
    if (!id) return { ok: false, error: "Dat lijkt geen Google Sheets-link. Hij ziet eruit als https://docs.google.com/spreadsheets/d/…" };
    // We bouwen de URL zelf op met enkel het ID: zo kan niemand de server een
    // willekeurige URL laten ophalen (SSRF).
    const response = await fetch(exportUrl(id), {
      redirect: "follow",
      cache: "no-store",
    }).catch(() => null);
    if (!response?.ok) return { ok: false, error: "Downloaden lukte niet. Controleer de link of upload het bestand." };
    const bytes = new Uint8Array(await response.arrayBuffer());
    // Een .xlsx is een zip-bestand: het begint altijd met "PK". Een privé-sheet
    // geeft een HTML-loginpagina terug.
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      return {
        ok: false,
        error: "De sheet is niet publiek. Zet delen op “Iedereen met de link” of upload het bestand (Bestand → Downloaden → Microsoft Excel).",
      };
    }
    if (bytes.byteLength > MAX_BYTES) return { ok: false, error: "De sheet is groter dan 10 MB." };
    return { ok: true, bytes, label: "Google Sheet", source: "link" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Kies een .xlsx-bestand." };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { ok: false, error: "Enkel .xlsx-bestanden (Bestand → Downloaden → Microsoft Excel)." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Het bestand is groter dan 10 MB." };
  return { ok: true, bytes: new Uint8Array(await file.arrayBuffer()), label: file.name, source: "upload" };
}

function parse(bytes: Uint8Array): Result<{ workbook: ParsedWorkbook }> {
  try {
    const workbook = parseWorkbook(bytes);
    if (workbook.months.length === 0 && !workbook.info) {
      return { ok: false, error: "Geen maandtabbladen (zoals JUL2026) of Info-tab gevonden in dit bestand." };
    }
    return { ok: true, workbook };
  } catch {
    return { ok: false, error: "Dit bestand kon niet gelezen worden. Is het een geldig .xlsx-bestand?" };
  }
}

export async function previewImport(formData: FormData): Promise<Result<{ preview: ImportPreview }>> {
  const denied = await checkAccess(formData.get("member_id"));
  if (denied) return { ok: false, error: denied };

  const source = await readSource(formData);
  if (!source.ok) return source;
  const parsed = parse(source.bytes);
  if (!parsed.ok) return parsed;

  const [exercises, previousWeek1] = await Promise.all([
    getExercises(),
    previousWeek1Dates(String(formData.get("member_id")), parsed.workbook.months.map((month) => month.tab)),
  ]);
  const library = exercises.map(({ id, name, category }) => ({ id, name, category }));
  const unknown = findUnknownNames(parsed.workbook, library);
  return {
    ok: true,
    preview: { label: source.label, workbook: parsed.workbook, unknown, library, defaults: defaultChoices(parsed.workbook, unknown, previousWeek1) },
  };
}

export async function confirmImport(
  formData: FormData,
): Promise<Result<{ summary: { workouts: number; exercises: number; sets: number; checkins: number; strength_tests: number; new_exercises: number } }>> {
  const memberId = formData.get("member_id");
  const denied = await checkAccess(memberId);
  if (denied) return { ok: false, error: denied };

  let choices: ImportChoices;
  try {
    choices = JSON.parse(String(formData.get("choices")));
  } catch {
    return { ok: false, error: "Ongeldige keuzes." };
  }

  const source = await readSource(formData);
  if (!source.ok) return source;
  const parsed = parse(source.bytes);
  if (!parsed.ok) return parsed;

  const library = (await getExercises()).map(({ id, name, category }) => ({ id, name, category }));
  const built = buildPayload(parsed.workbook, choices, library, memberId as string, source.source);
  if (!built.ok) return built;

  const supabase = await createClient();
  // Eén RPC = één transactie: lukt één rij niet, dan wordt niets geïmporteerd.
  const { data, error } = await supabase.rpc("import_sheet", { payload: built.payload });
  if (error) return { ok: false, error: `Importeren mislukt, er is niets gewijzigd: ${error.message}` };

  revalidatePath("/app", "layout");
  revalidatePath("/trainer", "layout");
  return { ok: true, summary: data };
}
