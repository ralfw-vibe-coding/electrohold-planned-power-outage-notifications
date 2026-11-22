// Hintergrundfunktion (bis 15 min): Pläne prüfen und melden bzw. Vorabend-Erinnerung verschicken.
// Aufruf: POST /api/job?what=check|remind mit Header X-Admin-Token (von den zeitgesteuerten Funktionen oder /api/run).
import type { Config } from "@netlify/functions";
import { runJob } from "../../src/service.mjs";

export default async (req: Request) => {
  if (!process.env.ADMIN_TOKEN || req.headers.get("x-admin-token") !== process.env.ADMIN_TOKEN) return;
  await runJob(new URL(req.url).searchParams.get("what") === "remind" ? "remind" : "check");
};

export const config: Config = { path: "/api/job", method: "POST", background: true };
