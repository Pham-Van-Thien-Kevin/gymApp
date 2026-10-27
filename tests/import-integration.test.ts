// Integratietest: importeert de voorbeeldsheet écht in een (lokale) Supabase.
// Wordt overgeslagen tenzij je deze variabelen zet, bv. na `npx supabase start`
// en het uitvoeren van schema.sql + seed.sql:
//   SUPABASE_TEST_URL=http://127.0.0.1:54321 SUPABASE_TEST_KEY=<publishable key> npm test
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPayload } from "@/lib/import/build-payload";
import { defaultChoices, findUnknownNames } from "@/lib/import/matching";
import { parseWorkbook } from "@/lib/import/parser";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_KEY;

describe.skipIf(!url || !key)("import in de database (demo-account noor@liftlog.test uit seed.sql)", () => {
  // In beforeAll, niet rechtstreeks hier: Vitest voert deze functie ook uit voor
  // een overgeslagen suite, en createClient() faalt zonder URL.
  let supabase: SupabaseClient;
  const tabs = ["JUL2026", "AUG2026", "Info"];
  let ownExercisesBefore: string[] | null = null;

  beforeAll(() => {
    supabase = createClient(url!, key!, { auth: { persistSession: false } });
  });

  async function importOnce() {
    const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
      email: "noor@liftlog.test",
      password: "liftlog-demo", // demo-wachtwoord uit supabase/seed.sql
    });
    if (authError) throw authError;
    const { data: library } = await supabase.from("exercises").select("id, name, category, created_by");
    // Onthouden welke eigen oefeningen er al waren, om achteraf enkel de nieuwe op te ruimen.
    ownExercisesBefore ??= library!.filter((e) => e.created_by === auth.user.id).map((e) => e.id);
    const workbook = parseWorkbook(readFileSync("fixtures/gymSheet.xlsx"));
    const choices = defaultChoices(workbook, findUnknownNames(workbook, library!));
    const built = buildPayload(workbook, choices, library!, auth.user.id, "upload");
    if (!built.ok) throw new Error(built.error);
    const { data, error } = await supabase.rpc("import_sheet", { payload: built.payload });
    if (error) throw error;
    return { summary: data, userId: auth.user.id };
  }

  async function countImported(userId: string) {
    const { count } = await supabase
      .from("workouts")
      .select("id", { count: "exact", head: true })
      .eq("member_id", userId)
      .not("import_batch_id", "is", null);
    return count;
  }

  afterAll(async () => {
    // Opruimen: dankzij "on delete cascade" verdwijnt alles van de import mee...
    await supabase.from("import_batches").delete().in("sheet_tab", tabs);
    // ...behalve de oefeningen die de import aan de bibliotheek toevoegde.
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user && ownExercisesBefore) {
      const keep = ownExercisesBefore.length ? `(${ownExercisesBefore.join(",")})` : "(00000000-0000-0000-0000-000000000000)";
      await supabase.from("exercises").delete().eq("created_by", auth.user.id).not("id", "in", keep);
    }
  });

  it("importeert alles in één keer en geeft bij herimport geen dubbels", async () => {
    const first = await importOnce();
    expect(first.summary.workouts).toBeGreaterThan(30);
    expect(first.summary.strength_tests).toBe(2);
    const afterFirst = await countImported(first.userId);

    const second = await importOnce();
    expect(second.summary.workouts).toBe(first.summary.workouts);
    expect(await countImported(second.userId)).toBe(afterFirst);

    const { data: batches } = await supabase.from("import_batches").select("sheet_tab").in("sheet_tab", tabs);
    expect(batches?.map((b) => b.sheet_tab).sort()).toEqual(["AUG2026", "Info", "JUL2026"]);
  });
});
