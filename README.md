# Планирани спирания на тока · ERM Zapad

Öffentlicher, inoffizieller Dienst: Man wählt Orte im Netzgebiet von ERM Zapad (Elektrohold) und bekommt eine
Push-Nachricht aufs Handy, sobald dort eine Stromabschaltung geplant ist. Bulgarisch und Englisch, fürs Smartphone gebaut.

| | |
|---|---|
| Seite | https://erm-zapad-planned-power-outages.netlify.app |
| Netlify | `erm-zapad-planned-power-outages` (Team ralfw), [Admin](https://app.netlify.com/projects/erm-zapad-planned-power-outages) |
| Quelle | https://info.ermzapad.bg/webint/vok/avplan.php?BBKING=FYI (PDF-Tagespläne) |
| Deploy | `./deploy.sh` – zählt die Version hoch (`public/version.json` + `APP_VERSION` in `index.html`) und veröffentlicht |

## Ablauf

1. **3× täglich** (`netlify/functions/check.mts`: 04:20, 10:20, 15:20 UTC = 06:20, 12:20, 17:20 Uhr Sofia im Winter, im Sommer +1 h) holt der Dienst die Liste der PDF-Pläne,
   lädt nur neue oder geänderte PDFs (die Quelle sperrt nach ca. 100 Anfragen, Antwort `tomuch`),
   liest Region → Gemeinde → Ort → von/bis aus und ordnet jeden Ort einem EKATTE-Code zu.
2. Jede Abschaltung, die noch nie gemeldet wurde, geht als Push an alle Abos dieses Orts – eine Nachricht je Gerät,
   **einmalig** (Schlüssel Ort + Beginn + Ende; ändert ERM Zapad die Zeiten, gilt das als neue Abschaltung).
3. **Täglich 16:00 UTC** (18:00 Sofia im Winter, 19:00 im Sommer, `remind.mts`) kommt die Erinnerung an Abschaltungen von morgen
   (abschaltbar).

Die PDFs nennen nur „Част от <Ort>“ (Teil des Orts), keine Straßen.

Zeitgesteuerte Funktionen dürfen nur 30 s laufen. `check.mts` und `remind.mts` starten deshalb nur die
Hintergrundfunktion `job.mts` (`POST /api/job`, bis 15 min), die die eigentliche Arbeit macht: Abos parallel laden
(25 gleichzeitig) und Nachrichten parallel senden (50 gleichzeitig). Erloschene Abos (Push-Dienst meldet 404/410) werden gelöscht.

## Orte

- `public/places.json`: 1575 Orte aus EKATTE (NSI) in den 10 Regionen von ERM Zapad
  (Благоевград, Видин, Враца, Кюстендил, Ловеч, Монтана, Перник, Плевен, Софийска, София-град).
  Neu erzeugen: EKATTE-JSON von https://www.nsi.bg/nrnm/index.php/ekatte/index nach `tools/` legen, `python3 tools/build_places.py`.
- Sofia-Stadt: Die Pläne nennen Wohnviertel (ж.к., кв.) und Stadtbezirke. Die stehen nicht in EKATTE; der Dienst sammelt sie
  laufend als Zusatzorte (`extra`, Schlüssel `x…`) und liefert sie mit `/api/outages` aus.
- Suche: kyrillisch oder lateinisch („bans“ findet Банско).

## Schnittstellen

| Pfad | Zweck |
|---|---|
| `GET /api/outages` | `{checkedAt, outages: [[ortId, start, ende, startUTC, endeUTC, plandatum]], extra}` – Zeiten in Ortszeit Sofia |
| `GET /api/pdf/YYYY-MM-DD` | gespeicherte Kopie des Original-PDFs (die Quelle hat keinen direkten Link, nur POST) |
| `GET /api/config` | öffentlicher VAPID-Schlüssel |
| `POST /api/subscribe` | `{sub, places, lang, eve}` – Abo anlegen/ändern (nur bekannte Push-Dienste) |
| `DELETE /api/subscribe` | `{endpoint}` – Abo löschen (beim Ausschalten in der App) |
| `POST /api/test` | `{endpoint}` – Probe-Push ans eigene Gerät, höchstens 3 je 10 min |
| `POST /api/run` | Lauf von Hand starten (im Hintergrund), Header `X-Admin-Token` (Wert in `.admin-token`); `?what=remind` für die Erinnerung |
| `GET /api/run` | Protokoll der letzten 30 Läufe (gleicher Header) |
| `POST /api/job` | Hintergrundfunktion, nur intern (gleicher Header) |

Speicher (Netlify Blobs): `erm-data` (`state`, `current`, `plan/<datum>`, `pdf/<datum>`), `erm-subs` (ein Eintrag je Gerät: Push-Adresse,
Orts-IDs, Sprache, Vorabend ja/nein). Keine Namen, Telefonnummern oder E-Mails.

Umgebungsvariablen: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT`, `ADMIN_TOKEN`.

## Glocke oben rechts

| Zustand | Glocke |
|---|---|
| Browser erlaubt keine Benachrichtigungen | durchgestrichen + roter Punkt |
| erlaubt, aber ausgeschaltet | durchgestrichen |
| erlaubt und eingeschaltet | normale Glocke |

- iPhone: Push nur, wenn die Seite zum Home-Bildschirm hinzugefügt wurde – die App zeigt dafür eine Anleitung.
- Facebook-/Messenger-/Instagram-Browser: kein Push möglich – die App bittet, die Seite in Chrome/Safari zu öffnen.

## Dateien

- `public/` – Seite (`index.html`), PDF-Betrachter (`pdf.html` mit pdf.js aus `vendor/pdfjs`, markiert die Zeile des Orts; nötig, weil die iPhone-Home-Screen-App beim direkten Öffnen eines PDFs keinen Zurück-Weg hat), Service Worker (`sw.js`), Manifest, Icons, `og.png` (Vorschaubild für Facebook), `icons.js` (Lucide-Auszug, `node tools/build-icons.mjs`)
- `src/plans.mjs` – Abruf und Auswertung der PDFs, Zuordnung zu EKATTE
- `src/service.mjs` – Aktualisierung, Meldungen, Push
- `netlify/functions/` – zeitgesteuerte Funktionen und API
- `tools/` – Ortsliste, Icons/Vorschaubild (`python3 tools/render_assets.py`), Parser-Test (`node tools/test-parse.mjs /pfad/zu/pdfs`)
- `mockup/` – der klickbare UI-Entwurf

## Version und Aktualisieren

Unten auf der Seite steht „Версия N · Datum“ mit dem Knopf „Обнови“/„Refresh“, der die Seite frisch vom Server lädt
(wichtig auf dem iPhone-Home-Bildschirm, wo es kein Neuladen per Wischen gibt). Beim Öffnen und bei jeder Rückkehr in die App
vergleicht die Seite ihre Version mit `/version.json`; ist der Server neuer, erscheint oben ein blauer Hinweis zum Aktualisieren.

## Sortierung der Orte

Über der Ortsliste (ab 2 Orten): „Добавени“ (zuletzt hinzugefügt oben), „А–Я“, „Най-скоро“ (nächste Abschaltung oben, Orte ohne Abschaltung danach alphabetisch).
