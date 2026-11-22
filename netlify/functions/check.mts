// Alle 2 Stunden: neue Pläne holen und neue Abschaltungen per Push melden.
import type { Config } from "@netlify/functions";
import { update, announce } from "../../src/service.mjs";

export default async () => {
  const r = await update();
  const sent = await announce(r.fresh, r.extra);
  console.log(JSON.stringify({ fetched: r.fetched, total: r.total, fresh: r.fresh.length, sent }));
};

export const config: Config = { schedule: "20 */2 * * *" };
