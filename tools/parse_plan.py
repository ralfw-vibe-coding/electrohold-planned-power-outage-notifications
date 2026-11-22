"""Parst pdftotext -layout Ausgabe eines ERM-Zapad-Plans in JSON-Einträge."""
import re, sys, json
obl = obs = None
out = []
for line in open(sys.argv[1], encoding="utf-8"):
    m = re.match(r"\s*област\s+(.+?)\s{2,}", line)
    if m: obl = m.group(1).strip(); continue
    m = re.match(r"\s*община\s+(.+?)\s{2,}", line)
    if m: obs = m.group(1).strip(); continue
    m = re.match(r"\s*(?:Част от\s+)?(.+?)\s{2,}(\d\d\.\d\d\.\d{4}) (\d\d:\d\d)\s+(\d\d\.\d\d\.\d{4}) (\d\d:\d\d)", line)
    if m and obl:
        name = re.sub(r",\s*ОБЩ\..*$", "", m.group(1)).strip()
        part = "Част от" in line
        out.append(dict(oblast=obl, obshtina=obs, place=name, part=part,
                        start=f"{m.group(2)} {m.group(3)}", end=f"{m.group(4)} {m.group(5)}"))
json.dump(out, sys.stdout, ensure_ascii=False)
