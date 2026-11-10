"""Check Ahmed's physical charging loop, pause controls and genuine contact QR.

Build both profiles first. Uses only installed Chromium and a temporary local
server; screenshots go to ignored test-output/. No live site is contacted.
"""
import asyncio
import base64
from datetime import datetime, timedelta, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
import math
from pathlib import Path
import shutil
import tempfile
import threading
from urllib.parse import unquote_to_bytes, urljoin, urlparse

from PIL import Image
from playwright.async_api import async_playwright, expect
import zxingcpp

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'test-output'
PERIOD = 16.8


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def contact(profile):
    files = list((profile / 'dist').glob('*.vcf'))
    assert len(files) == 1
    return files[0].read_bytes()


def decode(picture, expected):
    result = zxingcpp.read_barcode(Image.open(BytesIO(picture)))
    assert result is not None and result.bytes == expected, 'QR does not contain the exact contact vCard'


async def freeze_clock(page):
    await page.clock.install()
    await page.clock.pause_at(datetime.now(timezone.utc) + timedelta(minutes=1))


async def scene_state(page):
    return await page.locator('[data-ev-scene]').evaluate('''scene => {
        const get = selector => scene.querySelector(selector);
        const matrix = node => {
            const value = node.transform.baseVal.consolidate();
            return value ? [value.matrix.a,value.matrix.b,value.matrix.c,value.matrix.d,value.matrix.e,value.matrix.f] : [1,0,0,1,0,0];
        };
        const percent = parseFloat(get('[data-ev-percent]').textContent);
        return {
            phase:scene.getAttribute('data-phase'),time:parseFloat(scene.getAttribute('data-time')),
            car:matrix(get('[data-ev-car]')),plug:matrix(get('[data-ev-plug]')),
            cable:get('[data-ev-cable]').getAttribute('d'),energy:get('[data-ev-energy]').getAttribute('d'),
            flow:parseFloat(getComputedStyle(get('[data-ev-energy]')).opacity),
            dash:get('[data-ev-energy]').getAttribute('stroke-dashoffset'),
            percent:Number.isFinite(percent)?percent:null,
            battery:get('[data-ev-battery]').style.transform,status:get('[data-ev-status]').textContent
        };
    }''')


async def advance_to(page, target, phase):
    """Advance real RAF callbacks using the controlled clock, with no seek hook."""
    for _attempt in range(5):
        current = (await scene_state(page))['time']
        assert current is not None and math.isfinite(current), 'Scene did not expose a finite loop time'
        difference = (target - current) % PERIOD
        if min(difference, PERIOD - difference) <= .035:
            break
        await page.clock.run_for(max(20, round(difference * 1000)))
    state = await scene_state(page)
    assert min((state['time'] - target) % PERIOD, (target - state['time']) % PERIOD) <= .05, state
    assert state['phase'] == phase, state
    assert state['cable'] == state['energy'], 'Energy must follow the physical cable'
    return state


def at_plug(state, x, y, tolerance=.25):
    assert abs(state['plug'][4] - x) <= tolerance and abs(state['plug'][5] - y) <= tolerance, state


def unchanged(before, after):
    assert before == after, {'before': before, 'after': after}


async def fresh(browser, url, *, viewport=None, motion=None, javascript=True, clock=True):
    options = {'viewport': viewport or {'width': 1440, 'height': 1000},
               'java_script_enabled': javascript, 'service_workers': 'block'}
    if motion:
        options['reduced_motion'] = motion
    context = await browser.new_context(**options)
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    if clock and javascript:
        await freeze_clock(page)
    await page.goto(url, wait_until='domcontentloaded')
    scene = page.locator('[data-ev-scene]')
    await expect(scene).to_have_count(1)
    await scene.locator('.evpc-scene-stage').scroll_into_view_if_needed()
    # IntersectionObserver observes actual paints, independently of the fake clock.
    await asyncio.sleep(.05)
    return context, page, errors


async def modal_qr(page, expected):
    await page.locator('[data-evpc-open-qr]').click()
    await expect(page.locator('[data-evpc-qr-modal]')).to_be_visible()
    decode(await page.locator('[data-evpc-modal-code]').screenshot(), expected)
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-evpc-qr-modal]')).to_be_hidden()


async def timeline_and_controls(browser, url, expected):
    context, page, errors = await fresh(browser, url)
    scene = page.locator('[data-ev-scene]')
    overlay = page.locator('[data-evpc-preloader]')
    await expect(overlay).to_be_visible()
    initial = await scene_state(page)
    await page.clock.run_for(700)
    await expect(overlay).to_be_visible()
    unchanged(initial, await scene_state(page))
    await page.clock.run_for(700)
    await expect(overlay).to_be_hidden()
    await expect(scene).to_have_attribute('data-playing', 'true')
    waiting = await advance_to(page, .25, 'waiting')
    at_plug(waiting, 115, 180)
    arrival = await advance_to(page, 1.5, 'arriving')
    assert abs(arrival['car'][4]) > 20 and arrival['percent'] == 22
    assert arrival['flow'] == 0
    await scene.screenshot(path=str(OUTPUT / 'charging-arrival.png'))
    early_connect = await advance_to(page, 3.4, 'connecting')
    late_connect = await advance_to(page, 4.5, 'connecting')
    assert early_connect['car'] == late_connect['car'] and abs(early_connect['car'][4]) < .1
    assert early_connect['percent'] == late_connect['percent'] == 22
    assert early_connect['plug'] != late_connect['plug'] and early_connect['cable'] != late_connect['cable']
    assert early_connect['flow'] == late_connect['flow'] == 0
    charge_start = await advance_to(page, 5.2, 'charging')
    charge_middle = await advance_to(page, 8, 'charging')
    await scene.screenshot(path=str(OUTPUT / 'charging-connected.png'))
    await page.screenshot(path=str(OUTPUT / 'charging-desktop.png'), full_page=True)
    charge_end = await advance_to(page, 10.65, 'charging')
    complete = await advance_to(page, 11.2, 'complete')
    assert 22 <= charge_start['percent'] < charge_middle['percent'] < charge_end['percent'] <= 100
    assert complete['percent'] == 100
    for state in [charge_start, charge_middle, charge_end, complete]:
        assert state['car'] == early_connect['car'], 'Vehicle must stay parked while connected'
        at_plug(state, 184, 224)
    assert charge_middle['flow'] > 0
    assert charge_start['battery'] != charge_middle['battery'] != charge_end['battery']
    disconnecting = await advance_to(page, 12.4, 'disconnecting')
    assert disconnecting['car'] == complete['car'] and disconnecting['percent'] == 100
    assert disconnecting['plug'] != complete['plug'] and disconnecting['flow'] == 0
    departed = await advance_to(page, 13.2, 'departing')
    at_plug(departed, 115, 180)
    assert departed['percent'] == 100 and departed['flow'] == 0
    departure = await advance_to(page, 14.4, 'departing')
    assert abs(departure['car'][4]) > 20 and departure['car'] != complete['car']
    assert departure['plug'] == departed['plug'] and departure['cable'] == departed['cable']
    await scene.screenshot(path=str(OUTPUT / 'charging-departure.png'))
    end = await advance_to(page, 16.3, 'waiting')
    assert end['car'][4] > 520, 'Vehicle must leave the illustrated frame before the loop resets'
    repeated = await advance_to(page, 1.5, 'arriving')
    assert repeated['percent'] == 22 and abs(repeated['car'][4] - arrival['car'][4]) < 10
    assert repeated['plug'] == arrival['plug'] and repeated['cable'] == arrival['cable']
    print('PASS: preloader hold, arrival, stationary connection/charging, 22→100%, full unplug before departure and repeatable 16.8s loop', flush=True)

    await advance_to(page, 6.5, 'charging')
    toggle = page.locator('[data-ev-toggle]')
    await toggle.click()
    await expect(toggle).to_have_attribute('aria-pressed', 'true')
    paused = await scene_state(page)
    await page.clock.run_for(1200)
    unchanged(paused, await scene_state(page))
    await toggle.click()
    await expect(toggle).to_have_attribute('aria-pressed', 'false')
    await page.clock.run_for(250)
    assert (await scene_state(page))['time'] > paused['time'] + .15

    await page.locator('[data-evpc-open-qr]').click()
    await expect(page.locator('[data-evpc-qr-modal]')).to_be_visible()
    decode(await page.locator('[data-evpc-modal-code]').screenshot(), expected)
    paused = await scene_state(page)
    await page.clock.run_for(1200)
    unchanged(paused, await scene_state(page))
    await page.keyboard.press('Escape')
    await page.clock.run_for(250)
    assert (await scene_state(page))['time'] > paused['time'] + .15

    await page.evaluate("""Object.defineProperty(document,'hidden',{configurable:true,value:true});
        Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
        document.dispatchEvent(new Event('visibilitychange'));""")
    paused = await scene_state(page)
    await page.clock.run_for(1200)
    unchanged(paused, await scene_state(page))
    await page.evaluate("""delete document.hidden;delete document.visibilityState;
        document.dispatchEvent(new Event('visibilitychange'));""")
    await page.clock.run_for(250)
    assert (await scene_state(page))['time'] > paused['time'] + .15
    for candidate in await page.locator('.evpc-aside .evpc-qr__code,[data-evpc-print-qr]').all():
        await expect(candidate).to_be_hidden()
    assert not errors, errors
    await context.close()
    print('PASS: manual pause, QR modal and hidden-page states freeze the physical frame and resume without time jumps', flush=True)


async def offscreen_and_mobile(browser, url):
    context, page, errors = await fresh(browser, url, viewport={'width': 390, 'height': 480})
    await page.clock.run_for(1500)
    await advance_to(page, 6.5, 'charging')
    await page.screenshot(path=str(OUTPUT / 'charging-mobile.png'), full_page=True)
    await page.evaluate('window.scrollTo(0,0)')
    await asyncio.sleep(.06)
    await page.clock.run_for(50)
    box = await page.locator('.evpc-scene-stage').bounding_box()
    assert box and box['y'] > 480, 'Test must move the scene entirely outside the viewport'
    paused = await scene_state(page)
    await page.clock.run_for(1200)
    unchanged(paused, await scene_state(page))
    await page.locator('.evpc-scene-stage').scroll_into_view_if_needed()
    await asyncio.sleep(.06)
    await page.clock.run_for(250)
    assert (await scene_state(page))['time'] > paused['time'] + .15
    assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth')
    assert not errors, errors
    await context.close()
    print('PASS: offscreen scene pauses, re-entry resumes, and mobile layout has no horizontal overflow', flush=True)


async def reduced_no_script_and_print(browser, url, expected):
    context, page, errors = await fresh(browser, url, motion='reduce')
    await expect(page.locator('[data-ev-toggle]')).to_be_hidden()
    static = await scene_state(page)
    assert static['percent'] == 74 and abs(static['car'][4]) < .1
    at_plug(static, 184, 224)
    await page.evaluate("""(()=>{window.sceneRafCalls=0;const original=window.requestAnimationFrame;
        window.requestAnimationFrame=function(callback){window.sceneRafCalls++;return original.call(window,callback)};})()""")
    await page.clock.run_for(20000)
    unchanged(static, await scene_state(page))
    assert await page.evaluate('window.sceneRafCalls') == 0, 'Reduced motion must not schedule an animation loop'
    for width in [320, 390, 768, 1440]:
        await page.set_viewport_size({'width': width, 'height': 900})
        await page.locator('.evpc-scene-stage').scroll_into_view_if_needed()
        assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth'), width
    await modal_qr(page, expected)
    await page.emulate_media(media='print')
    await expect(page.locator('[data-evpc-print-qr]')).to_be_visible()
    decode(await page.locator('[data-evpc-print-qr] svg').screenshot(), expected)
    assert not errors, errors
    await context.close()

    context, page, errors = await fresh(browser, url, javascript=False, clock=False)
    await expect(page.locator('[data-ev-toggle]')).to_be_hidden()
    assert (await scene_state(page))['percent'] == 74
    link = page.locator('[data-evpc-open-qr]')
    href = await link.get_attribute('href')
    assert href == await page.locator('[data-evpc-download-qr]').get_attribute('href') and href.endswith('.png')
    target = urljoin(url, href)
    response = await context.request.get(target)
    assert response.ok
    decode(await response.body(), expected)
    await link.click()
    await expect(page).to_have_url(target)
    assert not errors, errors
    await context.close()
    print('PASS: reduced-motion static connected 74% view has no RAF loop; modal/print QR and no-script native PNG fallback decode correctly', flush=True)


async def standalone(browser, url, expected):
    context, page, errors = await fresh(browser, url)
    assert await page.locator('link[rel="stylesheet"],script[src]').count() == 0
    for image in await page.locator('img').all():
        assert (await image.get_attribute('src') or '').startswith('data:'), 'Standalone image is not embedded'
    assert await page.locator('[data-ev-scene] svg').count() >= 1
    href = await page.locator('[data-evpc-download-qr]').get_attribute('href')
    assert href and href.startswith('data:image/png')
    metadata, payload = href.split(',', 1)
    decode(base64.b64decode(payload) if ';base64' in metadata else unquote_to_bytes(payload), expected)
    await page.clock.run_for(1500)
    await advance_to(page, 8, 'charging')
    await modal_qr(page, expected)
    assert not errors, errors
    await context.close()
    print('PASS: standalone HTML embeds the scene, styling, animation and genuine contact QR without external assets', flush=True)


async def offline_profiles(browser, base, contacts):
    context = await browser.new_context(viewport={'width': 1440, 'height': 1000})
    pages = []
    for key, path in [('ahmed', '/charge/'), ('kedir', '/charge/kedir/')]:
        page = await context.new_page()
        await page.goto(base + path, wait_until='domcontentloaded')
        await expect(page.locator('[data-evpc-offline-state]')).to_have_text('Ready offline', timeout=15000)
        await page.wait_for_function('(url)=>navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL===url+"service-worker.js"', arg=base + path)
        pages.append((key, page))
    ahmed = pages[0][1]
    kedir = pages[1][1]
    await expect(ahmed.locator('[data-ev-scene]')).to_have_count(1)
    await expect(kedir.locator('[data-ev-scene]')).to_have_count(0)
    await expect(kedir.locator('.evpc-qr__code')).to_have_count(1)
    cache_info = await ahmed.evaluate('''async()=>{
        const result=[];
        for(const name of await caches.keys()){
            const cache=await caches.open(name);
            result.push({name,urls:(await cache.keys()).map(request=>request.url)});
        }
        return result;
    }''')
    root_url = base + '/charge/'
    child_url = root_url + 'kedir/'
    root_caches = [cache for cache in cache_info if root_url + 'index.html' in cache['urls']]
    child_caches = [cache for cache in cache_info if child_url + 'index.html' in cache['urls']]
    assert len(root_caches) == len(child_caches) == 1 and root_caches[0]['name'] != child_caches[0]['name']
    assert root_url + 'assets/charging-scene.css' in root_caches[0]['urls']
    assert root_url + 'assets/charging-scene.js' in root_caches[0]['urls']
    assert not any(url.startswith(child_url) for url in root_caches[0]['urls'])
    await context.set_offline(True)
    for key, page in pages:
        await page.reload(wait_until='domcontentloaded')
        await expect(page.locator('[data-evpc-preloader]')).to_be_hidden(timeout=3500)
        await modal_qr(page, contacts[key])
        if key == 'ahmed':
            await expect(page.locator('[data-ev-scene]')).to_be_visible()
            styles = await page.locator('link[rel="stylesheet"]').evaluate_all('(nodes)=>nodes.map(node=>node.href)')
            for href in styles:
                assert urlparse(href).netloc == urlparse(base).netloc
                assert await page.evaluate('async url=>(await fetch(url)).ok', href), href
            # Without the enhanced modal, Show my QR is a normal PNG navigation.
            # An installed worker must serve that cached image offline too.
            await page.goto(root_url + 'assets/evpower-contact-qr.png', wait_until='load')
            image = page.locator('body > img').first
            await expect(image).to_be_visible()
            decode(await image.screenshot(), contacts[key])
        else:
            await expect(page.locator('[data-ev-scene]')).to_have_count(0)
    await context.close()
    print('PASS: scene assets and native PNG navigation work offline; both profiles retain their own contact QR/caches', flush=True)


async def main(base):
    contacts = {'ahmed': contact(ROOT), 'kedir': contact(ROOT / 'profiles/kedir')}
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        try:
            await timeline_and_controls(browser, base + '/charge/', contacts['ahmed'])
            await offscreen_and_mobile(browser, base + '/charge/')
            await reduced_no_script_and_print(browser, base + '/charge/', contacts['ahmed'])
            await standalone(browser, base + '/standalone/ahmed.html', contacts['ahmed'])
            await offline_profiles(browser, base, contacts)
        finally:
            await browser.close()


if __name__ == '__main__':
    OUTPUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='evpower-charging-check-') as temporary:
        stage = Path(temporary)
        shutil.copytree(ROOT / 'app', stage / 'charge')
        shutil.copytree(ROOT / 'profiles/kedir/app', stage / 'charge/kedir')
        (stage / 'standalone').mkdir()
        shutil.copy2(ROOT / 'dist/evpower-card-standalone.html', stage / 'standalone/ahmed.html')
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(stage)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            asyncio.run(main(f'http://localhost:{server.server_port}'))
        finally:
            server.shutdown()
            server.server_close()
