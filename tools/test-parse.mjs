// Vergleicht den JS-Parser mit der pdftotext-Auswertung (tools/parse_plan.py) für lokale PDFs.
import { readFileSync, readdirSync } from "node:fs";
import { pdfLines, parsePlan, placeId } from "../src/plans.mjs";
const dir = process.argv[2] || "/tmp/ermpdf";
let bad = 0;
for (const f of readdirSync(dir).filter((f) => /^p\d+\.pdf$/.test(f))) {
  const js = parsePlan(await pdfLines(new Uint8Array(readFileSync(`${dir}/${f}`))));
  const py = JSON.parse(readFileSync(`${dir}/${f.replace(".pdf", ".json")}`, "utf8"));
  const k = (e) => `${e.oblast}|${e.obshtina}|${e.name ?? e.place}|${e.start}`;
  const pyk = new Set(py.map((e) => k({ ...e, start: e.start.replace(/(\d\d)\.(\d\d)\.(\d{4}) /, "$3-$2-$1T") })));
  const jsk = new Set(js.map(k));
  const onlyPy = [...pyk].filter((x) => !jsk.has(x)), onlyJs = [...jsk].filter((x) => !pyk.has(x));
  const extra = js.filter((e) => placeId(e).startsWith("x")).length;
  console.log(f, "js", js.length, "py", py.length, "nurPy", onlyPy.length, "nurJs", onlyJs.length, "ohneEKATTE", extra);
  if (onlyPy.length || onlyJs.length) { bad++; console.log("  ", onlyPy.slice(0, 3), onlyJs.slice(0, 3)); }
}
process.exit(bad ? 1 : 0);
