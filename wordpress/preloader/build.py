"""Package the standalone plugin and a self-contained browser preview."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import base64
import hashlib
import json

ROOT = Path(__file__).resolve().parent
PLUGIN = ROOT / 'evpower-preloader'
DIST = ROOT / 'dist'
DIST.mkdir(exist_ok=True)
image = 'data:image/png;base64,' + base64.b64encode((PLUGIN / 'assets/emblem.png').read_bytes()).decode()
css = (PLUGIN / 'assets/preloader.css').read_text()
js = (PLUGIN / 'assets/preloader.js').read_text()
markup = f'''<div id="evp-preloader" class="evp-preloader" data-evp-preloader role="status" aria-label="Loading Evpower" aria-live="polite">
<div class="evp-preloader__inner"><div class="evp-preloader__emblem">
<img class="evp-preloader__image" src="{image}" alt="" width="1254" height="1254" loading="eager" decoding="async" fetchpriority="high">
<svg class="evp-preloader__pulse" viewBox="0 0 1254 1254" aria-hidden="true" focusable="false"><path d="M 340 710 H 560 Q 595 710 610 680 L 687 535 L 724 784 L 780 670 Q 793 646 820 646 H 943"/></svg>
</div><div class="evp-preloader__track" aria-hidden="true"><span></span></div><p class="evp-preloader__caption">Powering your journey</p></div>
<button type="button" class="evp-preloader__skip" data-evp-skip>Skip animation</button></div>'''
demo = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Evpower preloader preview</title>
<style>BODY_CSS
body{margin:0;min-height:100vh;background:#f7fafe;color:#253343;font:16px/1.6 ui-sans-serif,system-ui,sans-serif}
main{width:min(85vw,740px);margin:0 auto;padding:clamp(120px,23vh,220px) 0 80px}h1{font-size:clamp(36px,6vw,60px);line-height:1.1;letter-spacing:-.04em;margin:20px 0}main p{color:#6d7888;max-width:530px}.eyebrow{font-size:11px;font-weight:700;letter-spacing:.18em;color:#0754de}
.preview-controls{position:fixed;top:14px;right:14px;display:flex;gap:8px;z-index:2147483500}.preview-controls button{min-height:44px;border:1px solid #dce7f2;border-radius:8px;padding:9px 14px;background:#fff;color:#52667c;font:500 12px/1.4 ui-sans-serif,system-ui;cursor:pointer}.preview-controls button:hover{background:#f0f8ff;border-color:#0754de}.preview-controls button:focus-visible{outline:2px solid #0754de;outline-offset:3px}
html.evp-recording .preview-controls,html.evp-recording .evp-preloader__skip{display:none}
html.evp-recording .evp-preloader__inner{padding:8px;gap:14px;transform:none}html.evp-recording .evp-preloader__emblem{width:min(88vw,420px)}
</style><script>if(new URLSearchParams(location.search).has('record'))document.documentElement.classList.add('evp-recording');window.evpPreloaderConfig={sessionOnly:false,maxWait:10000,preview:true};</script><script>BODY_JS</script></head><body>
BODY_MARKUP
<div class="preview-controls" aria-label="Preloader preview controls"><button type="button" id="replay">Replay</button><button type="button" id="finish">Show page</button></div>
<main><span class="eyebrow">EVPOWER · PRELOADER PREVIEW</span><h1>Your page is ready.</h1><p>The emblem carries a charging pulse into the connector. On your website the preloader fades away when the page finishes loading.</p><p>Select Replay to watch again. This preview clears after a few seconds; the website version also has a skip button and respects reduced-motion settings.</p></main>
<script>document.getElementById('replay').addEventListener('click',function(){window.EvpowerPreloader.show({force:true})});document.getElementById('finish').addEventListener('click',function(){window.EvpowerPreloader.hide()});</script></body></html>'''
demo = demo.replace('BODY_CSS', css).replace('BODY_JS', js).replace('BODY_MARKUP', markup)
(DIST / 'evpower-preloader-preview.html').write_text(demo)

archive_path = DIST / 'evpower-preloader.zip'
with ZipFile(archive_path, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for directory in [PLUGIN] + sorted(path for path in PLUGIN.rglob('*') if path.is_dir()):
        directory.chmod(0o755)
        entry = ZipInfo(str(directory.relative_to(ROOT)) + '/', date_time=(2026, 11, 9, 0, 0, 0))
        entry.external_attr = (0o40755 << 16) | 0x10
        archive.writestr(entry, b'')
    for file in sorted(PLUGIN.rglob('*')):
        if not file.is_file():
            continue
        entry = ZipInfo(str(file.relative_to(ROOT)), date_time=(2026, 11, 9, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        archive.writestr(entry, file.read_bytes())

manifest = {}
for file in sorted(DIST.iterdir()):
    if file.is_file() and file.name != 'manifest.json':
        manifest[file.name] = {'bytes': file.stat().st_size, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}
(DIST / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Built WordPress plugin ZIP and self-contained HTML preview.')
