"""Erzeugt public/places.json aus EKATTE (NSI) für das Netzgebiet von ERM Zapad."""
import json, os
D = os.path.dirname(__file__)
OBL = {"BLG": "БЛАГОЕВГРАД", "VID": "ВИДИН", "VRC": "ВРАЦА", "KNL": "КЮСТЕНДИЛ", "LOV": "ЛОВЕЧ",
       "MON": "МОНТАНА", "PER": "ПЕРНИК", "PVN": "ПЛЕВЕН", "SFO": "СОФИЙСКА", "SOF": "СОФИЯ-ГРАД"}
obl = {o["oblast"]: o for o in json.load(open(f"{D}/ek_obl.json")) if o.get("oblast")}
obs = {o["obshtina"]: o for o in json.load(open(f"{D}/ek_obst.json")) if o.get("obshtina")}
out = []
# Andere Netzbetreiber: Orte trotzdem auffindbar, damit die Suche sagen kann, wer zuständig ist
OTHER = {**{k: "EVN" for k in "PDV PAZ SZR HKV KRZ SML BGS JAM SLV".split()},
         **{k: "ENERGO-PRO" for k in "VAR DOB SHU TGV RAZ SLS RSE VTR GAB".split()}}
for a in json.load(open(f"{D}/ek_atte.json")):
    if a.get("oblast") not in OBL and a.get("oblast") not in OTHER: continue
    o, b = obl[a["oblast"]], obs[a["obshtina"]]
    # [EKATTE, Name, Name lat., Gemeinde, Gemeinde lat., Region, Region lat., Typ (гр./с./ман.), anderer Netzbetreiber oder ""]
    out.append([a["ekatte"], a["name"], a["name_en"], b["name"], b["name_en"], o["name"], o["name_en"], a["t_v_m"], OTHER.get(a["oblast"], "")])
out.sort(key=lambda r: r[1])
json.dump(out, open(f"{D}/../public/places.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "Orte")
