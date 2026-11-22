// Erzeugt public/icons.js mit nur den benötigten Lucide-Icons als SVG-Strings.
import * as L from "lucide";
import { writeFileSync } from "node:fs";
const NAMES = ["zap-off", "search", "x", "map-pin", "plus", "check", "trash-2", "circle-check", "calendar-plus", "chevron-down",
  "chevron-up", "bell", "bell-ring", "bell-off", "bell-plus", "moon", "share", "square-plus", "send", "info", "external-link",
  "ellipsis-vertical", "ellipsis", "compass", "share-2", "refresh-cw", "chevron-right", "file-text", "chevron-left"];
const pascal = (n) => n.split("-").map((s) => s[0].toUpperCase() + s.slice(1)).join("");
const out = {};
for (const n of NAMES) {
  const node = L[pascal(n)];
  if (!node) throw new Error("Icon fehlt: " + n);
  const inner = node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
  out[n] = `<svg xmlns="http://www.w3.org/2000/svg" class="lucide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
writeFileSync(new URL("../public/icons.js", import.meta.url),
  "// Lucide-Icons (ISC-Lizenz), erzeugt von tools/build-icons.mjs\nwindow.ICONS=" + JSON.stringify(out) + ";\n");
console.log(Object.keys(out).length, "Icons");
