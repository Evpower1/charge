"""Check both cards' textured charging loop, pause controls and contact QR.

Build both profiles first. Uses only installed Chromium and a temporary local
server; screenshots go to ignored test-output/. No live site is contacted.
"""
import asyncio
import base64
from datetime import datetime, timedelta, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
import hashlib
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
PERIOD = 21.6
PROFILES = [('ahmed', ROOT, '/charge/'), ('kedir', ROOT / 'profiles/kedir', '/charge/kedir/')]
TEXTURES = ('ev-car-realistic.png', 'ev-charger-realistic.png')


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


def picture_path(key, frame):
    return OUTPUT / ('charging-' + ('' if key == 'ahmed' else key + '-') + frame + '.png')


async def scene_textures(page, *, embedded=False):
    images = page.locator('[data-ev-scene] image')
    assert await images.count() >= 2, 'Scene must use the generated car and charger textures'
    if embedded:
        expected = {hashlib.sha256((ROOT / 'ui/assets' / name).read_bytes()).digest() for name in TEXTURES}
        rendered = set()
        for image in await images.all():
            href = await image.get_attribute('href') or await image.get_attribute('xlink:href')
            assert href and href.startswith('data:image/png'), 'Standalone scene texture is not embedded'
            metadata, payload = href.split(',', 1)
            data = base64.b64decode(payload) if ';base64' in metadata else unquote_to_bytes(payload)
            assert Image.open(BytesIO(data)).format == 'PNG'
            rendered.add(hashlib.sha256(data).digest())
        assert expected <= rendered, 'Standalone car/charger pixels differ from the generated textures'
    else:
        paths = [urlparse(await image.get_attribute('href') or await image.get_attribute('xlink:href')).path for image in await images.all()]
        for name in TEXTURES:
            assert any(path.endswith('/' + name) for path in paths), 'Missing local scene texture: ' + name


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
            wheelAngles:Array.from(scene.querySelectorAll('[data-ev-wheel]'), wheel=>wheel.transform.baseVal.numberOfItems?wheel.transform.baseVal.getItem(0).angle:0),
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
    if javascript:
        await expect(scene).to_have_attribute('data-ev-assets-ready', 'true', timeout=15000)
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


async def timeline_and_controls(browser, url, expected, key):
    context, page, errors = await fresh(browser, url)
    scene = page.locator('[data-ev-scene]')
    await scene_textures(page)
    overlay = page.locator('[data-evpc-preloader]')
    await expect(overlay).to_be_visible()
    initial = await scene_state(page)
    await page.clock.run_for(700)
    await expect(overlay).to_be_visible()
    unchanged(initial, await scene_state(page))
    await page.clock.run_for(700)
    await expect(overlay).to_be_hidden()
    await expect(scene).to_have_attribute('data-playing', 'true')
    waiting = await advance_to(page, .35, 'waiting')
    at_plug(waiting, 147, 235)
    assert waiting['car'][4] > 640, 'Reverse approach must start to the right of the charger'
    earlier_arrival = await advance_to(page, 1.7, 'arriving')
    arrival = await advance_to(page, 2.7, 'arriving')
    assert earlier_arrival['car'][4] > arrival['car'][4] + 5
    assert arrival['car'][4] > 2 and arrival['percent'] == 24
    assert all(later < earlier for earlier, later in zip(earlier_arrival['wheelAngles'], arrival['wheelAngles'])), 'Wheels must roll backwards while reversing into the bay'
    assert arrival['flow'] == 0
    await scene.screenshot(path=str(picture_path(key, 'arrival')))
    await advance_to(page, 3.5, 'arriving')
    await scene.screenshot(path=str(picture_path(key, 'reverse-parking')))
    parked = await advance_to(page, 4.75, 'parked')
    await scene.screenshot(path=str(picture_path(key, 'docked')))
    at_plug(parked, 147, 235)
    early_connect = await advance_to(page, 5.3, 'connecting')
    late_connect = await advance_to(page, 7.05, 'connecting')
    assert early_connect['car'] == late_connect['car'] and abs(early_connect['car'][4]) < .1
    assert parked['car'] == early_connect['car']
    assert early_connect['percent'] == late_connect['percent'] == 24
    assert early_connect['plug'] != late_connect['plug'] and early_connect['cable'] != late_connect['cable']
    assert early_connect['flow'] == late_connect['flow'] == 0
    charge_start = await advance_to(page, 8, 'charging')
    charge_middle = await advance_to(page, 11, 'charging')
    await scene.screenshot(path=str(picture_path(key, 'connected')))
    await page.screenshot(path=str(picture_path(key, 'desktop')), full_page=True)
    charge_end = await advance_to(page, 14.05, 'charging')
    complete = await advance_to(page, 14.6, 'complete')
    assert 24 <= charge_start['percent'] < charge_middle['percent'] < charge_end['percent'] <= 100
    assert complete['percent'] == 100
    for state in [charge_start, charge_middle, charge_end, complete]:
        assert state['car'] == early_connect['car'], 'Vehicle must stay parked while connected'
        at_plug(state, 240, 252)
    assert charge_middle['flow'] > 0
    assert charge_start['battery'] != charge_middle['battery'] != charge_end['battery']
    disconnecting = await advance_to(page, 16.2, 'disconnecting')
    assert disconnecting['car'] == complete['car'] and disconnecting['percent'] == 100
    assert disconnecting['plug'] != complete['plug'] and disconnecting['flow'] == 0
    departed = await advance_to(page, 17.45, 'departing')
    at_plug(departed, 147, 235)
    assert departed['percent'] == 100 and departed['flow'] == 0
    assert departed['cable'] == parked['cable'], 'Cable must return to its tucked docked shape before departure'
    await scene.screenshot(path=str(picture_path(key, 'departure-start')))
    departure = await advance_to(page, 18.9, 'departing')
    assert departure['car'][4] > 2 and departure['car'] != complete['car']
    assert all(later > earlier for earlier, later in zip(departed['wheelAngles'], departure['wheelAngles'])), 'Wheels must roll forwards when driving away'
    assert departure['plug'] == departed['plug'] and departure['cable'] == departed['cable']
    await scene.screenshot(path=str(picture_path(key, 'departure')))
    end = await advance_to(page, 21.15, 'waiting')
    assert end['car'][4] > 640, 'Vehicle must leave the illustrated frame before the loop resets'
    repeated = await advance_to(page, 2.7, 'arriving')
    assert repeated['percent'] == 24 and abs(repeated['car'][4] - arrival['car'][4]) < 10
    assert repeated['plug'] == arrival['plug'] and repeated['cable'] == arrival['cable']
    print(f'PASS {key}: reverse parking with matching wheel rotation, stationary connection/charging, 24→100%, unplug before departure and repeatable 21.6s loop', flush=True)

    await advance_to(page, 9.5, 'charging')
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
    print(f'PASS {key}: manual pause, QR modal and hidden-page states freeze the physical frame and resume without time jumps', flush=True)


async def cable_clearance(browser, url, key):
    """Measure the actual rendered cable against both tire discs on every RAF."""
    context, page, errors = await fresh(browser, url)
    await page.clock.run_for(1500)
    await page.evaluate("""()=>{
        const scene=document.querySelector('[data-ev-scene]');
        const svg=scene.querySelector('.evpc-scene-svg');
        const cable=scene.querySelector('[data-ev-cable]');
        const wheels=Array.from(scene.querySelectorAll('[data-ev-wheel]'));
        const radius=Number(scene.getAttribute('data-wheel-radius'));
        const stroke=parseFloat(getComputedStyle(cable).strokeWidth)/2;
        const result=window.cableClearance={frames:0,min:Infinity,failures:[],phases:{},moving:0};
        let oldPath='',points=[];
        function sample(){
            const phase=scene.getAttribute('data-phase');
            const time=Number(scene.getAttribute('data-time'));
            const toRoot=svg.getScreenCTM().inverse();
            const path=cable.getAttribute('d');
            if(path!==oldPath){
                oldPath=path;points=[];
                const matrix=toRoot.multiply(cable.getScreenCTM());
                const length=cable.getTotalLength();
                const count=Math.ceil(length/2);
                for(let i=0;i<=count;i++)points.push(cable.getPointAtLength(length*i/count).matrixTransform(matrix));
            }
            result.frames++;result.phases[phase]=(result.phases[phase]||0)+1;
            for(const wheel of wheels){
                const matrix=toRoot.multiply(wheel.getScreenCTM());
                const center=new DOMPoint(Number(wheel.getAttribute('data-cx')),Number(wheel.getAttribute('data-cy'))).matrixTransform(matrix);
                for(const point of points){
                    const gap=Math.hypot(center.x-point.x,center.y-point.y)-radius-stroke;
                    result.min=Math.min(result.min,gap);
                    if(gap<4 && result.failures.length<5)result.failures.push({phase,time,gap,center:{x:center.x,y:center.y},point:{x:point.x,y:point.y}});
                }
            }
            if(phase==='arriving'||phase==='departing'){
                result.moving++;
                if(Number(scene.getAttribute('data-connection'))!==0 && result.failures.length<5)result.failures.push({phase,time,error:'Car moved while connected'});
            }
        }
        window.cableClearanceObserver=new MutationObserver(sample);
        window.cableClearanceObserver.observe(scene,{attributes:true,attributeFilter:['data-time']});
        sample();
    }""")
    await page.clock.run_for(21700)
    result = await page.evaluate('window.cableClearance')
    await page.evaluate('window.cableClearanceObserver.disconnect()')
    assert result['frames'] > 1000 and result['moving'] > 300, result
    assert set(['waiting','arriving','parked','connecting','charging','complete','disconnecting','departing']) <= set(result['phases']), result
    assert not result['failures'] and result['min'] > 4, result
    assert not errors, errors
    await context.close()
    print(f"PASS {key}: actual SVG cable clears both tires across {result['frames']} rendered frames (minimum edge gap {result['min']:.1f}px)", flush=True)


async def offscreen_and_mobile(browser, url, key):
    context, page, errors = await fresh(browser, url, viewport={'width': 390, 'height': 480})
    await page.clock.run_for(1500)
    await scene_textures(page)
    await advance_to(page, 9.5, 'charging')
    await page.screenshot(path=str(picture_path(key, 'mobile')), full_page=True)
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
    print(f'PASS {key}: offscreen scene pauses, re-entry resumes, and mobile layout has no horizontal overflow', flush=True)


async def reduced_no_script_and_print(browser, url, expected, key):
    context, page, errors = await fresh(browser, url, motion='reduce')
    await expect(page.locator('[data-ev-toggle]')).to_be_hidden()
    static = await scene_state(page)
    assert static['percent'] == 74 and abs(static['car'][4]) < .1
    at_plug(static, 240, 252)
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
    await scene_textures(page)
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
    print(f'PASS {key}: reduced-motion static connected 74% view has no RAF loop; modal/print QR and no-script native PNG fallback decode correctly', flush=True)


async def standalone(browser, url, expected, key):
    context, page, errors = await fresh(browser, url)
    assert await page.locator('link[rel="stylesheet"],script[src]').count() == 0
    for image in await page.locator('img').all():
        assert (await image.get_attribute('src') or '').startswith('data:'), 'Standalone image is not embedded'
    assert await page.locator('[data-ev-scene] svg').count() >= 1
    await scene_textures(page, embedded=True)
    href = await page.locator('[data-evpc-download-qr]').get_attribute('href')
    assert href and href.startswith('data:image/png')
    metadata, payload = href.split(',', 1)
    decode(base64.b64decode(payload) if ';base64' in metadata else unquote_to_bytes(payload), expected)
    await page.clock.run_for(1500)
    await advance_to(page, 11, 'charging')
    await modal_qr(page, expected)
    assert not errors, errors
    await context.close()
    print(f'PASS {key}: standalone HTML embeds exact car/charger PNGs, styling, animation and genuine contact QR without external assets', flush=True)


async def missing_texture(browser, url, expected, key):
    context = await browser.new_context(viewport={'width': 390, 'height': 844}, service_workers='block')
    await context.route('**/assets/ev-car-realistic.png', lambda route: route.abort())
    page = await context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    await freeze_clock(page)
    await page.goto(url, wait_until='domcontentloaded')
    scene = page.locator('[data-ev-scene]')
    await expect(scene).to_have_attribute('data-ev-assets-ready', 'error', timeout=15000)
    await page.clock.run_for(1500)
    await expect(scene.locator('.evpc-scene-asset-note')).to_be_visible()
    await expect(scene.locator('[data-ev-toggle]')).to_be_hidden()
    before = await scene_state(page)
    await page.evaluate("""(()=>{window.sceneRafCalls=0;const original=window.requestAnimationFrame;
        window.requestAnimationFrame=function(callback){window.sceneRafCalls++;return original.call(window,callback)};})()""")
    await page.clock.run_for(2000)
    unchanged(before, await scene_state(page))
    assert await page.evaluate('window.sceneRafCalls') == 0
    await modal_qr(page, expected)
    assert (await page.locator('[data-evpc-save]').get_attribute('href')).endswith('.vcf')
    assert not errors, errors
    await context.close()
    print(f'PASS {key}: failed artwork shows its placeholder, stops RAF and leaves the genuine contact QR usable', flush=True)


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
    for page in [ahmed, kedir]:
        await expect(page.locator('[data-ev-scene]')).to_have_count(1)
        await expect(page.locator('.evpc-aside .evpc-qr__code')).to_have_count(0)
        await scene_textures(page)
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
    for url, caches in [(root_url, root_caches), (child_url, child_caches)]:
        for asset in ['charging-scene.css', 'charging-scene.js', *TEXTURES]:
            assert url + 'assets/' + asset in caches[0]['urls'], 'Missing cached scene asset: ' + asset
    assert not any(url.startswith(child_url) for url in root_caches[0]['urls'])
    await context.set_offline(True)
    for key, page in pages:
        await page.reload(wait_until='domcontentloaded')
        await expect(page.locator('[data-evpc-preloader]')).to_be_hidden(timeout=3500)
        await modal_qr(page, contacts[key])
        await expect(page.locator('[data-ev-scene]')).to_be_visible()
        styles = await page.locator('link[rel="stylesheet"]').evaluate_all('(nodes)=>nodes.map(node=>node.href)')
        for href in styles:
            assert urlparse(href).netloc == urlparse(base).netloc
            assert await page.evaluate('async url=>(await fetch(url)).ok', href), href
        for name in TEXTURES:
            data = bytes(await page.evaluate('''async url=>{
                const response=await fetch(url);
                if(!response.ok)throw new Error('Offline texture unavailable');
                return Array.from(new Uint8Array(await response.arrayBuffer()));
            }''', 'assets/' + name))
            expected = (ROOT / 'ui/assets' / name).read_bytes()
            assert hashlib.sha256(data).digest() == hashlib.sha256(expected).digest(), name
            assert Image.open(BytesIO(data)).format == 'PNG'
        # Without the enhanced modal, Show my QR is a normal PNG navigation.
        # Each installed worker must serve its own cached contact image offline.
        url = root_url if key == 'ahmed' else child_url
        await page.goto(url + 'assets/evpower-contact-qr.png', wait_until='load')
        image = page.locator('body > img').first
        await expect(image).to_be_visible()
        decode(await image.screenshot(), contacts[key])
    await context.close()
    print('PASS: exact 3D PNG textures, scene assets and native contact PNG navigation work offline with both profile caches isolated', flush=True)


async def main(base):
    contacts = {key: contact(profile) for key, profile, _path in PROFILES}
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        try:
            for key, _profile, path in PROFILES:
                await timeline_and_controls(browser, base + path, contacts[key], key)
                await cable_clearance(browser, base + path, key)
                await offscreen_and_mobile(browser, base + path, key)
                await reduced_no_script_and_print(browser, base + path, contacts[key], key)
                await standalone(browser, base + '/standalone/' + key + '.html', contacts[key], key)
                await missing_texture(browser, base + path, contacts[key], key)
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
        for key, profile, _path in PROFILES:
            shutil.copy2(profile / 'dist/evpower-card-standalone.html', stage / 'standalone' / (key + '.html'))
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(stage)))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            asyncio.run(main(f'http://localhost:{server.server_port}'))
        finally:
            server.shutdown()
            server.server_close()
