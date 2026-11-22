// Verwaltung (Header X-Admin-Token = Env ADMIN_TOKEN):
//   POST /api/run[?what=remind] – Lauf von Hand starten (im Hintergrund)
//   GET  /api/run               – Protokoll der letzten 30 Läufe
import type { Config } from "@netlify/functions";
import { trigger } from "../../src/trigger.mjs";
import { runs } from "../../src/service.mjs";

export default async (req: Request) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token || req.headers.get("x-admin-token") !== token) return new Response("forbidden", { status: 403 });
  if (req.method === "GET") return Response.json(await runs());
  await trigger(new URL(req.url).searchParams.get("what") === "remind" ? "remind" : "check");
  return Response.json({ started: true, log: "GET /api/run" }, { status: 202 });
};

export const config: Config = { path: "/api/run", method: ["GET", "POST"] };
