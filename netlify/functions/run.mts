// POST /api/run – Prüfung von Hand auslösen (nur mit Header X-Admin-Token = Env ADMIN_TOKEN)
import type { Config } from "@netlify/functions";
import { update, announce, remind } from "../../src/service.mjs";

export default async (req: Request) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token || req.headers.get("x-admin-token") !== token) return new Response("forbidden", { status: 403 });
  const what = new URL(req.url).searchParams.get("what");
  if (what === "remind") return Response.json({ reminded: await remind() });
  const r = await update();
  const sent = await announce(r.fresh, r.extra);
  return Response.json({ fetched: r.fetched, total: r.total, fresh: r.fresh.length, sent });
};

export const config: Config = { path: "/api/run", method: "POST" };
