"""Build Ahmed's independent, offline-capable iPhone/Android home-screen card."""
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
    svg = svg.replace('<svg ', '<svg role="img" aria-label="Scan to save Ahmed Kemal contact" shape-rendering="crispEdges" ', 1)
    (DIST / 'evpower-contact-qr.svg').write_text(svg)
    return svg, qr.version


def inline_json(data):
    return json.dumps(data, ensure_ascii=False).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')


def make_html(data, vcard, svg, standalone=False):
    logo = ('data:image/png;base64,' + base64.b64encode((UI / 'assets/logo.png').read_bytes()).decode()) if standalone else 'assets/logo.png'
    card_config = {
        'company':data['company'], 'fullName':data['full_name'], 'designation':data['designation'],
        'phone':data['phone'], 'whatsapp':data['whatsapp'], 'tollFree':data['toll_free'], 'email':data['email'],
        'website':data['website'], 'address':data['address'], 'cardUrl':'',
        'vcard':vcard, 'downloadName':VCARD_NAME, 'allowLocationShare':True,
        'offlineApp':not standalone,
    }
    values = {
        'LOGO_URL':logo, 'COMPANY':data['company'], 'NAME':data['full_name'],
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
        'QR_PNG_URL':('data:image/png;base64,' + base64.b64encode((DIST / 'evpower-contact-qr.png').read_bytes()).decode()) if standalone else 'assets/evpower-contact-qr.png',
        'CARD_URL':'', 'QR_LABEL':'Scan to save contact',
    }
    tokens = {key:html.escape(value, quote=True) for key,value in values.items()}
    tokens['SERVICES'] = ''.join('<li>' + html.escape(service) + '</li>' for service in data['services'])
    tokens['QR_SVG'] = svg
    tokens['CONFIG_JSON'] = inline_json(card_config)
    template = (UI / 'templates/card.html').read_text()
    body = re.sub(r'\{\{([A-Z_]+)\}\}', lambda match: tokens[match.group(1)], template)
    assert not re.search(r'\{\{[A-Z_]+\}\}', body)
    css = (UI / 'assets/card.css').read_text()
    js = (UI / 'assets/card.js').read_text()
    head = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#0754de"><meta name="description" content="Ahmed Kemal, Founder &amp; CEO at Evpower. Contact card and scannable contact QR."><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="apple-mobile-web-app-title" content="Evpower"><meta name="mobile-web-app-capable" content="yes"><title>Ahmed Kemal | Evpower Card</title>'
    if standalone:
        document = head + '<style>html,body{margin:0;min-height:100%;background:#f4f8fc}' + css + '</style></head><body>' + body + '<script>' + js + '</script></body></html>'
        (DIST / 'evpower-card-standalone.html').write_text(document)
    else:
        document = head + '<link rel="manifest" href="app.webmanifest"><link rel="apple-touch-icon" href="assets/icon-180.png"><link rel="icon" href="assets/icon-192.png"><link rel="stylesheet" href="assets/card.css"><script defer src="assets/card.js"></script></head><body>' + body + '</body></html>'
        (APP / 'index.html').write_text(document)


def render_icons():
    from playwright.sync_api import sync_playwright
    output=ROOT/'test-output'
    output.mkdir(exist_ok=True)
    digest=hashlib.sha256((UI/'assets/emblem.png').read_bytes()).hexdigest()
    marker=output/'icon-source.sha256'
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
    for name in ['logo.png','card.css','card.js']:
        shutil.copy2(UI/'assets'/name,assets/name)
    for name in [VCARD_NAME,'evpower-contact-qr.png','evpower-contact-qr.svg']:
        shutil.copy2(DIST/name,assets/name)
    make_html(DATA,vcard,svg)
    make_html(DATA,vcard,svg,standalone=True)
    render_icons()
    settings={
        'id':'./','name':'Ahmed Kemal | Evpower Card','short_name':'Evpower',
        'description':'Ahmed Kemal, Founder & CEO. Offline contact card and scannable contact QR.',
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
    (APP/'INSTALL.txt').write_text('''EVPOWER PHONE CARD — AHMED KEMAL

FREE GITHUB PAGES OPTION (no Hostinger upload):
The repository's evpower-card branch contains the deployable card.
In https://github.com/Evpower1/charge/settings/pages choose Deploy from a branch,
branch evpower-card, folder /(root), then Save.
After GitHub finishes deployment, open https://evpower1.github.io/charge/.
The link is not live until Pages is enabled and deployment completes.

OPTIONAL HOSTINGER SETUP:

1. Upload evpower-card-app.zip into Hostinger File Manager > public_html.
2. Extract it there. It creates a separate evpower-card folder.
3. Open https://YOUR-DOMAIN/evpower-card/ using HTTPS.
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
''')
    files=sorted(str(p.relative_to(APP)) for p in APP.rglob('*') if p.is_file() and p.name not in ['service-worker.js','.htaccess','.nojekyll','INSTALL.txt'])
    digest=hashlib.sha256(b''.join((APP/name).read_bytes() for name in files)).hexdigest()[:14]
    worker='''/* Offline storage is scoped only to this card app. */
const CACHE='evpower-phone-card-VERSION';
const FILES=FILES_JSON;
const URLs=FILES.map(path=>new URL(path,self.registration.scope).href);
const INDEX=new URL('index.html',self.registration.scope).href;
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(URLs)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('evpower-phone-card-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()).then(()=>self.clients.matchAll()).then(clients=>clients.forEach(client=>client.postMessage({type:'EVPC_CACHE_READY'}))))});
self.addEventListener('message',event=>{if(event.data&&event.data.type==='EVPC_CHECK_READY'){event.waitUntil(caches.open(CACHE).then(cache=>Promise.all(URLs.map(url=>cache.match(url)))).then(results=>{if(results.every(Boolean)&&event.source)event.source.postMessage({type:'EVPC_CACHE_READY'})}))}});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(INDEX,copy));return response}return caches.match(INDEX).then(cached=>cached||response)}).catch(()=>caches.match(INDEX)));
  }else{
    event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
  }
});
'''.replace('FILES_JSON',json.dumps(files)).replace('VERSION',digest)
    (APP/'service-worker.js').write_text(worker)
    for path in [APP]+list(APP.rglob('*')):
        path.chmod(0o755 if path.is_dir() else 0o644)


def package_app():
    with ZipFile(DIST/'evpower-card-app.zip','w',compression=ZIP_DEFLATED,compresslevel=9) as archive:
        for path in [APP]+sorted(APP.rglob('*')):
            relative='evpower-card'+('/'+str(path.relative_to(APP)) if path!=APP else '')
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
    DIST.mkdir(exist_ok=True)
    vcard=make_vcard(DATA)
    (DIST/VCARD_NAME).write_bytes(vcard.encode('utf-8'))
    svg,version=make_qr(vcard)
    make_app(vcard,svg)
    package_app()
    manifest()
    print(f'Built standalone phone card: {len(vcard.encode())} contact bytes, QR version {version}, offline app and hosting ZIP.')
