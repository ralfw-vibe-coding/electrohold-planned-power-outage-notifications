// GET /api/outages – aktuelle und künftige Abschaltungen (+ Orte außerhalb EKATTE, z. B. Sofioter Viertel)
import type { Config } from "@netlify/functions";
import { current } from "../../src/service.mjs";

export default async () =>
  Response.json(await current(), {
    headers: {
      "Cache-Control": "public, max-age=60",
      "Netlify-CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });

export const config: Config = { path: "/api/outages" };
