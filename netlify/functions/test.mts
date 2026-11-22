// POST /api/test {endpoint} – Probe-Benachrichtigung an das eigene Gerät (höchstens 3 je 10 Minuten)
import type { Config } from "@netlify/functions";
import { subsStore, subKey, send } from "../../src/service.mjs";

export default async (req: Request) => {
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (typeof endpoint !== "string") return Response.json({ error: "endpoint" }, { status: 400 });
  const key = await subKey(endpoint);
  const store = subsStore();
  const s = await store.get(key, { type: "json" });
  if (!s) return Response.json({ error: "unknown" }, { status: 404 });
  const now = Date.now();
  const tests = (s.tests || []).filter((t: number) => now - t < 10 * 60 * 1000);
  if (tests.length >= 3) return Response.json({ error: "limit" }, { status: 429 });
  await store.setJSON(key, { ...s, tests: [...tests, now] });
  const en = s.lang === "en";
  const ok = await send(key, s.sub, {
    title: en ? "Test notification" : "Пробно известие",
    body: en ? "Notifications work. You'll hear from us when a power cut is planned." : "Известията работят. Ще ви съобщим, когато бъде планирано спиране на тока.",
    tag: "test", url: "/",
  });
  return Response.json({ ok }, { status: ok ? 200 : 502 });
};

export const config: Config = { path: "/api/test", method: "POST" };
