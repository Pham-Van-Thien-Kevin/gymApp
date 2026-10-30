// Route Handler (geen pagina): GET /app/export stuurt je trainingen, maxima,
// lichaamsgewicht en check-ins als Excel-bestand. Draait op de server, dus de
// rolcontrole en RLS gelden net zoals bij een pagina.
import { requireRole } from "@/lib/auth";
import { getExportData } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { buildWorkbook, exportFileName, xlsxResponse } from "@/lib/export";

export async function GET() {
  const profile = await requireRole("member");
  const file = buildWorkbook(await getExportData(profile.id, profile.full_name));
  return xlsxResponse(file, exportFileName(profile.full_name, todayISO()));
}
