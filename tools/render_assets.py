"""Erzeugt App-Icons, Badge und Facebook-Vorschaubild (og.png) per Chrome headless."""
import json, os, subprocess
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), "..")
R = os.path.join(ROOT, "tools", "render")
os.makedirs(R, exist_ok=True)
CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
svg = json.loads(open(os.path.join(ROOT, "public/icons.js")).read().split("window.ICONS=")[1].rstrip(";\n"))["zap-off"]
def sized(pct, sw="2.2"):
    return svg.replace('class="lucide"', 'width="%s" height="%s" stroke-width="%s"' % (pct, pct, sw))
def page(name, body, w, h):
    html = '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:%dpx;height:%dpx;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,sans-serif}</style>%s' % (w, h, body)
    open(os.path.join(R, name + ".html"), "w").write(html)
    out = os.path.join(R, name + ".png")
    subprocess.run([CH, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000",
                    "--window-size=%d,%d" % (max(w, 500), max(h, 500)), "--screenshot=" + out, "file://" + os.path.join(R, name + ".html")],
                   stderr=subprocess.DEVNULL, check=True)
    return Image.open(out).convert("RGBA").crop((0, 0, w, h))
box = '<div style="width:512px;height:512px;background:#facc15;%sdisplay:grid;place-items:center;color:#0f172a">%s</div>'
icon = page("icon", box % ("border-radius:112px;", sized("62%")), 512, 512)
icon.save(os.path.join(ROOT, "public/icon-512.png"))
icon.resize((192, 192), Image.LANCZOS).save(os.path.join(ROOT, "public/icon-192.png"))
page("maskable", box % ("", sized("48%")), 512, 512).save(os.path.join(ROOT, "public/icon-maskable-512.png"))
page("apple", box % ("", sized("58%")), 512, 512).convert("RGB").resize((180, 180), Image.LANCZOS).save(os.path.join(ROOT, "public/apple-touch-icon.png"))
page("badge", '<div style="width:96px;height:96px;display:grid;place-items:center;color:#000">%s</div>' % sized("84", "2.4"), 96, 96).save(os.path.join(ROOT, "public/badge-96.png"))
og = """<div style="width:1200px;height:630px;background:#0f172a;color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box">
<div style="display:flex;align-items:center;gap:22px;font-size:34px;font-weight:650;color:#e2e8f0"><div style="width:84px;height:84px;border-radius:22px;background:#facc15;color:#0f172a;display:grid;place-items:center">%s</div>Ток · ЕРМ Запад</div>
<div style="font-size:76px;font-weight:800;line-height:1.05;margin-top:40px;letter-spacing:-1px">Планирани спирания<br>на тока</div>
<div style="font-size:34px;color:#cbd5e1;margin-top:26px">Известие на телефона за вашето населено място</div>
<div style="font-size:26px;color:#94a3b8;margin-top:14px">Planned power cuts · free notifications</div></div>""" % sized("52", "2")
page("og", og, 1200, 630).convert("RGB").save(os.path.join(ROOT, "public/og.png"))
print("ok")
