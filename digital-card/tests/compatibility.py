"""Check the contact page in available engines and with optional browser APIs disabled.

Default: run Chromium and any installed Firefox/WebKit engines, reporting omissions.
Use --engines chromium,firefox,webkit to require every named engine.
This check does not regenerate screenshots, downloads or app assets.
"""
import argparse
import asyncio
import base64
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
import os
from pathlib import Path
import re
import threading
from urllib.parse import parse_qs, unquote_to_bytes, urljoin, urlparse

os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/tmp/evpower-card-browsers')

from PIL import Image
from playwright.async_api import async_playwright, expect
import zxingcpp


ROOT = Path(__file__).resolve().parents[1]
VCARD = (ROOT / 'dist/evpower-ahmed-kemal.vcf').read_bytes()
ENGINE_NAMES = ('chromium', 'firefox', 'webkit')


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def decode(picture):
    result = zxingcpp.read_barcode(Image.open(BytesIO(picture)))
    assert result is not None, 'Rendered QR did not decode'
    assert result.bytes == VCARD, 'Rendered QR differs from the contact file'


async def check_contact_actions(page):
    await expect(page.locator('.evpc-details')).to_have_count(0)
    await expect(page.locator('[data-evpc-save],[data-ev-toggle]')).to_have_count(0)
    await expect(page.locator('[data-evpc-offline-state]')).to_be_hidden()
    actions = page.locator('.evpc-actions a')
    await expect(actions).to_have_count(6)
    labels = [text.strip() for text in await actions.all_text_contents()]
    assert labels == ['Call', 'WhatsApp', 'Email', 'Website', 'Toll-free', 'Location']
    hrefs = {label: await actions.nth(index).get_attribute('href') for index, label in enumerate(labels)}
    assert hrefs['Call'] == 'tel:+251911049916'
    assert hrefs['WhatsApp'] == 'https://wa.me/971563558395'
    assert hrefs['Email'] == 'mailto:ahmed@evpower.et'
    assert hrefs['Website'] == 'https://evpower.et'
    assert hrefs['Toll-free'] == 'tel:8890'
    location = urlparse(hrefs['Location'])
    assert location.scheme == 'https' and location.hostname in ['www.google.com', 'maps.google.com']
    assert parse_qs(location.query).get('query') == ['Addis Ababa - Ethiopia']
    visible = (await page.locator('.evpc-main').inner_text()).lower()
    for duplicate in ['+251 911 049 916', '+971 56 355 8395', 'ahmed@evpower.et', 'evpower.et', '8890', 'addis ababa']:
        assert duplicate not in visible, f'Duplicate plain contact detail: {duplicate}'


async def check_resources(context, page, app):
    await expect(page.locator('[data-evpc-save]')).to_have_count(0)
    href = 'assets/evpower-ahmed-kemal.vcf'
    result = await context.request.get(urljoin(app, href))
    assert result.ok and await result.body() == VCARD, 'Packaged contact asset is not the exact vCard'

    qr = page.locator('[data-evpc-download-qr]')
    await expect(qr).to_be_visible()
    assert await qr.evaluate('(node) => node.tagName') == 'A', 'QR download must have a native link fallback'
    href = await qr.get_attribute('href')
    assert href and not href.startswith(('blob:', 'javascript:', 'data:')), href
    assert href.split('?', 1)[0].endswith('.png'), href
    result = await context.request.get(urljoin(app, href))
    assert result.ok
    decode(await result.body())


async def check_page(browser, app, engine):
    context = await browser.new_context(viewport={'width': 390, 'height': 844})
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    await page.goto(app, wait_until='load')
    await expect(page.locator('h1')).to_have_text('Ahmed Kemal')
    await expect(page.locator('.evpc-designation')).to_have_text('Founder & CEO')
    await check_contact_actions(page)
    assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth')
    await check_resources(context, page, app)
    for dialog in await page.locator('dialog').all():
        await expect(dialog).to_be_hidden()
    trigger = page.locator('[data-evpc-open-qr]')
    await trigger.click()
    modal = page.locator('[data-evpc-qr-modal]')
    await expect(modal).to_be_visible()
    decode(await page.locator('[data-evpc-modal-code]').screenshot())
    await page.keyboard.press('Escape')
    await expect(modal).to_be_hidden()
    await expect(trigger).to_be_focused()
    assert not errors, errors
    await context.close()
    print(f'PASS {engine}: complete mobile card, native vCard/PNG links and decoded full-screen QR', flush=True)


FALLBACKS = r"""(() => {
    if (window.HTMLDialogElement) {
        Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {configurable:true, value:undefined});
        Object.defineProperty(HTMLDialogElement.prototype, 'close', {configurable:true, value:undefined});
    }
    ['share', 'clipboard', 'serviceWorker'].forEach(function(name) {
        Object.defineProperty(navigator, name, {configurable:true, value:undefined});
    });
    Object.defineProperty(document, 'execCommand', {configurable:true, value:function(){return false}});
})()"""


DENIED_APIS = r"""(() => {
    window.deniedCalls = {};
    function denied(name) {
        window.deniedCalls[name] = true;
        var error = new Error('Browser denied ' + name);
        error.name = 'NotAllowedError';
        return error;
    }
    if (window.HTMLDialogElement) {
        Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
            configurable:true, value:function(){throw denied('showModal')}
        });
    }
    Object.defineProperty(navigator, 'share', {
        configurable:true, value:function(){return Promise.reject(denied('share'))}
    });
    Object.defineProperty(navigator, 'clipboard', {
        configurable:true, value:{writeText:function(){return Promise.reject(denied('clipboard'))}}
    });
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable:true, value:{addEventListener:function(){}, register:function(){throw denied('serviceWorker')}}
    });
    Object.defineProperty(window, 'matchMedia', {
        configurable:true, value:function(){throw denied('matchMedia')}
    });
    Object.defineProperty(document, 'execCommand', {configurable:true, value:function(){return false}});
})()"""


async def check_fallbacks(browser, app, engine, script=FALLBACKS, denied=False):
    context = await browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
    await context.add_init_script(script)
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    await page.goto(app, wait_until='load')
    await check_contact_actions(page)
    for dialog in await page.locator('dialog').all():
        await expect(dialog).to_be_hidden()
    trigger = page.locator('[data-evpc-open-qr]')
    modal = page.locator('[data-evpc-qr-modal]')
    await trigger.click()
    await expect(modal).to_be_visible()
    decode(await page.locator('[data-evpc-modal-code]').screenshot())
    assert await modal.evaluate('(node) => node.contains(document.activeElement)'), 'Fallback dialog did not receive focus'
    for key in ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab']:
        await page.keyboard.press(key)
        assert await modal.evaluate('(node) => node.contains(document.activeElement)'), 'Keyboard focus escaped fallback dialog'
    await page.keyboard.press('Escape')
    await expect(modal).to_be_hidden()
    await expect(trigger).to_be_focused()

    install = page.locator('[data-evpc-install]')
    await install.click()
    help_dialog = page.locator('[data-evpc-install-modal]')
    await expect(help_dialog).to_be_visible()
    await expect(help_dialog).to_contain_text('iPhone')
    await expect(help_dialog).to_contain_text('Android')
    await page.keyboard.press('Escape')
    await expect(help_dialog).to_be_hidden()
    await expect(install).to_be_focused()

    await page.locator('[data-evpc-share]').click()
    await expect(page.locator('[data-evpc-share-fallback]')).to_be_visible()
    copy = page.locator('[data-evpc-share-text]')
    await expect(copy).to_be_visible()
    text = await copy.input_value()
    assert all(detail in text for detail in ['Ahmed Kemal', 'ahmed@evpower.et', '+251911049916', '+971563558395']), text
    assert 'localhost' not in text
    await expect(page.locator('[data-evpc-offline-state]')).to_contain_text(re.compile('online', re.I))
    await check_resources(context, page, app)
    if denied:
        calls = await page.evaluate('window.deniedCalls')
        assert all(calls.get(name) for name in ['showModal', 'share', 'clipboard', 'serviceWorker', 'matchMedia']), calls
    assert not errors, errors
    await context.close()
    mode = 'denied or throwing' if denied else 'unsupported'
    print(f'PASS {engine}: {mode} browser APIs; QR/install help, focus trap, Escape, manual copy and online status', flush=True)


async def check_no_script(browser, app, engine):
    context = await browser.new_context(java_script_enabled=False, viewport={'width': 390, 'height': 844})
    page = await context.new_page()
    await page.goto(app, wait_until='load')
    await check_contact_actions(page)
    await expect(page.locator('.evpc-aside .evpc-qr__code')).to_have_count(0)
    await check_resources(context, page, app)
    for dialog in await page.locator('dialog').all():
        await expect(dialog).to_be_hidden()
    qr = page.locator('[data-evpc-open-qr]')
    href = await qr.get_attribute('href')
    assert href == await page.locator('[data-evpc-download-qr]').get_attribute('href') and href.endswith('.png')
    target = urljoin(app, href)
    response = await context.request.get(target)
    assert response.ok
    decode(await response.body())
    await qr.click()
    await expect(page).to_have_url(target)
    await expect(page.locator('body > img').first).to_be_visible()
    await context.close()
    print(f'PASS {engine}: card/native contact links and decoded QR image opening with JavaScript disabled', flush=True)


async def check_standalone(browser, app, engine):
    context = await browser.new_context(viewport={'width': 390, 'height': 844})
    await context.add_init_script("""window.standaloneRegistrations=0;
        Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{
            addEventListener:function(){},register:function(){window.standaloneRegistrations++;throw new Error('Unexpected standalone worker')}
        }});""")
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    await page.goto(urljoin(app, '../dist/evpower-card-standalone.html'), wait_until='load')
    await expect(page.locator('h1')).to_have_text('Ahmed Kemal')
    await check_contact_actions(page)
    assert await page.locator('link[href],script[src]').count() == 0, 'Standalone HTML has external asset references'
    for image in await page.locator('img').all():
        assert (await image.get_attribute('src') or '').startswith('data:'), 'Standalone image is not embedded'
    for selector, mime, expected in [
        ('[data-evpc-download-qr]', 'image/png', (ROOT / 'dist/evpower-contact-qr.png').read_bytes()),
    ]:
        href = await page.locator(selector).get_attribute('href')
        assert href and href.startswith('data:' + mime), href
        metadata, payload = href.split(',', 1)
        data = base64.b64decode(payload) if ';base64' in metadata else unquote_to_bytes(payload)
        assert data == expected, 'Embedded contact/QR data differs from the original'
        if mime == 'image/png':
            decode(data)
    await page.locator('[data-evpc-open-qr]').click()
    await expect(page.locator('[data-evpc-qr-modal]')).to_be_visible()
    decode(await page.locator('[data-evpc-modal-code]').screenshot())
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-evpc-qr-modal]')).to_be_hidden()
    assert await page.evaluate('window.standaloneRegistrations') == 0, 'Standalone HTML tried to register a worker'
    assert not errors, errors
    await context.close()
    print(f'PASS {engine}: self-contained standalone HTML, exact embedded contact QR, modal QR and no worker registration', flush=True)


async def main(app, requested):
    failures = []
    completed = []
    async with async_playwright() as pw:
        for name in requested or ENGINE_NAMES:
            engine = getattr(pw, name)
            executable = Path('/usr/bin/chromium') if name == 'chromium' else Path(engine.executable_path)
            if not executable.is_file():
                message = f'{name}: browser engine is not installed ({executable})'
                print(('FAIL ' if requested else 'SKIP ') + message, flush=True)
                if requested:
                    failures.append(message)
                continue
            browser = None
            try:
                options = {'headless': True}
                if name == 'chromium':
                    options.update(executable_path=str(executable), args=['--no-sandbox'])
                browser = await engine.launch(**options)
                await check_page(browser, app, name)
                await check_fallbacks(browser, app, name)
                await check_fallbacks(browser, app, name, DENIED_APIS, denied=True)
                await check_no_script(browser, app, name)
                await check_standalone(browser, app, name)
                completed.append(name)
            except Exception as error:
                failures.append(f'{name}: {type(error).__name__}: {error}')
                print('FAIL ' + failures[-1], flush=True)
            finally:
                if browser:
                    await browser.close()
    if not completed and not failures:
        failures.append('No browser engine was available to test')
    if failures:
        raise SystemExit('\n'.join(failures))
    print('Browser compatibility checks passed: ' + ', '.join(completed), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--engines', help='Comma-separated required engines: chromium,firefox,webkit')
    args = parser.parse_args()
    engines = None
    if args.engines is not None:
        engines = list(dict.fromkeys(name.strip() for name in args.engines.split(',') if name.strip()))
        if not engines or set(engines) - set(ENGINE_NAMES):
            parser.error('--engines must name chromium, firefox and/or webkit')
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        asyncio.run(main(f'http://localhost:{server.server_port}/app/', engines))
    finally:
        server.shutdown()
        server.server_close()
