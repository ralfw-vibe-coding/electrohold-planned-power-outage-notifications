// GET /api/pdf/YYYY-MM-DD – Kopie des Original-PDFs von ERM Zapad für diesen Tag
import type { Config, Context } from "@netlify/functions";
import { planPdf } from "../../src/service.mjs";

export default async (req: Request, context: Context) => {
  const date = context.params.date;
  if (!/^\d{4}-\d\d-\d\d$/.test(date)) return new Response("bad date", { status: 400 });
  const buf = await planPdf(date);
  if (!buf) return new Response("not found", { status: 404 });
  const d = date.split("-").reverse().join(".");
  return new Response(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ERM-Zapad-planned-outages-${d}.pdf"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
};

export const config: Config = { path: "/api/pdf/:date" };
