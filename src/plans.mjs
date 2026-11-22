// Abruf und Auswertung der PDF-Tagespläne von ERM Zapad (Elektrohold).
import { getDocumentProxy } from "unpdf";
import PLACES from "../public/places.json" with { type: "json" };

export const SOURCE = "https://info.ermzapad.bg/webint/vok/avplan.php";

async function post(data) {
  const res = await fetch(SOURCE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0 (outage-notifier)" },
    body: new URLSearchParams(data),
  });
  if (!res.ok) throw new Error(`ERM Zapad: HTTP ${res.status}`);
  return res;
}

/** Liste der veröffentlichten Pläne: [{ id, date: "YYYY-MM-DD" }] */
export async function fetchPlanList() {
  const html = (await (await post({ action: "showpdf" })).text()).replace(/^\uFEFF/, "").trim();
  if (html === "tomuch") throw new Error("ERM Zapad: Abfragelimit erreicht (tomuch)");
  const re = /previewdoc\((\d+)\);">[^<]*<\/a><span[^>]*>(\d\d)\.(\d\d)\.(\d{4})<\/span>/g;
  return [...html.matchAll(re)].map(([, id, d, m, y]) => ({ id, date: `${y}-${m}-${d}` }));
}

/** PDF laden und als Textzeilen rekonstruieren (Textstücke nach y gruppieren, nach x sortieren). */
export async function fetchPlanLines(id) {
  return pdfLines(await fetchPlanPdf(id));
}

export async function fetchPlanPdf(id) {
  const buf = new Uint8Array(await (await post({ action: "showdocid", doc_id: id })).arrayBuffer());
  if (String.fromCharCode(...buf.slice(0, 4)) !== "%PDF") throw new Error(`ERM Zapad: Dokument ${id} ist kein PDF`);
  return buf;
}

export async function pdfLines(buf) {
  const pdf = await getDocumentProxy(buf);
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const { items } = await (await pdf.getPage(p)).getTextContent();
    const rows = [];
    for (const it of items) {
      if (!it.str?.trim()) continue;
      const y = it.transform[5];
      // Toleranz 2.5 pt: Spalten einer Tabellenzeile liegen nicht immer exakt auf gleicher Höhe
      let row = rows.find((r) => Math.abs(r.y - y) < 2.5);
      if (!row) rows.push((row = { y, items: [] }));
      row.items.push(it);
    }
    rows.sort((a, b) => b.y - a.y).forEach((r) =>
      lines.push(r.items.sort((a, b) => a.transform[4] - b.transform[4]).map((t) => t.str.trim()).join("  "))
    );
  }
  return lines;
}

const iso = (d, t) => d.split(".").reverse().join("-") + "T" + t;
const clean = (s) => s.replace(/\s+/g, " ").trim().toUpperCase();

/** Zeilen → [{ oblast, obshtina, name, part, start, end }] (Zeiten in Ortszeit Sofia) */
export function parsePlan(lines) {
  let oblast = null, obshtina = null;
  const out = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    let m = line.match(/^област (.+?)(?: Част от населено място.*)?$/i);
    if (m) { oblast = clean(m[1]); continue; }
    m = line.match(/^община (.+?)(?: За индивидуална проверка.*)?$/i);
    if (m) { obshtina = clean(m[1]); continue; }
    m = line.match(/^(Част от )?(.+?) (\d\d\.\d\d\.\d{4}) (\d\d:\d\d) (\d\d\.\d\d\.\d{4}) (\d\d:\d\d)$/);
    if (m && oblast) {
      const name = clean(m[2]).replace(/\s*[,-]?\s*ОБЩ\.\s*\S.*$/, "").trim();
      out.push({ oblast, obshtina, name, part: !!m[1], start: iso(m[3], m[4]), end: iso(m[5], m[6]) });
    }
  }
  return out;
}

// ---------- Zuordnung zu EKATTE ----------
const PDF_OBLAST = { "БЛАГОЕВГРАД": "Благоевград", "ВИДИН": "Видин", "ВРАЦА": "Враца", "КЮСТЕНДИЛ": "Кюстендил",
  "ЛОВЕЧ": "Ловеч", "МОНТАНА": "Монтана", "ПЕРНИК": "Перник", "ПЛЕВЕН": "Плевен", "СОФИЙСКА": "София",
  "СОФИЯ-ГРАД": "София (столица)" };
const byNameObs = new Map(), byNameObl = new Map();
for (const p of PLACES) {
  const [id, name, , obs, , obl, , , other] = p;
  if (other) continue; // anderer Netzbetreiber

  byNameObs.set(`${name.toUpperCase()}|${obs.toUpperCase()}|${obl}`, id);
  const k = `${name.toUpperCase()}|${obl}`;
  byNameObl.set(k, byNameObl.has(k) ? null : id); // null = mehrdeutig
}

/** Kurzer stabiler Schlüssel für Orte, die nicht in EKATTE stehen (z. B. Sofioter Wohnviertel). */
export function extraId(e) {
  let h = 0;
  for (const c of `${e.oblast}|${e.obshtina}|${e.name}`) h = (Math.imul(h, 31) + c.codePointAt(0)) | 0;
  return "x" + (h >>> 0).toString(36);
}

/** EKATTE-Code oder Zusatz-Schlüssel für einen Planeintrag. */
export function placeId(e) {
  const obl = PDF_OBLAST[e.oblast] ?? e.oblast;
  return byNameObs.get(`${e.name}|${e.obshtina}|${obl}`) ?? byNameObl.get(`${e.name}|${obl}`) ?? extraId(e);
}

export { PLACES };
