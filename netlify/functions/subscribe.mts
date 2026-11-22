// POST /api/subscribe {sub, places, lang, eve} – Abo anlegen/aktualisieren
// DELETE /api/subscribe {endpoint}            – Abo löschen
import type { Config } from "@netlify/functions";
import { subsStore, subKey } from "../../src/service.mjs";

const PUSH_HOSTS = /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com|push\.mozilla\.com)$/;
const bad = (msg: string) => Response.json({ error: msg }, { status: 400 });

export default async (req: Request) => {
  const body = await req.json().catch(() => null);
  if (!body) return bad("json");
  const endpoint = req.method === "DELETE" ? body.endpoint : body.sub?.endpoint;
  let host = "";
  try { const u = new URL(endpoint); if (u.protocol === "https:") host = u.hostname; } catch {}
  if (!PUSH_HOSTS.test(host)) return bad("endpoint");
  const key = await subKey(endpoint);

  if (req.method === "DELETE") {
    await subsStore().delete(key);
    return Response.json({ ok: true });
  }
  if (req.method !== "POST") return new Response("", { status: 405 });

  const { sub, places, lang, eve } = body;
  if (!sub.keys?.p256dh || !sub.keys?.auth) return bad("keys");
  if (!Array.isArray(places) || places.length > 40 || !places.every((p) => typeof p === "string" && /^[\w]{1,12}$/.test(p)))
    return bad("places");
  const old = await subsStore().get(key, { type: "json" });
  await subsStore().setJSON(key, {
    sub: { endpoint, keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) } },
    places, lang: lang === "en" ? "en" : "bg", eve: eve !== false,
    created: old?.created || new Date().toISOString(), updated: new Date().toISOString(), tests: old?.tests || [],
  });
  return Response.json({ ok: true });
};

export const config: Config = { path: "/api/subscribe", method: ["POST", "DELETE"] };
