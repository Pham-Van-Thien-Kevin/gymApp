// Route Handler: GET /trainer/clients/[id]/export, dezelfde Excel-export als de
// sporter zelf krijgt. requireClient geeft een 404 als dit niet jouw cliënt is.
import { notFound } from "next/navigation";
import { getExportData } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { buildWorkbook, exportFileName, xlsxResponse } from "@/lib/export";
import { isUuid } from "@/lib/parse";
import { requireClient } from "@/lib/trainer";

export async function GET(_request: Request, { params }: RouteContext<"/trainer/clients/[id]/export">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { client } = await requireClient(id);
  const file = buildWorkbook(await getExportData(id));
  return xlsxResponse(file, exportFileName(client.full_name, todayISO()));
}
