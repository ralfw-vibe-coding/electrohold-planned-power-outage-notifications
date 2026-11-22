// Täglich 16:00 UTC = 18:00 Uhr Sofia (Winter) bzw. 19:00 Uhr (Sommer): Erinnerung an Abschaltungen von morgen.
import type { Config } from "@netlify/functions";
import { remind } from "../../src/service.mjs";

export default async () => {
  console.log(JSON.stringify({ reminded: await remind() }));
};

export const config: Config = { schedule: "0 16 * * *" };
