"""Extract only the published EV charging scene as an offline HTML animation."""
import base64
import hashlib
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parent
ASSETS=ROOT/'ui/assets'
DEST=ROOT/'animation-downloads'
DEST.mkdir(exist_ok=True)
source=(ROOT/'ui/templates/charging-scene.html').read_text()
source=re.sub(r'  <div class="evpc-scene-heading">.*?</div>\s*','',source,flags=re.S)
source=re.sub(r'  <div class="evpc-scene-tools">.*?</div>\s*','',source,flags=re.S)
assert '{{QR_' not in source and '<h2' not in source
for token,name in [('CAR_ASSET_URL','ev-car-realistic.png'),('CHARGER_ASSET_URL','ev-charger-realistic.png')]:
    uri='data:image/png;base64,'+base64.b64encode((ASSETS/name).read_bytes()).decode()
    source=source.replace('{{'+token+'}}',uri)
assert '{{' not in source
js=(ASSETS/'charging-scene.js').read_text()
js=js.replace('var initialTime = 11.4;', 'var initialTime = 0;')
js=js.replace('function mayRun() { return assetsReady', 'function mayRun() { return !window.__EVPOWER_CAPTURE__ && assetsReady')
marker='    still();\n    if (toggle)'
assert marker in js
js=js.replace(marker,'''    if (window.__EVPOWER_CAPTURE__) window.__EVPOWER_SCENE__ = {seek:render, duration:duration};
    still();
    if (toggle)''',1)
css=(ASSETS/'charging-scene.css').read_text()
custom='''
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}
body{display:flex;align-items:center;justify-content:center;background:#0754de;font-family:Arial,Helvetica,sans-serif}
main.evpc-card{width:min(100vw,calc(100vh * 4 / 3));margin:0;padding:0;border:0;background:transparent}
.evpc-aside__content.evpc-charging-panel{width:100%;max-width:none}
.evpc-scene-stage{display:grid;grid-template-rows:7fr 1fr;aspect-ratio:4/3;width:100%;margin:0!important;border:0;border-radius:0;box-shadow:none}
.evpc-scene-stage:after{display:none}
.evpc-scene-svg{width:100%;height:100%;max-height:100%;min-height:0}
.evpc-card .evpc-scene-meter{height:100%;min-height:0;gap:12px;padding:clamp(8px,1.9vw,24px) clamp(12px,2.8vw,36px);font-size:clamp(10px,1.9vw,24px)}
.evpc-scene-status,.evpc-scene-battery{font-size:inherit;line-height:1.4}
.evpc-scene-status{gap:clamp(7px,1.25vw,16px)}
.evpc-scene-status__dot{width:clamp(5px,.625vw,8px);height:clamp(5px,.625vw,8px);flex-basis:clamp(5px,.625vw,8px)}
.evpc-scene-battery{gap:clamp(10px,1.56vw,20px);min-width:0}
.evpc-scene-battery__case{width:clamp(46px,7.2vw,92px);height:clamp(14px,2.2vw,28px);border-width:1px;padding:clamp(2px,.31vw,4px)}
.evpc-scene-battery>[data-ev-percent]{min-width:clamp(31px,4.85vw,62px)}
.evpc-scene-asset-note{bottom:12.5%}
@supports(height:100dvh){main.evpc-card{width:min(100vw,calc(100dvh * 4 / 3))}}
'''
html='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Evpower EV charging animation</title><style>'''+css+'\n'+custom+'''</style></head><body><main class="evpc-card" aria-label="Evpower EV charging animation">'''+source+'''</main><script>'''+js+'''</script></body></html>\n'''
output=DEST/'evpower-charging-animation.html';output.write_text(html);output.chmod(0o644)
manifest={'source':'https://evpower1.github.io/charge/kedir/','source_commit':'36587192becc3c9c6747a37e8157c81cc159d48f','duration_seconds':21.6,'files':{output.name:{'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()}},'embedded_images':{name:hashlib.sha256((ASSETS/name).read_bytes()).hexdigest() for name in ['ev-car-realistic.png','ev-charger-realistic.png']}}
(DEST/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Standalone animation HTML built:',output.stat().st_size,'bytes; no card, contact data or QR controls.')
