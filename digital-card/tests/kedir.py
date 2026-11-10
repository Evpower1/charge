"""Verify Kedir's public contact card and its offline isolation from Ahmed's card.

Build both profiles first. This test stages copies under /charge/ and /charge/kedir/
in a temporary server and exports only Kedir's requested preview/contact images.
"""
import asyncio
import base64
from functools import partial
from html import escape
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
import json
from pathlib import Path
import shutil
import tempfile
import threading
from urllib.parse import parse_qs, urljoin, urlparse

from PIL import Image
from playwright.async_api import async_playwright, expect
import zxingcpp


ROOT = Path(__file__).resolve().parents[1]
PROFILE = ROOT / 'profiles/kedir'
APP = PROFILE / 'app'
DIST = PROFILE / 'dist'


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def decode(image, expected):
    result = zxingcpp.read_barcode(Image.open(BytesIO(image)))
    assert result is not None, 'Rendered Kedir QR did not decode'
    assert result.bytes == expected, 'QR contact differs from the profile vCard'


def profile_data():
    data = json.loads((PROFILE / 'card-data.json').read_text())
    files = list(DIST.glob('*.vcf'))
    assert len(files) == 1, 'Kedir profile must contain one contact file'
    contact = files[0].read_bytes()
    assert 'ahmed' not in files[0].name.lower()
    assert 'Kedir' in data['full_name']
    assert data['designation'] == 'Managing Director'
    assert data['phone'] == '+251933606669'
    assert data['whatsapp'] == '+971521170330'
    assert data['email'] == 'Kedir@evpower.et'
    assert data['show_contact_details'] is False
    assert data['extra_contact_actions'] is True
    assert data['visual_panel'] == 'charging'
    assert data['website'] == 'https://www.evpower.et'
    assert data['toll_free'] == '8890'
    assert data['address'] == 'Addis Ababa - Ethiopia'
    assert data['city'] == 'Addis Ababa' and data['country'] == 'Ethiopia'
    for field in [data['full_name'], 'Managing Director', '+251933606669', '+971521170330',
                  'Kedir@evpower.et', 'https://www.evpower.et', '8890', 'Addis Ababa', 'Ethiopia']:
        assert field.encode() in contact, f'Missing vCard detail: {field}'
    assert b'\r\n' in contact
    assert b'URL:https://www.evpower.et' in contact and b'ADR;TYPE=WORK:' in contact
    for forbidden in [b'ahmed', b'github.io', b'/charge/', b'localhost']:
        assert forbidden not in contact.lower(), f'Unexpected QR data: {forbidden!r}'
    decode((DIST / 'evpower-contact-qr.png').read_bytes(), contact)
    return data, contact


async def resources(context, page, url, expected):
    save = page.locator('[data-evpc-save]')
    href = await save.get_attribute('href')
    assert href and href.endswith('.vcf') and not href.startswith(('blob:', 'data:', 'javascript:'))
    response = await context.request.get(urljoin(url, href))
    assert response.ok and await response.body() == expected
    qr = page.locator('[data-evpc-download-qr]')
    assert await qr.evaluate('(node)=>node.tagName') == 'A'
    href = await qr.get_attribute('href')
    assert href and href.endswith('.png') and not href.startswith(('blob:', 'data:', 'javascript:'))
    response = await context.request.get(urljoin(url, href))
    assert response.ok
    decode(await response.body(), expected)


async def show_qr(page, expected):
    await page.locator('[data-evpc-open-qr]').click()
    await expect(page.locator('[data-evpc-qr-modal]')).to_be_visible()
    decode(await page.locator('[data-evpc-modal-code]').screenshot(), expected)
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-evpc-qr-modal]')).to_be_hidden()


async def compact_actions(page, data):
    await expect(page.locator('.evpc-details')).to_have_count(0)
    actions = page.locator('.evpc-actions a')
    await expect(actions).to_have_count(6)
    labels = [text.strip() for text in await actions.all_text_contents()]
    assert labels == ['Call', 'WhatsApp', 'Email', 'Website', 'Toll-free', 'Location']
    assert await page.get_by_role('link', name='Call ' + data['full_name'], exact=True).get_attribute('href') == 'tel:+251933606669'
    assert await page.get_by_role('link', name='Chat with ' + data['full_name'] + ' on WhatsApp', exact=True).get_attribute('href') == 'https://wa.me/971521170330'
    assert await page.get_by_role('link', name='Email ' + data['full_name'], exact=True).get_attribute('href') == 'mailto:Kedir@evpower.et'
    hrefs = {label: await actions.nth(index).get_attribute('href') for index, label in enumerate(labels)}
    assert hrefs['Website'] == 'https://www.evpower.et'
    assert hrefs['Toll-free'] == 'tel:8890'
    maps = urlparse(hrefs['Location'])
    assert maps.scheme == 'https' and maps.hostname in ['www.google.com', 'maps.google.com']
    assert parse_qs(maps.query).get('query') == [data['address']]
    visible = (await page.locator('.evpc-main').inner_text()).lower()
    for duplicate in ['+251 933 606 669', '+971 52 117 0330', 'kedir@evpower.et', 'www.evpower.et', '8890', 'addis ababa']:
        assert duplicate not in visible, f'Duplicate plain contact detail is visible: {duplicate}'


async def export_contact_image(browser, data, contact):
    logo = 'data:image/png;base64,' + base64.b64encode((APP / 'assets/logo.png').read_bytes()).decode()
    svg = (DIST / 'evpower-contact-qr.svg').read_text()
    value = {key: escape(str(item)) for key, item in data.items()}
    markup = f'''<html><head><style>html,body{{margin:0;background:#f1f7ff;font-family:Arial,sans-serif;color:#102338}}.card{{position:relative;box-sizing:border-box;width:1080px;min-height:1700px;padding:60px 80px;background:white;border-top:14px solid #0754de}}.brand{{position:relative;width:920px;height:160px;overflow:hidden}}.brand img{{position:absolute;top:50%;width:100%;transform:translateY(-50%)}}h1{{font-size:64px;letter-spacing:-2px;margin:28px 0 12px}}.role{{font-size:34px;color:#0754de;margin:0 0 44px}}.details{{font-size:30px;line-height:1.8;color:#43576f}}.details strong{{color:#12253d}}.qr{{width:700px;margin:46px auto 24px}}.qr svg{{display:block;width:100%;height:auto}}.caption{{text-align:center;font-size:32px;font-weight:700;color:#0754de}}.tag{{text-align:center;font-size:26px;color:#6e8199;margin-top:30px}}</style></head><body><div class=card><div class=brand><img src="{logo}" alt=Evpower></div><h1>{value['full_name']}</h1><p class=role>{value['designation']}</p><div class=details><strong>Call:</strong> {value['phone_display']}<br><strong>WhatsApp:</strong> {value['whatsapp_display']}<br><strong>Email:</strong> {value['email']}<br><strong>Website:</strong> {value['website'].removeprefix('https://')}<br><strong>Address:</strong> {value['address']}<br><strong>Toll-free:</strong> {value['toll_free']}</div><div class=qr>{svg}</div><p class=caption>Scan to save my contact</p><p class=tag>{value['tagline']}</p></div></body></html>'''
    page = await browser.new_page(viewport={'width': 1080, 'height': 1700}, device_scale_factor=1)
    await page.set_content(markup, wait_until='load')
    await page.locator('img').evaluate('(image)=>image.decode()')
    picture = await page.locator('.card').screenshot(path=str(DIST / 'evpower-kedir-contact-card.png'))
    decode(picture, contact)
    await page.close()
    print('PASS: exported Kedir contact image has the approved branding and exact contact QR', flush=True)


async def layouts_and_share(browser, url, data, contact):
    context = await browser.new_context(viewport={'width': 390, 'height': 844})
    await context.add_init_script("""window.capturedContactShare=null;
        Object.defineProperty(navigator,'share',{configurable:true,value:function(payload){
            window.capturedContactShare=payload;return Promise.resolve();
        }});""")
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    for width in [320, 390, 768, 1440]:
        await page.set_viewport_size({'width': width, 'height': 900 if width > 430 else 844})
        await page.goto(url, wait_until='load')
        await expect(page.locator('h1')).to_have_text(data['full_name'])
        await expect(page.locator('.evpc-designation')).to_have_text('Managing Director')
        await compact_actions(page, data)
        await expect(page.locator('[data-ev-scene]')).to_have_count(1)
        await expect(page.locator('.evpc-aside .evpc-qr__code')).to_have_count(0)
        assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth'), width
        config = json.loads(await page.locator('.evpc-config').text_content())
        assert config['allowLocationShare'] is False
        assert not config.get('cardUrl'), 'The share action must not expose an app URL'
        assert config['website'] == data['website'] and config['address'] == data['address'] and config['tollFree'] == '8890'
        await expect(page.locator('[data-evpc-share]')).to_have_text('Share contact')
        await expect(page.locator('[data-evpc-install]')).to_have_text('Add to my phone')
        await show_qr(page, contact)
        if width == 390:
            await expect(page.locator('[data-evpc-offline-state]')).to_have_text('Ready offline', timeout=15000)
            await page.screenshot(path=str(DIST / 'evpower-card-phone-preview.png'), full_page=True)
        print(f'PASS: Kedir charging panel, six contact actions and decoded full-contact QR modal at {width}px', flush=True)
    await resources(context, page, url, contact)
    manifest = await (await context.request.get(url + 'app.webmanifest')).json()
    assert manifest['id'] == './' and manifest['start_url'] == './' and manifest['scope'] == './'
    assert manifest['display'] == 'standalone' and data['full_name'] in manifest['name']
    for icon in manifest['icons']:
        response = await context.request.get(urljoin(url, icon['src']))
        size = int(icon['sizes'].split('x')[0])
        assert response.ok and Image.open(BytesIO(await response.body())).size == (size, size)
    await page.locator('[data-evpc-share]').click()
    await page.wait_for_function('window.capturedContactShare !== null')
    share = await page.evaluate('window.capturedContactShare')
    assert not share.get('url'), share
    assert all(value in share['text'] for value in [data['full_name'], 'Managing Director', '+251933606669', '+971521170330',
                      'Kedir@evpower.et', 'https://www.evpower.et', '8890', 'Addis Ababa - Ethiopia']), share
    assert all(value not in json.dumps(share).lower() for value in ['github.io', 'localhost', '/charge/', 'ahmed']), share
    assert not errors, errors
    await context.close()
    print('PASS: native contact sharing exposes contact details only; native resource links and app manifest are correct', flush=True)


async def ready(page, url):
    await page.goto(url, wait_until='load')
    await expect(page.locator('[data-evpc-offline-state]')).to_have_text('Ready offline', timeout=15000)
    await page.wait_for_function('(url)=>navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL===url+"service-worker.js"', arg=url, timeout=15000)


async def offline_isolation(browser, root_url, child_url, data, contact):
    context = await browser.new_context(viewport={'width': 390, 'height': 844})
    errors = []
    ahmed = await context.new_page()
    ahmed.on('pageerror', lambda error: errors.append(str(error)))
    await ready(ahmed, root_url)
    ahmed_name = json.loads((ROOT / 'card-data.json').read_text())['full_name']
    ahmed_contact_files = list((ROOT / 'dist').glob('*.vcf'))
    assert len(ahmed_contact_files) == 1
    ahmed_contact = ahmed_contact_files[0].read_bytes()
    await expect(ahmed.locator('h1')).to_have_text(ahmed_name)

    kedir = await context.new_page()
    kedir.on('pageerror', lambda error: errors.append(str(error)))
    # This first navigation passes through the already-active parent worker.
    await ready(kedir, child_url)
    await expect(kedir.locator('h1')).to_have_text(data['full_name'])
    scopes = await kedir.evaluate('(async()=> (await navigator.serviceWorker.getRegistrations()).map(r=>r.scope).sort())()')
    assert scopes == sorted([root_url, child_url]), scopes
    caches = await kedir.evaluate('''(async()=>{
        const result=[];
        for(const name of await window.caches.keys()){
            const cache=await window.caches.open(name);
            result.push({name,urls:(await cache.keys()).map(request=>request.url)});
        }
        return result;
    })()''')
    root_caches = [cache for cache in caches if root_url + 'index.html' in cache['urls']]
    child_caches = [cache for cache in caches if child_url + 'index.html' in cache['urls']]
    assert len(root_caches) == len(child_caches) == 1, caches
    assert root_caches[0]['name'] != child_caches[0]['name'], caches
    assert not any(url.startswith(child_url) for url in root_caches[0]['urls']), 'Parent worker cached child profile URLs'
    assert all(url.startswith(child_url) for url in child_caches[0]['urls']), 'Child worker cached outside its own folder'

    await context.set_offline(True)
    for page, name, expected in [(ahmed, ahmed_name, ahmed_contact), (kedir, data['full_name'], contact)]:
        await page.reload(wait_until='domcontentloaded')
        await expect(page.locator('h1')).to_have_text(name)
        await expect(page.locator('[data-ev-scene]')).to_have_count(1)
        await show_qr(page, expected)
        for selector, is_qr in [('[data-evpc-save]', False), ('[data-evpc-download-qr]', True)]:
            href = await page.locator(selector).get_attribute('href')
            result = await page.evaluate('''async (href)=>{
                const response=await fetch(href);
                if(!response.ok)throw new Error('Offline resource unavailable');
                return Array.from(new Uint8Array(await response.arrayBuffer()));
            }''', href)
            if is_qr:
                decode(bytes(result), expected)
            else:
                assert bytes(result) == expected
    assert not errors, errors
    await context.close()
    print('PASS: Ahmed root and Kedir child workers retain separate scopes/caches and both reload offline with their own contact/QR files', flush=True)


async def no_script(browser, url, data, contact):
    context = await browser.new_context(java_script_enabled=False, viewport={'width': 390, 'height': 844})
    page = await context.new_page()
    await page.goto(url, wait_until='load')
    await expect(page.locator('h1')).to_have_text(data['full_name'])
    await compact_actions(page, data)
    await expect(page.locator('[data-ev-scene]')).to_have_count(1)
    await expect(page.locator('.evpc-aside .evpc-qr__code')).to_have_count(0)
    await resources(context, page, url, contact)
    for dialog in await page.locator('dialog').all():
        await expect(dialog).to_be_hidden()
    trigger = page.locator('[data-evpc-open-qr]')
    href = await trigger.get_attribute('href')
    assert href == await page.locator('[data-evpc-download-qr]').get_attribute('href') and href.endswith('.png')
    target = urljoin(url, href)
    response = await context.request.get(target)
    assert response.ok
    decode(await response.body(), contact)
    await trigger.click()
    await expect(page).to_have_url(target)
    await expect(page.locator('body > img').first).to_be_visible()
    await context.close()
    print('PASS: Kedir static charging panel, native contact links and genuine PNG QR navigation work without JavaScript', flush=True)


async def main(base):
    data, contact = profile_data()
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        try:
            root_url = base + '/charge/'
            child_url = root_url + 'kedir/'
            await layouts_and_share(browser, child_url, data, contact)
            await offline_isolation(browser, root_url, child_url, data, contact)
            await no_script(browser, child_url, data, contact)
            await export_contact_image(browser, data, contact)
        finally:
            await browser.close()


if __name__ == '__main__':
    with tempfile.TemporaryDirectory(prefix='evpower-profile-check-') as temporary:
        stage = Path(temporary)
        shutil.copytree(ROOT / 'app', stage / 'charge')
        shutil.copytree(APP, stage / 'charge/kedir')
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(stage)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            asyncio.run(main(f'http://localhost:{server.server_port}'))
        finally:
            server.shutdown()
            server.server_close()
