// GET /api/config – öffentlicher VAPID-Schlüssel für die Push-Anmeldung
import type { Config } from "@netlify/functions";

export default async () =>
  Response.json({ vapidPublicKey: process.env.VAPID_PUBLIC_KEY }, { headers: { "Cache-Control": "no-cache" } });

export const config: Config = { path: "/api/config" };
