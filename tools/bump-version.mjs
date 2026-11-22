// Zählt die Version hoch und trägt sie in public/version.json und public/index.html ein.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const vf = new URL("../public/version.json", import.meta.url), hf = new URL("../public/index.html", import.meta.url);
const old = existsSync(vf) ? JSON.parse(readFileSync(vf, "utf8")) : { v: 0 };
const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia", year: "numeric", month: "2-digit",
  day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
const next = { v: old.v + 1, date: `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` };
writeFileSync(vf, JSON.stringify(next) + "\n");
const html = readFileSync(hf, "utf8");
const re = /const APP_VERSION = \{[^}]*\};/;
if (!re.test(html)) throw new Error("APP_VERSION nicht gefunden");
writeFileSync(hf, html.replace(re, `const APP_VERSION = ${JSON.stringify(next)};`));
console.log("Version", next.v, next.date);
