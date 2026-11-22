// Kernlogik: Pläne aktualisieren, neue Abschaltungen erkennen, Push-Nachrichten verschicken.
import { getStore } from "@netlify/blobs";
import * as wp from "web-push";
const webpush = wp.default ?? wp;
import { fetchPlanList, fetchPlanPdf, pdfLines, parsePlan, placeId, PLACES } from "./plans.mjs";

const data = () => getStore({ name: "erm-data", consistency: "strong" });
export const subsStore = () => getStore({ name: "erm-subs", consistency: "strong" });

export const SITE = process.env.URL || "https://erm-zapad-planned-power-outages.netlify.app";

// ---------- Zeit (alle Planzeiten sind Ortszeit Sofia) ----------
export function sofiaNow() {
  // "YYYY-MM-DDTHH:MM" in Europe/Sofia
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia", year: "numeric",
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function addDays(date, n) {
  const d = new Date(date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Ortszeit Sofia → UTC-ISO (für Kalenderdateien) */
export function sofiaToUtc(local) {
  const guess = new Date(local + ":00Z");
  const asSofia = new Date(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Sofia", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(guess).replace(" ", "T") + "Z");
  return new Date(guess - (asSofia - guess)).toISOString();
}

// ---------- Orte ----------
const PLACE_BY_ID = new Map(PLACES.map((p) => [p[0], p]));
const TR = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya" };
export const latin = (s) => s.toLowerCase().replace(/[а-я]/g, (c) => TR[c] ?? c);
const title = (s) => s.toLowerCase().replace(/(^|[\s.-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
export function placeName(id, lang, extra = {}) {
  const p = PLACE_BY_ID.get(id);
  if (p) return lang === "en" ? p[2] : p[1];
  const x = extra[id];
  if (!x) return id;
  return lang === "en" ? title(latin(x[0])) : title(x[0]);
}

// ---------- Aktualisierung ----------
/**
 * Holt neue/geänderte Pläne, speichert den aktuellen Stand und liefert neu hinzugekommene Abschaltungen.
 * Pro Lauf: 1 Abruf der Liste + 1 Abruf je neuem PDF (die Quelle sperrt nach ca. 100 Anfragen).
 */
export async function update() {
  const store = data();
  const state = (await store.get("state", { type: "json" })) || { docs: {}, announced: {}, extra: {} };
  state.pdfs ||= {}; // Datum → Dokument-ID, deren PDF-Kopie gespeichert ist
  const firstRun = !Object.keys(state.docs).length;
  const today = sofiaNow().slice(0, 10);

  const list = (await fetchPlanList()).filter((d) => d.date >= addDays(today, -1));
  let fetched = 0;
  for (const { id, date } of list) {
    if (state.docs[date] === id && state.pdfs[date] === id) continue;
    const buf = await fetchPlanPdf(id);
    await store.set(`pdf/${date}`, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    state.pdfs[date] = id;
    const entries = parsePlan(await pdfLines(buf)).map((e) => {
      const pid = placeId(e);
      if (pid.startsWith("x")) state.extra[pid] = [e.name, e.obshtina, e.oblast];
      return { id: pid, start: e.start, end: e.end, part: e.part };
    });
    await store.setJSON(`plan/${date}`, { docId: id, entries });
    state.docs[date] = id;
    fetched++;
  }

  // Aktueller Stand: alle Abschaltungen, die noch nicht vorbei sind
  const now = sofiaNow();
  const outages = [];
  for (const date of Object.keys(state.docs).sort()) {
    if (date < addDays(today, -2)) {
      delete state.docs[date]; delete state.pdfs[date];
      await store.delete(`plan/${date}`); await store.delete(`pdf/${date}`); continue;
    }
    const plan = await store.get(`plan/${date}`, { type: "json" });
    for (const e of plan?.entries || []) if (e.end > now) outages.push({ ...e, plan: date });
  }
  const seen = new Set();
  const unique = outages.filter((o) => { const k = `${o.id}|${o.start}|${o.end}`; return !seen.has(k) && seen.add(k); })
    .sort((a, b) => a.start.localeCompare(b.start));

  // Neu = noch nie gemeldet. Beim allerersten Lauf wird nichts gemeldet (es gibt noch keine Abonnenten).
  const fresh = [];
  for (const o of unique) {
    const k = `${o.id}|${o.start}|${o.end}`;
    if (!state.announced[k]) { state.announced[k] = o.end; if (!firstRun) fresh.push(o); }
  }
  for (const [k, end] of Object.entries(state.announced)) if (end < addDays(today, -3)) delete state.announced[k];

  const usedExtra = Object.fromEntries(Object.entries(state.extra));
  const current = {
    checkedAt: new Date().toISOString(),
    outages: unique.map((o) => [o.id, o.start, o.end, sofiaToUtc(o.start), sofiaToUtc(o.end), o.plan]),
    extra: usedExtra,
  };
  state.checkedAt = current.checkedAt;
  await store.setJSON("current", current);
  await store.setJSON("state", state);
  return { fetched, total: unique.length, fresh, extra: state.extra };
}

export async function current() {
  return (await data().get("current", { type: "json" })) || { checkedAt: null, outages: [], extra: {} };
}

// ---------- Push ----------
let vapidReady = false;
function vapid() {
  if (!vapidReady) {
    // Absender muss "mailto:…" oder eine https-URL sein (Apple prüft das streng)
    const contact = process.env.VAPID_CONTACT || SITE;
    webpush.setVapidDetails(/^(mailto:|https:)/.test(contact) ? contact : "mailto:" + contact,
      process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    vapidReady = true;
  }
}

export async function subKey(endpoint) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

/** Sendet eine Nachricht; entfernt Abos, die der Push-Dienst als erloschen meldet. */
export async function send(key, sub, payload) {
  vapid();
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 60 * 60 * 24, urgency: "high" });
    return true;
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) await subsStore().delete(key);
    else console.error("push failed", err.statusCode, err.body);
    return false;
  }
}

/** Führt fn für alle Elemente aus, höchstens `limit` gleichzeitig. */
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

/** Alle Abos laden (parallel, 25 gleichzeitig). */
async function allSubs() {
  const store = subsStore();
  const { blobs } = await store.list(); // ohne paginate: alle Seiten
  const subs = await pool(blobs, 25, async ({ key }) => [key, await store.get(key, { type: "json" })]);
  return subs.filter(([, s]) => s?.sub && s.places?.length);
}

/** Nachrichten parallel verschicken (50 gleichzeitig); liefert die Zahl erfolgreicher Sendungen. */
async function sendAll(jobs) {
  const ok = await pool(jobs, 50, ([key, sub, payload]) => send(key, sub, payload));
  return ok.filter(Boolean).length;
}

const T = {
  bg: { wd: ["нд", "пн", "вт", "ср", "чт", "пт", "сб"], mo: ["яну", "фев", "мар", "апр", "май", "юни", "юли", "авг", "сеп", "окт", "ное", "дек"],
    newTitle: "Планирано спиране на тока", remTitle: "Утре: планирано спиране на тока", until: "до" },
  en: { wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], mo: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    newTitle: "Planned power cut", remTitle: "Tomorrow: planned power cut", until: "until" },
};
export function fmtOutage(o, lang, withDate = true) {
  const t = T[lang] || T.bg;
  const [d, s] = o.start.split("T"), [d2, e] = o.end.split("T");
  const day = new Date(d + "T12:00:00Z");
  const date = `${t.wd[day.getUTCDay()]} ${day.getUTCDate()} ${t.mo[day.getUTCMonth()]}`;
  const time = d === d2 ? `${s}–${e}` : `${s} – ${t.until} ${+d2.slice(8)} ${t.mo[+d2.slice(5, 7) - 1]} ${e}`;
  return withDate ? `${date}, ${time}` : time;
}

/** Neue Abschaltungen an alle Abonnenten der betroffenen Orte melden (eine Nachricht je Abo). */
export async function announce(fresh, extra) {
  if (!fresh.length) return 0;
  const jobs = [];
  for (const [key, s] of await allSubs()) {
    const mine = fresh.filter((o) => s.places.includes(o.id));
    if (!mine.length) continue;
    const lang = s.lang === "en" ? "en" : "bg";
    const body = mine.slice(0, 6).map((o) => `${placeName(o.id, lang, extra)}: ${fmtOutage(o, lang)}`).join("\n")
      + (mine.length > 6 ? `\n+${mine.length - 6}` : "");
    jobs.push([key, s.sub, { title: T[lang].newTitle, body, tag: "new-" + mine[0].start, url: "/" }]);
  }
  return sendAll(jobs);
}

/** Erinnerung am Vorabend für alle Abschaltungen, die morgen beginnen. */
export async function remind() {
  const { outages, extra } = await current();
  const tomorrow = addDays(sofiaNow().slice(0, 10), 1);
  const due = outages.filter(([, start]) => start.startsWith(tomorrow)).map(([id, start, end]) => ({ id, start, end }));
  if (!due.length) return 0;
  const jobs = [];
  for (const [key, s] of await allSubs()) {
    if (s.eve === false) continue;
    const mine = due.filter((o) => s.places.includes(o.id));
    if (!mine.length) continue;
    const lang = s.lang === "en" ? "en" : "bg";
    const body = mine.map((o) => `${placeName(o.id, lang, extra)}: ${fmtOutage(o, lang, false)}`).join("\n");
    jobs.push([key, s.sub, { title: T[lang].remTitle, body, tag: "rem-" + tomorrow, url: "/" }]);
  }
  return sendAll(jobs);
}

/** Lauf ausführen und im Protokoll (letzte 30 Läufe) festhalten. */
export async function runJob(what) {
  const started = new Date().toISOString();
  let entry;
  try {
    if (what === "remind") entry = { what, reminded: await remind() };
    else { const r = await update(); entry = { what: "check", fetched: r.fetched, total: r.total, fresh: r.fresh.length, sent: await announce(r.fresh, r.extra) }; }
  } catch (err) {
    entry = { what, error: String(err?.message || err) };
  }
  entry = { started, finished: new Date().toISOString(), ...entry };
  const runs = (await data().get("runs", { type: "json" })) || [];
  await data().setJSON("runs", [entry, ...runs].slice(0, 30));
  console.log(JSON.stringify(entry));
  return entry;
}
export const runs = async () => (await data().get("runs", { type: "json" })) || [];

/** Gespeicherte Kopie des Original-PDFs für ein Plandatum (YYYY-MM-DD) */
export async function planPdf(date) {
  return data().get(`pdf/${date}`, { type: "arrayBuffer" });
}
