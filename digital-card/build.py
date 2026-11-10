"""Build an independent, offline-capable Evpower iPhone/Android contact card."""
import argparse
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
from io import BytesIO
import base64
import hashlib
import html
import json
import re
from urllib.parse import quote, urlencode, urlparse
import shutil
import sys
import qrcode
import qrcode.image.svg

ROOT = Path(__file__).resolve().parent
UI = ROOT / 'ui'
APP = ROOT / 'app'
DIST = ROOT / 'dist'
DATA = json.loads((ROOT / 'card-data.json').read_text())
VCARD_NAME = 'evpower-ahmed-kemal.vcf'
PROFILE = 'ahmed'


def vescape(value):
    return str(value).replace('\\', '\\\\').replace('\r\n', '\n').replace('\r', '\n').replace('\n', '\\n').replace(';', '\\;').replace(',', '\\,')


def fold_line(value):
    remaining = value.encode('utf-8')
    result = []
    prefix = ''
    while remaining:
        end = min(75 - len(prefix), len(remaining))
        while end < len(remaining) and remaining[end] & 0xC0 == 0x80:
            end -= 1
        result.append(prefix + remaining[:end].decode('utf-8'))
        remaining = remaining[end:]
        prefix = ' '
    return '\r\n'.join(result) if result else ''


def make_vcard(data):
    parts = data['full_name'].split()
    given = parts[0] if parts else data['company']
    family = ' '.join(parts[1:])
    lines = [
        'BEGIN:VCARD', 'VERSION:3.0',
        f'N:{vescape(family)};{vescape(given)};;;',
        'FN:' + vescape(data['full_name'] or data['company']),
        'ORG:' + vescape(data['company']),
        'TITLE:' + vescape(data['designation']),
        'TEL;TYPE=WORK,VOICE:' + data['phone'],
        'TEL;TYPE=WORK,VOICE:' + data['toll_free'],
        'item1.TEL;TYPE=CELL:' + data['whatsapp'],
        'item1.X-ABLabel:WhatsApp',
        'EMAIL;TYPE=WORK:' + data['email'],
        'URL:' + data['website'],
        'ADR;TYPE=WORK:;;;' + vescape(data['city']) + ';;;' + vescape(data['country']),
        'NOTE:' + vescape('WhatsApp: https://wa.me/' + re.sub(r'\D', '', data['whatsapp'])),
        'END:VCARD',
    ]
    return '\r\n'.join(fold_line(line) for line in lines) + '\r\n'


def make_qr(vcard):
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=4)
    qr.add_data(vcard.encode('utf-8'), optimize=0)
    qr.make(fit=True)
    qr.make_image(fill_color='black', back_color='white').save(DIST / 'evpower-contact-qr.png')
    image = qr.make_image(image_factory=qrcode.image.svg.SvgPathFillImage)
    buffer = BytesIO()
    image.save(buffer)
    svg = re.sub(r'<\?xml[^>]*\?>\s*', '', buffer.getvalue().decode())
    svg = svg.replace('<svg ', '<svg role="img" aria-label="Scan to save ' + html.escape(DATA['full_name'], quote=True) + ' contact" shape-rendering="crispEdges" ', 1)
    (DIST / 'evpower-contact-qr.svg').write_text(svg)
    return svg, qr.version


def inline_json(data):
    return json.dumps(data, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')


def make_html(data, vcard, svg, standalone=False):
    charging=data.get('visual_panel')=='charging'
    logo = ('data:image/png;base64,' + base64.b64encode((UI / 'assets/logo.png').read_bytes()).decode()) if standalone else 'assets/logo.png'
    emblem = ('data:image/png;base64,' + base64.b64encode((UI / 'assets/emblem.png').read_bytes()).decode()) if standalone else 'assets/emblem.png'
    qr_png = ('data:image/png;base64,' + base64.b64encode((DIST / 'evpower-contact-qr.png').read_bytes()).decode()) if standalone else 'assets/evpower-contact-qr.png'
    def scene_asset(name):
        return ('data:image/png;base64,' + base64.b64encode((UI/'assets'/name).read_bytes()).decode()) if standalone else 'assets/'+name
    card_config = {
        'company':data['company'], 'fullName':data['full_name'], 'designation':data['designation'],
        'phone':data['phone'], 'whatsapp':data['whatsapp'], 'tollFree':data['toll_free'], 'email':data['email'],
        'website':data['website'], 'address':data['address'], 'cardUrl':'',
        'vcard':vcard, 'downloadName':VCARD_NAME, 'allowLocationShare':data.get('share_app_link',True),
        'parentAppScope':data.get('parent_app_scope',''),
        'offlineApp':not standalone,
    }
    values = {
        'LOGO_URL':logo, 'EMBLEM_URL':emblem, 'COMPANY':data['company'], 'NAME':data['full_name'],
        'CARD_CLASS':'evpc-card evpc-card--charging' if charging else 'evpc-card',
        'CAR_ASSET_URL':scene_asset('ev-car-realistic.png') if charging else '',
        'CHARGER_ASSET_URL':scene_asset('ev-charger-realistic.png') if charging else '',
        'DESIGNATION':data['designation'], 'TAGLINE':data['tagline'],
        'PHONE_URL':'tel:' + data['phone'], 'PHONE_DISPLAY':data['phone_display'],
        'WHATSAPP_URL':'https://wa.me/' + re.sub(r'\D','',data['whatsapp']),
        'WHATSAPP_DISPLAY':data['whatsapp_display'], 'EMAIL_URL':'mailto:' + data['email'],
        'EMAIL':data['email'], 'WEBSITE_URL':data['website'],
        'WEBSITE_DISPLAY':urlparse(data['website']).netloc,
        'ADDRESS':data['address'],
        'MAP_URL':'https://www.google.com/maps/search/?' + urlencode({'api':'1','query':data['address']}),
        'TOLL_FREE_URL':'tel:' + data['toll_free'], 'TOLL_FREE':data['toll_free'],
        'VCARD_URL':('data:text/vcard;charset=utf-8,' + quote(vcard, safe='')) if standalone else 'assets/' + VCARD_NAME,
        'QR_PNG_URL':qr_png,
        'SHOW_QR_URL':qr_png if charging else '#evpc-qr-panel',
        'CARD_URL':'', 'QR_LABEL':'Scan to save contact', 'VCARD_NAME':VCARD_NAME,
        'SHARE_LABEL':'Share card' if data.get('share_app_link',True) else 'Share contact',
        'INSTALL_LABEL':data.get('install_label','Add to phone'),
    }
    tokens = {key:html.escape(value, quote=True) for key,value in values.items()}
    tokens['SERVICES'] = ''.join('<li>' + html.escape(service) + '</li>' for service in data['services'])
    tokens['QR_SVG'] = svg
    tokens['SHOW_QR_DOWNLOAD'] = ' download="evpower-contact-qr.png"' if charging and standalone else ''
    tokens['CONFIG_JSON'] = inline_json(card_config)
    details=(UI / 'templates/contact-details.html').read_text().rstrip('\n')
    tokens['CONTACT_DETAILS'] = '      '+re.sub(r'\{\{([A-Z_]+)\}\}',lambda match:tokens[match.group(1)],details) if data.get('show_contact_details',True) else ''
    extra_actions=(UI / 'templates/extra-contact-actions.html').read_text().rstrip('\n')
    tokens['EXTRA_CONTACT_ACTIONS'] = '\n        '+re.sub(r'\{\{([A-Z_]+)\}\}',lambda match:tokens[match.group(1)],extra_actions) if data.get('extra_contact_actions',False) else ''
    tokens['CHARGING_SCENE'] = re.sub(r'\{\{([A-Z_]+)\}\}',lambda match:tokens[match.group(1)],(UI / 'templates/charging-scene.html').read_text().rstrip('\n')) if charging else ''
    panel=(UI / 'templates'/('charging-panel.html' if charging else 'qr-panel.html')).read_text().rstrip('\n')
    tokens['VISUAL_PANEL'] = '    '+re.sub(r'\{\{([A-Z_]+)\}\}',lambda match:tokens[match.group(1)],panel)
    template = (UI / 'templates/preloader.html').read_text() + (UI / 'templates/card.html').read_text()
    body = re.sub(r'\{\{([A-Z_]+)\}\}', lambda match: tokens[match.group(1)], template)
    assert not re.search(r'\{\{[A-Z_]+\}\}', body)
    css = (UI / 'assets/preloader.css').read_text() + (UI / 'assets/card.css').read_text()
    js = (UI / 'assets/card.js').read_text()
    if charging:
        css += (UI / 'assets/charging-scene.css').read_text()
        js += '\n' + (UI / 'assets/charging-scene.js').read_text()
    name=html.escape(data['full_name'],quote=True)
    description=html.escape(data['full_name']+', '+data['designation']+' at '+data['company']+'. Contact card and scannable contact QR.',quote=True)
    app_name=html.escape(data.get('app_short_name',data['company']),quote=True)
    head = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0754de"><meta name="description" content="'+description+'"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="'+app_name+'"><meta name="mobile-web-app-capable" content="yes"><title>'+name+' | Evpower Card</title>'
    head += '<style>.evpc-preloader{display:none}</style><script>' + (UI / 'assets/preloader-boot.js').read_text() + '</script>'
    if standalone:
        document = head + '<style>html,body{margin:0;min-height:100%;background:#f4f8fc}' + css + '</style></head><body>' + body + '<script>' + js + '</script></body></html>'
        (DIST / 'evpower-card-standalone.html').write_text(document)
    else:
        scene_assets='<link rel="stylesheet" href="assets/charging-scene.css"><script defer src="assets/charging-scene.js"></script>' if charging else ''
        document = head + '<link rel="manifest" href="app.webmanifest"><link rel="apple-touch-icon" href="assets/icon-180.png"><link rel="icon" href="assets/icon-192.png"><link rel="stylesheet" href="assets/preloader.css"><link rel="stylesheet" href="assets/card.css"><script defer src="assets/card.js"></script>'+scene_assets+'</head><body>' + body + '</body></html>'
        (APP / 'index.html').write_text(document)


def render_icons():
    from playwright.sync_api import sync_playwright
    output=ROOT/'test-output'
    output.mkdir(exist_ok=True)
    digest=hashlib.sha256((UI/'assets/emblem.png').read_bytes()).hexdigest()
    marker=output/'icon-source.sha256'
    source_icons=ROOT/'app/assets'
    if APP != ROOT/'app' and marker.exists() and marker.read_text()==digest and all((source_icons/f'icon-{size}.png').exists() for size in [180,192,512]):
        for size in [180,192,512]: shutil.copy2(source_icons/f'icon-{size}.png',APP/f'assets/icon-{size}.png')
        return
    if marker.exists() and marker.read_text()==digest and all((APP/f'assets/icon-{size}.png').exists() for size in [180,192,512]):
        return
    image='data:image/png;base64,'+base64.b64encode((UI/'assets/emblem.png').read_bytes()).decode()
    document='''<html><head><style>html,body{margin:0;width:100%;height:100%;background:white}.icon{position:relative;box-sizing:border-box;width:100vw;height:100vw;border:2.4vw solid #0754de;border-radius:20vw;background:white;overflow:hidden}.art{position:absolute;inset:26% 4% 22%;overflow:hidden}.art img{position:absolute;top:50%;width:100%;transform:translateY(-50%)}.line{position:absolute;left:27%;right:27%;bottom:17%;height:2%;border-radius:99px;background:linear-gradient(90deg,#0754de,#00cde8)}</style></head><body><div class="icon"><div class="art"><img src="IMAGE" alt=""></div><div class="line"></div></div></body></html>'''.replace('IMAGE',image)
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        for size in [180,192,512]:
            page=browser.new_page(viewport={'width':size,'height':size},device_scale_factor=1)
            page.set_content(document,wait_until='load')
            page.locator('img').evaluate('(img)=>img.decode()')
            page.screenshot(path=str(APP/f'assets/icon-{size}.png'))
            page.close()
        browser.close()
    marker.write_text(digest)


def make_app(vcard,svg):
    assets=APP/'assets'
    assets.mkdir(parents=True,exist_ok=True)
    for name in ['logo.png','emblem.png','preloader.css','card.css','card.js']:
        shutil.copy2(UI/'assets'/name,assets/name)
    if DATA.get('visual_panel')=='charging':
        for name in ['charging-scene.css','charging-scene.js','ev-car-realistic.png','ev-charger-realistic.png']:shutil.copy2(UI/'assets'/name,assets/name)
    for name in [VCARD_NAME,'evpower-contact-qr.png','evpower-contact-qr.svg']:
        shutil.copy2(DIST/name,assets/name)
    make_html(DATA,vcard,svg)
    make_html(DATA,vcard,svg,standalone=True)
    render_icons()
    settings={
        'id':'./','name':DATA['full_name']+' | Evpower Card','short_name':DATA.get('app_short_name','Evpower'),
        'description':DATA['full_name']+', '+DATA['designation']+'. Offline contact card and scannable contact QR.',
        'start_url':'./','scope':'./','display':'standalone','orientation':'portrait',
        'background_color':'#f4f8fc','theme_color':'#0754de','lang':'en',
        'icons':[{'src':f'assets/icon-{size}.png','sizes':f'{size}x{size}','type':'image/png','purpose':'any'} for size in [192,512]],
    }
    (APP/'app.webmanifest').write_text(json.dumps(settings,indent=2)+'\n')
    (APP/'.nojekyll').write_text('')
    (APP/'.htaccess').write_text('''<IfModule mod_mime.c>
AddType application/manifest+json .webmanifest
AddType text/vcard .vcf
</IfModule>
<IfModule mod_headers.c>
<FilesMatch "^(index\\.html|service-worker\\.js|app\\.webmanifest)$">
Header set Cache-Control "no-cache"
</FilesMatch>
</IfModule>
''')
    published_url='https://evpower1.github.io/charge/'+('' if PROFILE=='ahmed' else PROFILE+'/')
    hosting_folder='evpower-card'+('' if PROFILE=='ahmed' else '-'+PROFILE)
    (APP/'INSTALL.txt').write_text(('''EVPOWER PHONE CARD — CARD_OWNER

FREE GITHUB PAGES OPTION (no Hostinger upload):
The repository's evpower-card branch contains the deployable card.
In https://github.com/Evpower1/charge/settings/pages choose Deploy from a branch,
branch evpower-card, folder /(root), then Save.
After GitHub finishes deployment, open CARD_URL.
The link is not live until Pages is enabled and deployment completes.

OPTIONAL HOSTINGER SETUP:

1. Upload evpower-card-app.zip into Hostinger File Manager > public_html.
2. Extract it there. It creates a separate CARD_FOLDER folder.
3. Open https://YOUR-DOMAIN/CARD_FOLDER/ using HTTPS.
4. iPhone: Safari > Share > Add to Home Screen.
5. Android: browser menu > Install app / Add to Home screen, if available.
6. Wait for Ready offline on the card. It now works without internet.
7. Tap Show my QR; another person scans with their camera and adds the contact.

The app is an independent home-screen web app for Android and iPhone.
It does not need WordPress, a login, or an app-store account.
The ZIP is a hosting package; install the phone app from its HTTPS link.
The card QR contains contact details directly and needs no website to scan.
The card also works as a normal page in other browsers; bookmark it if there is
no install option. In an embedded browser, choose Open in browser if needed.
If offline storage is unavailable, save the QR image in Photos/Gallery instead.
QR scans save the contact only; they do not open or install the card app.
This is a public web app. Anyone with its page link can open or install it.
''').replace('CARD_OWNER',DATA['full_name'].upper()).replace('CARD_URL',published_url).replace('CARD_FOLDER',hosting_folder))
    files=sorted(str(p.relative_to(APP)) for p in APP.rglob('*') if p.is_file() and p.name not in ['service-worker.js','.htaccess','.nojekyll','INSTALL.txt'])
    digest=hashlib.sha256(b''.join((APP/name).read_bytes() for name in files)).hexdigest()[:14]
    worker='''/* Each card owns only its exact page and precached assets. */
const SCOPE=new URL(self.registration.scope);
const PREFIX='evpower-card-v2:'+encodeURIComponent(SCOPE.href)+':';
const CACHE=PREFIX+'VERSION';
const FILES=FILES_JSON;
const URLs=FILES.map(path=>new URL(path,self.registration.scope).href);
const ALLOWED=new Set(URLs);
const INDEX=new URL('index.html',self.registration.scope).href;
const INDEX_PATH=new URL(INDEX).pathname;
const READY={type:'EVPC_CACHE_READY',scope:self.registration.scope};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(URLs)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()).then(()=>self.clients.matchAll()).then(clients=>clients.forEach(client=>client.postMessage(READY))))});
self.addEventListener('message',event=>{if(event.data&&event.data.type==='EVPC_CHECK_READY'){event.waitUntil(caches.open(CACHE).then(cache=>Promise.all(URLs.map(url=>cache.match(url)))).then(results=>{if(results.every(Boolean)&&event.source)event.source.postMessage(READY)}))}});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==SCOPE.origin)return;
  if(event.request.mode==='navigate'&&(url.pathname===SCOPE.pathname||url.pathname===INDEX_PATH)){
    const fallback=()=>caches.open(CACHE).then(cache=>cache.match(INDEX)).then(cached=>cached||new Response('Open this card online once to prepare offline access.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}}));
    event.respondWith(fetch(event.request).then(response=>{if(!response.ok)return fallback();const copy=response.clone();return caches.open(CACHE).then(cache=>cache.put(INDEX,copy)).then(()=>response)}).catch(fallback));
  }else{
    if(!ALLOWED.has(url.href))return;
    event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request)).then(cached=>cached||fetch(event.request)));
  }
});
'''.replace('FILES_JSON',json.dumps(files)).replace('VERSION',digest)
    (APP/'service-worker.js').write_text(worker)
    for path in [APP]+list(APP.rglob('*')):
        path.chmod(0o755 if path.is_dir() else 0o644)


def package_app():
    folder='evpower-card'+('' if PROFILE=='ahmed' else '-'+PROFILE)
    with ZipFile(DIST/'evpower-card-app.zip','w',compression=ZIP_DEFLATED,compresslevel=9) as archive:
        for path in [APP]+sorted(APP.rglob('*')):
            relative=folder+('/'+str(path.relative_to(APP)) if path!=APP else '')
            entry=ZipInfo(relative+('/' if path.is_dir() else ''),date_time=(2026,11,9,0,0,0))
            if path.is_dir(): entry.external_attr=(0o40755<<16)|0x10;archive.writestr(entry,b'')
            else:
                entry.external_attr=0o100644<<16;entry.compress_type=ZIP_DEFLATED
                archive.writestr(entry,path.read_bytes())


def manifest():
    entries={}
    for file in sorted(DIST.iterdir()):
        if file.is_file() and file.name!='manifest.json':
            entries[file.name]={'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}
    (DIST/'manifest.json').write_text(json.dumps(entries,indent=2)+'\n')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile',help='Profile folder name under profiles/; default is Ahmed')
    args=parser.parse_args()
    if args.profile:
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',args.profile): parser.error('Profile must be a lowercase folder name')
        PROFILE=args.profile
        directory=ROOT/'profiles'/PROFILE
        DATA=json.loads((directory/'card-data.json').read_text())
        APP=directory/'app'
        DIST=directory/'dist'
        slug=re.sub(r'[^a-z0-9]+','-',DATA['full_name'].lower()).strip('-')
        VCARD_NAME='evpower-'+slug+'.vcf'
    DIST.mkdir(exist_ok=True)
    vcard=make_vcard(DATA)
    (DIST/VCARD_NAME).write_bytes(vcard.encode('utf-8'))
    svg,version=make_qr(vcard)
    make_app(vcard,svg)
    package_app()
    manifest()
    print(f'Built standalone phone card: {len(vcard.encode())} contact bytes, QR version {version}, offline app and hosting ZIP.')
