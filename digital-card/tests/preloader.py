"""Check the shared branded preloader fails open on both phone-card profiles."""
import asyncio
import base64
from datetime import datetime, timedelta, timezone
from functools import partial
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
import shutil
import tempfile
import threading
from urllib.parse import unquote_to_bytes, urljoin

from PIL import Image
from playwright.async_api import async_playwright, expect
import zxingcpp


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'test-output'
PROFILES = [('ahmed', ROOT, '/charge/'), ('kedir', ROOT / 'profiles/kedir', '/charge/kedir/')]
APPROVED = hashlib.sha256((ROOT / 'ui/assets/emblem.png').read_bytes()).hexdigest()


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def verify_qr(picture, contact):
    result = zxingcpp.read_barcode(Image.open(BytesIO(picture)))
    assert result is not None and result.bytes == contact, 'Card QR did not decode to its own contact'


async def paused(page):
    await page.clock.install()
    await page.clock.pause_at(datetime.now(timezone.utc) + timedelta(minutes=1))


async def fresh(browser, url, *, script=None, route=None, reduced_motion=None, javascript=True, clock=True):
    options = {'viewport': {'width': 390, 'height': 844}, 'service_workers': 'block', 'java_script_enabled': javascript}
    if reduced_motion:
        options['reduced_motion'] = reduced_motion
    context = await browser.new_context(**options)
    if script:
        await context.add_init_script(script)
    if route:
        await context.route(route, lambda request: request.abort())
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    if clock and javascript:
        await paused(page)
    await page.goto(url, wait_until='domcontentloaded')
    return context, page, errors


async def qr_usable(page, contact, enhanced=True):
    trigger = page.locator('[data-evpc-open-qr]')
    if enhanced:
        await trigger.click()
        await expect(page.locator('[data-evpc-qr-modal]')).to_be_visible()
        verify_qr(await page.locator('[data-evpc-modal-code]').screenshot(), contact)
        await page.keyboard.press('Escape')
    else:
        href = await trigger.get_attribute('href')
        assert href
        if href.startswith('#'):
            await trigger.click()
            await expect(page.locator('.evpc-qr__code')).to_be_in_viewport()
            verify_qr(await page.locator('.evpc-qr__code').screenshot(), contact)
        elif href.startswith('data:image/png'):
            metadata, payload = href.split(',', 1)
            verify_qr(base64.b64decode(payload) if ';base64' in metadata else unquote_to_bytes(payload), contact)
        else:
            target = urljoin(page.url, href)
            response = await page.request.get(target)
            assert response.ok
            verify_qr(await response.body(), contact)
            await trigger.click()
            await expect(page).to_have_url(target)
            await expect(page.locator('body > img').first).to_be_visible()


async def normal_and_controls(browser, url, key, contact):
    context, page, errors = await fresh(browser, url)
    overlay = page.locator('[data-evpc-preloader]')
    await expect(overlay).to_be_visible()
    await expect(overlay).to_have_attribute('aria-hidden', 'false')
    assert await overlay.evaluate('(node)=>!node.closest(".evpc-card")')
    await overlay.locator('img').evaluate('(image)=>image.decode()')
    await page.screenshot(path=str(OUTPUT / f'preloader-{key}.png'))
    await page.clock.run_for(800)
    await expect(overlay).to_be_visible()
    await page.clock.run_for(700)
    await expect(overlay).to_be_hidden()
    await expect(overlay).to_have_attribute('aria-hidden', 'true')
    await qr_usable(page, contact)
    assert not errors, errors
    await context.close()

    for action in ['skip', 'escape', 'print', 'pagehide', 'pageshow']:
        context, page, errors = await fresh(browser, url)
        overlay = page.locator('[data-evpc-preloader]')
        await expect(overlay).to_be_visible()
        if action == 'skip':
            await page.locator('[data-evpc-preloader-skip]').click()
        elif action == 'escape':
            await page.keyboard.press('Escape')
        elif action == 'print':
            await page.emulate_media(media='print')
        elif action == 'pagehide':
            await page.evaluate("dispatchEvent(new PageTransitionEvent('pagehide'))")
        else:
            await page.evaluate("dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
        await expect(overlay).to_be_hidden()
        if action != 'print':
            await qr_usable(page, contact)
        assert not errors, errors
        await context.close()
    print(f'PASS {key}: approved preloader, bounded normal dismissal, Skip/Escape, print and page lifecycle release', flush=True)


async def fail_open(browser, url, key, contact):
    for mode in ['reduced-motion', 'no-js', 'image-error', 'core-js-blocked', 'timer-failure']:
        options = {}
        if mode == 'reduced-motion':
            options['reduced_motion'] = 'reduce'
        elif mode == 'no-js':
            options['javascript'] = False
        elif mode == 'image-error':
            options['route'] = '**/assets/emblem.png'
        elif mode == 'core-js-blocked':
            options['route'] = '**/assets/card.js'
        else:
            options.update(script='window.setTimeout=function(){return 0};', clock=False)
        context, page, errors = await fresh(browser, url, **options)
        overlay = page.locator('[data-evpc-preloader]')
        if mode in ['image-error', 'core-js-blocked']:
            await page.clock.run_for(2000)
        await expect(overlay).to_be_hidden(timeout=3500)
        await qr_usable(page, contact, enhanced=mode not in ['no-js', 'core-js-blocked'])
        assert not errors, errors
        await context.close()
    print(f'PASS {key}: reduced motion/no JavaScript/image error/blocked core script/timer failure leave the contact QR usable', flush=True)


async def standalone(browser, url, key, contact):
    context, page, errors = await fresh(browser, url)
    overlay = page.locator('[data-evpc-preloader]')
    await expect(overlay).to_be_visible()
    source = await overlay.locator('img').get_attribute('src')
    assert source and source.startswith('data:image/png'), 'Standalone preloader image is not embedded'
    metadata, payload = source.split(',', 1)
    image = base64.b64decode(payload) if ';base64' in metadata else unquote_to_bytes(payload)
    assert hashlib.sha256(image).hexdigest() == APPROVED
    assert await page.locator('link[rel="stylesheet"],script[src]').count() == 0
    await page.clock.run_for(1500)
    await expect(overlay).to_be_hidden()
    await qr_usable(page, contact)
    assert not errors, errors
    await context.close()
    print(f'PASS {key}: standalone HTML embeds approved emblem, loading styles/bootstrap and working contact QR', flush=True)


async def offline(browser, base, contacts):
    context = await browser.new_context(viewport={'width': 390, 'height': 844})
    pages = []
    for key, _profile, path in PROFILES:
        page = await context.new_page()
        await paused(page)
        url = base + path
        await page.goto(url, wait_until='domcontentloaded')
        await expect(page.locator('[data-evpc-offline-state]')).to_have_text('Ready offline', timeout=15000)
        await page.wait_for_function('(url)=>navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL===url+"service-worker.js"', arg=url)
        await page.clock.run_for(1500)
        pages.append((key, page))
    await context.set_offline(True)
    for key, page in pages:
        await page.reload(wait_until='domcontentloaded')
        overlay = page.locator('[data-evpc-preloader]')
        await expect(overlay).to_be_visible()
        await overlay.locator('img').evaluate('(image)=>image.decode()')
        await page.clock.run_for(1500)
        await expect(overlay).to_be_hidden()
        await qr_usable(page, contacts[key])
    await context.close()
    print('PASS: both profile caches retain the approved emblem and reopen offline with preloader plus correct contact QR', flush=True)


async def main(base):
    contacts = {}
    for key, profile, _path in PROFILES:
        assert hashlib.sha256((profile / 'app/assets/emblem.png').read_bytes()).hexdigest() == APPROVED
        assert 'assets/emblem.png' in (profile / 'app/service-worker.js').read_text(), 'Emblem missing from precache'
        files = list((profile / 'dist').glob('*.vcf'))
        assert len(files) == 1
        contacts[key] = files[0].read_bytes()
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        try:
            for key, _profile, path in PROFILES:
                await normal_and_controls(browser, base + path, key, contacts[key])
                await fail_open(browser, base + path, key, contacts[key])
                await standalone(browser, base + '/standalone/' + key + '.html', key, contacts[key])
            await offline(browser, base, contacts)
        finally:
            await browser.close()


if __name__ == '__main__':
    OUTPUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='evpower-preloader-check-') as temporary:
        stage = Path(temporary)
        shutil.copytree(ROOT / 'app', stage / 'charge')
        shutil.copytree(ROOT / 'profiles/kedir/app', stage / 'charge/kedir')
        (stage / 'standalone').mkdir()
        for key, profile, _path in PROFILES:
            shutil.copy2(profile / 'dist/evpower-card-standalone.html', stage / 'standalone' / (key + '.html'))
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(stage)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            asyncio.run(main(f'http://localhost:{server.server_port}'))
        finally:
            server.shutdown()
            server.server_close()
