"""Verify the phone app, real rendered QR, vCard downloads and offline use."""
import asyncio
import base64
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import json
import threading
from io import BytesIO
from urllib.parse import parse_qs,urlparse
from PIL import Image
import zxingcpp
from playwright.async_api import async_playwright,expect

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'test-output'
OUTPUT.mkdir(exist_ok=True)
DATA=json.loads((ROOT/'card-data.json').read_text())
VCARD=(ROOT/'dist/evpower-ahmed-kemal.vcf').read_bytes()

class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

def decode(image):
    result=zxingcpp.read_barcode(Image.open(BytesIO(image)))
    assert result is not None,'Rendered QR did not decode'
    assert result.bytes==VCARD,'QR contact differs from downloaded contact'

async def contact_actions(page):
    await expect(page.locator('.evpc-details')).to_have_count(0)
    actions=page.locator('.evpc-actions a')
    await expect(actions).to_have_count(6)
    labels=[text.strip() for text in await actions.all_text_contents()]
    assert labels==['Call','WhatsApp','Email','Website','Toll-free','Location']
    hrefs={label:await actions.nth(index).get_attribute('href') for index,label in enumerate(labels)}
    assert hrefs['Call']=='tel:+251911049916'
    assert hrefs['WhatsApp']=='https://wa.me/971563558395'
    assert hrefs['Email']=='mailto:ahmed@evpower.et'
    assert hrefs['Website']=='https://evpower.et'
    assert hrefs['Toll-free']=='tel:8890'
    location=urlparse(hrefs['Location'])
    assert location.scheme=='https' and location.hostname in ['www.google.com','maps.google.com']
    assert parse_qs(location.query).get('query')==['Addis Ababa - Ethiopia']
    visible=(await page.locator('.evpc-main').inner_text()).lower()
    for duplicate in ['+251 911 049 916','+971 56 355 8395','ahmed@evpower.et','evpower.et','8890','addis ababa']:
        assert duplicate not in visible,f'Duplicate plain contact detail: {duplicate}'

async def main(base):
    app=base+'/app/'
    decode((ROOT/'dist/evpower-contact-qr.png').read_bytes())
    async with async_playwright() as pw:
        browser=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        context=await browser.new_context(viewport={'width':390,'height':844},accept_downloads=True,permissions=['clipboard-read','clipboard-write'])
        page=await context.new_page()
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        for width in [320,390,430,768,1440]:
            await page.set_viewport_size({'width':width,'height':900 if width>430 else 844})
            await page.goto(app,wait_until='networkidle')
            await expect(page.locator('h1')).to_have_text('Ahmed Kemal')
            await expect(page.locator('.evpc-designation')).to_have_text('Founder & CEO')
            await contact_actions(page)
            assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth'),width
            assert await page.locator('.evpc-card img').count()==1,'No profile photo should be present'
            await page.get_by_role('link',name='Show my QR',exact=True).click()
            modal=page.locator('[data-evpc-qr-modal]')
            await expect(modal).to_be_visible()
            image=await page.locator('[data-evpc-modal-code]').screenshot()
            decode(image)
            if width in [320,390]:
                await modal.screenshot(path=str(OUTPUT/f'qr-dialog-{width}.png'))
            await page.get_by_role('button',name='Back to card',exact=True).click()
            await expect(modal).to_be_hidden()
            await expect(page.get_by_role('link',name='Show my QR',exact=True)).to_be_focused()
            if width==390:
                await page.screenshot(path=str(ROOT/'dist/evpower-card-phone-preview.png'),full_page=True)
            print(f'PASS: six matching contact actions, no duplicated plain details and scannable QR at {width}px')

        await expect(page.locator('[data-evpc-offline-state]')).to_have_text('Ready offline',timeout=15000)
        await page.wait_for_function('navigator.serviceWorker.controller!==null')
        scope=await page.evaluate('(async()=>{const r=await navigator.serviceWorker.getRegistration();return r.scope})()')
        assert scope==app,'Service worker must stay inside its own app folder'
        manifest=await (await context.request.get(app+'app.webmanifest')).json()
        assert manifest['display']=='standalone' and manifest['start_url']=='./' and manifest['scope']=='./'
        for icon in manifest['icons']:
            result=await context.request.get(app+icon['src'])
            width=int(icon['sizes'].split('x')[0])
            assert Image.open(BytesIO(await result.body())).size==(width,width)
        assert await page.locator('link[rel="apple-touch-icon"]').count()==1
        print('PASS: installable app manifest, proper icon sizes, iPhone metadata and isolated offline scope')

        await page.set_viewport_size({'width':390,'height':844})
        await context.set_offline(True)
        await page.reload(wait_until='domcontentloaded')
        await expect(page.locator('h1')).to_have_text('Ahmed Kemal')
        await page.get_by_role('link',name='Show my QR',exact=True).click()
        decode(await page.locator('[data-evpc-modal-code]').screenshot())
        await page.keyboard.press('Escape')
        async with page.expect_download() as pending:
            await page.get_by_role('link',name='Save contact',exact=True).click()
        download=await pending.value
        target=OUTPUT/download.suggested_filename
        await download.save_as(target)
        assert target.read_bytes()==VCARD
        assert b'ahmed@evpower.et' in VCARD and b'+971563558395' in VCARD and b'+251911049916' in VCARD
        async with page.expect_download() as pending:
            await page.get_by_role('link',name='Download QR',exact=True).click()
        await (await pending.value).save_as(OUTPUT/'downloaded-qr.png')
        decode((OUTPUT/'downloaded-qr.png').read_bytes())
        print('PASS: app reopens offline, QR still decodes and contact/QR files download without internet')
        await context.set_offline(False)

        await page.get_by_role('button',name='Add to phone',exact=True).click()
        await expect(page.locator('[data-evpc-install-modal]')).to_be_visible()
        await expect(page.locator('[data-evpc-install-modal]')).to_contain_text('iPhone')
        await expect(page.locator('[data-evpc-install-modal]')).to_contain_text('Android')
        await page.get_by_role('button',name='Got it',exact=True).click()
        await page.evaluate("(()=>{const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{window.testInstallPrompted=true};e.userChoice=Promise.resolve({outcome:'accepted'});dispatchEvent(e)})()")
        await page.get_by_role('button',name='Install app',exact=True).click()
        assert await page.evaluate('window.testInstallPrompted===true')
        print('PASS: iPhone/Android install instructions and native Android install prompt flow')

        await page.get_by_role('button',name='Share card',exact=True).click()
        await expect(page.locator('[data-evpc-status]')).to_contain_text('Contact details copied')
        clip=await page.evaluate('navigator.clipboard.readText()')
        assert 'Ahmed Kemal' in clip and 'ahmed@evpower.et' in clip and 'localhost' not in clip
        print('PASS: share fallback contains correct contact details and no localhost preview URL')
        assert not errors,errors
        await context.close()

        nojs=await browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844})
        p=await nojs.new_page();await p.goto(app+'#evpc-qr-panel',wait_until='load')
        await contact_actions(p)
        await expect(p.locator('.evpc-qr__code')).to_be_in_viewport()
        decode(await p.locator('.evpc-qr__code').screenshot())
        print('PASS: QR and contact links remain usable without JavaScript')
        await nojs.close()

        # Immediately usable image for Photos/WhatsApp, with an independently tested QR.
        logo='data:image/png;base64,'+base64.b64encode((ROOT/'ui/assets/logo.png').read_bytes()).decode()
        svg=(ROOT/'dist/evpower-contact-qr.svg').read_text()
        export=await browser.new_page(viewport={'width':1080,'height':1700},device_scale_factor=1)
        markup=f'''<html><head><style>html,body{{margin:0;background:#f1f7ff;font-family:Arial,sans-serif;color:#102338}}.card{{position:relative;box-sizing:border-box;width:1080px;min-height:1700px;padding:60px 80px;background:white;border-top:14px solid #0754de}}.brand{{position:relative;width:920px;height:160px;overflow:hidden}}.brand img{{position:absolute;top:50%;width:100%;transform:translateY(-50%)}}h1{{font-size:64px;letter-spacing:-2px;margin:28px 0 12px}}.role{{font-size:34px;color:#0754de;margin:0 0 44px}}.details{{font-size:30px;line-height:1.8;color:#43576f}}.details strong{{color:#12253d}}.qr{{width:700px;margin:46px auto 24px}}.qr svg{{display:block;width:100%;height:auto}}.caption{{text-align:center;font-size:32px;font-weight:700;color:#0754de}}.tag{{text-align:center;font-size:26px;color:#6e8199;margin-top:30px}}</style></head><body><div class=card><div class=brand><img src="{logo}" alt=Evpower></div><h1>Ahmed Kemal</h1><p class=role>Founder &amp; CEO</p><div class=details><strong>Call:</strong> +251 911 049 916<br><strong>WhatsApp:</strong> +971 56 355 8395<br><strong>Email:</strong> ahmed@evpower.et<br><strong>Website:</strong> evpower.et<br><strong>Address:</strong> Addis Ababa - Ethiopia<br><strong>Toll-free:</strong> 8890</div><div class=qr>{svg}</div><p class=caption>Scan to save my contact</p><p class=tag>Powering your journey</p></div></body></html>'''
        await export.set_content(markup,wait_until='load')
        await export.locator('img').evaluate('(image)=>image.decode()')
        picture=await export.locator('.card').screenshot(path=str(ROOT/'dist/evpower-ahmed-contact-card.png'))
        decode(picture)
        print('PASS: ready-to-save contact image has a working contact QR')
        await browser.close()

if __name__=='__main__':
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try: asyncio.run(main(f'http://localhost:{server.server_port}'))
    finally: server.shutdown();server.server_close()
