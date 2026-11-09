"""Local-only browser checks and a deterministic recording of the coded animation."""
import asyncio
import base64
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import threading
from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / 'dist/evpower-preloader-preview.html'
FRAMES = ROOT / 'recording-frames'
FRAMES.mkdir(exist_ok=True)
PIXEL = base64.b64decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        if self.path.startswith('/test-'):
            html = DEMO.read_text()
            preview = self.path.startswith('/test-css') or self.path.startswith('/test-loop')
            session = not preview
            config = f'sessionOnly:{str(session).lower()},maxWait:{10000 if preview else 6000},preview:{str(preview).lower()}'
            html = html.replace('sessionOnly:false,maxWait:10000,preview:true', config)
            if self.path.startswith('/test-slow'):
                html = html.replace('</main>', '<img alt="" src="/held.gif"></main>')
            data = html.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()

async def main(base):
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        errors = []
        async def new_context(**kwargs):
            context = await browser.new_context(**kwargs)
            context.on('page', lambda p: p.on('pageerror', lambda e: errors.append(str(e))))
            return context
        async def slow(context):
            page = await context.new_page()
            gate = asyncio.Event()
            async def hold(route):
                await gate.wait()
                try: await route.fulfill(status=200, content_type='image/gif', body=PIXEL)
                except Exception: pass
            await page.route('**/held.gif', hold)
            await page.goto(base + '/test-slow', wait_until='domcontentloaded')
            return page, gate

        context = await new_context()
        page = await context.new_page()
        await page.goto(base + '/test-auto', wait_until='domcontentloaded')
        await expect(page.locator('[data-evp-preloader]')).to_be_visible()
        await expect(page.locator('[data-evp-preloader]')).to_be_hidden(timeout=2500)
        await page.reload(wait_until='domcontentloaded')
        assert not await page.evaluate('window.EvpowerPreloader.isActive()')
        print('PASS: automatic page-ready dismissal and once-per-tab frequency')
        await context.close()

        for dismissal in ['button', 'escape']:
            context = await new_context()
            page, gate = await slow(context)
            await expect(page.locator('[data-evp-preloader]')).to_be_visible()
            if dismissal == 'button': await page.get_by_role('button', name='Skip animation', exact=True).click()
            else: await page.keyboard.press('Escape')
            assert not await page.evaluate('window.EvpowerPreloader.isActive()')
            gate.set()
            await context.close()
            print('PASS: immediate dismissal using ' + dismissal)

        context = await new_context()
        page, gate = await slow(context)
        await expect(page.locator('[data-evp-preloader]')).to_be_hidden(timeout=6500)
        assert await page.evaluate('document.readyState') != 'complete'
        gate.set()
        await context.close()
        print('PASS: six-second safety dismissal while an image is still loading')

        context = await new_context(reduced_motion='reduce')
        page, gate = await slow(context)
        await expect(page.locator('.evp-preloader__pulse')).to_be_hidden()
        await expect(page.locator('.evp-preloader__track > span')).to_have_css('animation-name', 'none')
        gate.set()
        await expect(page.locator('[data-evp-preloader]')).to_be_hidden(timeout=2000)
        await context.close()
        print('PASS: reduced motion keeps a still emblem and dismisses on readiness')

        context = await new_context(java_script_enabled=False)
        page = await context.new_page()
        await page.goto(base + '/test-auto', wait_until='load')
        await expect(page.locator('[data-evp-preloader]')).to_be_hidden()
        await expect(page.locator('main h1')).to_be_visible()
        await context.close()
        print('PASS: page access without JavaScript')

        context = await new_context()
        await context.add_init_script("Storage.prototype.getItem=function(){throw new Error('LOCAL_STORAGE_BLOCKED')};Storage.prototype.setItem=function(){throw new Error('LOCAL_STORAGE_BLOCKED')}")
        page = await context.new_page()
        await page.goto(base + '/test-auto', wait_until='domcontentloaded')
        await expect(page.locator('[data-evp-preloader]')).to_be_hidden(timeout=2500)
        await context.close()
        print('PASS: unavailable browser storage does not break dismissal')

        context = await new_context()
        page = await context.new_page()
        await page.goto(base + '/test-css', wait_until='domcontentloaded')
        await expect(page.locator('[data-evp-preloader]')).to_be_hidden(timeout=7500)
        assert await page.evaluate('window.EvpowerPreloader.isActive()')
        await context.close()
        print('PASS: CSS also releases the overlay independently of JavaScript dismissal')

        context = await new_context()
        page = await context.new_page()
        for width in [320,390,768,1440]:
            await page.set_viewport_size({'width':width,'height':844})
            await page.goto(base + '/test-loop', wait_until='load')
            assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth')
            box = await page.locator('.evp-preloader__emblem').bounding_box()
            assert box['x'] >= 0 and box['x'] + box['width'] <= width
            await expect(page.get_by_role('button', name='Skip animation', exact=True)).to_be_visible()
            await page.screenshot(path=str(ROOT / f'preview-{width}.png'))
            print(f'PASS: complete emblem and controls fit {width}px')
        await page.evaluate("dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
        assert not await page.evaluate('window.EvpowerPreloader.isActive()')
        await context.close()
        print('PASS: back-forward restoration releases any stale overlay')

        context = await new_context(viewport={'width':480,'height':240}, device_scale_factor=1)
        page = await context.new_page()
        await page.goto(base + '/dist/evpower-preloader-preview.html?record=1', wait_until='load')
        await page.locator('.evp-preloader__image').evaluate('(img)=>img.decode()')
        await page.evaluate('document.fonts.ready')
        await page.evaluate('document.getAnimations().forEach(a=>a.pause())')
        for frame in range(38):
            await page.evaluate('(time)=>document.getAnimations().forEach(a=>a.currentTime=time)', frame * 50)
            await page.screenshot(path=str(FRAMES / f'frame-{frame:03d}.png'))
        await context.close()
        assert not errors, errors
        await browser.close()
        print('PASS: no uncaught browser errors; 38 animation frames recorded')

if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        asyncio.run(main(f'http://localhost:{server.server_port}'))
    finally:
        server.shutdown()
        server.server_close()
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','20','-i',str(FRAMES / 'frame-%03d.png'),'-filter_complex','[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',str(ROOT / 'dist/evpower-preloader.gif')],check=True)
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','20','-i',str(FRAMES / 'frame-%03d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','20','-movflags','+faststart',str(ROOT / 'dist/evpower-preloader-preview.mp4')],check=True)
    print('Created looping GIF and MP4 previews of the actual coded animation.')
