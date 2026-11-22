// 3× täglich, 04:20 / 10:20 / 15:20 UTC = 06:20 / 12:20 / 17:20 Uhr Sofia (Winter; Sommer +1 h):
// neue Pläne holen und neue Abschaltungen melden. Der letzte Lauf liegt vor der Vorabend-Erinnerung.
import type { Config } from "@netlify/functions";
import { trigger } from "../../src/trigger.mjs";

export default async () => { await trigger("check"); };

export const config: Config = { schedule: "20 4,10,15 * * *" };
