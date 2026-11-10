"""Check the static browser demo with the published card's parent service worker.

Build with npm run build:browser-demo first. No backend, payment, email or charger
service is used. External browsing is blocked and all test data is browser-local.
"""
import asyncio
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile
import threading

from playwright.async_api import async_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parent
PAGES_PARENT='8f3dbdce031205f756d2852552a2410723dcbcfc'
OUTPUT=ROOT/'tests/test-output'

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

async def main(base):
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        context=await browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
        await context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base+'/') else route.abort())
        page=await context.new_page();errors=[];api_requests=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('request',lambda request:api_requests.append(request.url) if '/v1/' in request.url else None)
        await page.goto(base+'/charge/',wait_until='networkidle')
        await expect(page.locator('h1')).to_have_text('Ahmed Kemal')
        await expect(page.locator('[data-evpc-offline-state]')).to_have_text('Ready offline',timeout=15000)
        await page.wait_for_function('navigator.serviceWorker.controller!==null')
        await page.evaluate("localStorage.setItem('evpower.demo-test.keep','untouched')")
        url=base+'/charge/app-preview/'
        await page.goto(url,wait_until='networkidle')
        await expect(page.get_by_text('INTERACTIVE DEMO · No real bookings or payments',exact=True)).to_be_visible()
        for width in [320,390,768,1440]:
            await page.set_viewport_size({'width':width,'height':900 if width>430 else 844})
            assert not await page.evaluate('document.documentElement.scrollWidth>innerWidth'),width
        await page.set_viewport_size({'width':390,'height':844})
        await page.get_by_role('button',name='Try demo account',exact=True).click()
        await expect(page.get_by_text('Hello, Preview.',exact=True)).to_be_visible()
        await page.screenshot(path=str(OUTPUT/'public-demo-home.png'))
        await page.get_by_role('tab',name='Book charge',exact=True).click()
        await page.get_by_label('Pickup address or landmark',exact=True).fill('Made-up preview pickup point')
        await page.get_by_label('Requested energy in kWh',exact=True).fill('15')
        await page.get_by_role('button',name=re.compile('Request mobile charging')).click()
        await expect(page.get_by_text('Your demo request is ready.',exact=True)).to_be_visible()
        await expect(page.get_by_text('PREVIEW SAVED LOCALLY',exact=True)).to_be_visible()
        await page.screenshot(path=str(OUTPUT/'public-demo-booking.png'))
        for status in ['confirmed','en_route','arrived','charging','completed']:
            button=page.get_by_role('button',name='Advance demo booking',exact=True)
            await expect(button).to_be_enabled();await button.click()
            await page.wait_for_function("status=>JSON.parse(localStorage.getItem('evpower.browser-demo.v1')).bookings[0].status===status",arg=status)
        await page.reload(wait_until='networkidle')
        await page.get_by_role('button',name='Try demo account',exact=True).click()
        await expect(page.get_by_text('Hello, Preview.',exact=True)).to_be_visible()
        assert await page.evaluate("JSON.parse(localStorage.getItem('evpower.browser-demo.v1')).bookings[0].status")=='completed'
        await page.get_by_role('tab',name='Stations',exact=True).click()
        await expect(page.get_by_text('Demo · Addis Ababa training bay',exact=True).first).to_be_visible()
        await expect(page.get_by_text('Sample location',exact=True).first).to_be_visible()
        assert await page.get_by_text('Availability unknown',exact=True).count()>=1
        await page.get_by_role('tab',name='Account',exact=True).click()
        await expect(page.get_by_text('Demo account · this browser only',exact=True)).to_be_visible()
        await page.get_by_role('button',name=re.compile('Evpower service credit')).click()
        await expect(page.get_by_role('button',name='Continue to Chapa →',exact=True)).to_be_disabled()
        await expect(page.get_by_text('All payments are disabled in this browser demo. No real money can be added or spent.',exact=True)).to_be_visible()
        await page.get_by_role('button',name='Reset preview',exact=True).click()
        await expect(page.get_by_role('button',name='Try demo account',exact=True)).to_be_visible()
        assert await page.evaluate("localStorage.getItem('evpower.demo-test.keep')")=='untouched'
        await page.get_by_role('button',name='Try demo account',exact=True).click()
        await expect(page.get_by_text('Hello, Preview.',exact=True)).to_be_visible()
        data=await page.evaluate("JSON.parse(localStorage.getItem('evpower.browser-demo.v1'))")
        assert data['bookings']==[] and all('password' not in user for user in data['users'])
        assert not api_requests,api_requests
        assert not errors,errors
        assert len(context.pages)==1,'No checkout or external action should open'
        response=await context.request.get(url+'privacy/')
        assert response.ok and 'INTERACTIVE DEMO' in await response.text()
        await context.close();await browser.close()
        print('PASS: public demo, parent card worker, responsive UI, booking timeline, persistence, unknown samples, disabled payments, reset isolation and zero API network requests')

if __name__=='__main__':
    OUTPUT.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='evpower-public-demo-') as temp:
        site=Path(temp);charge=site/'charge';charge.mkdir()
        data=subprocess.check_output(['git','archive',PAGES_PARENT],cwd=REPO)
        with tarfile.open(fileobj=BytesIO(data)) as archive:archive.extractall(charge,filter='data')
        shutil.copytree(ROOT/'mobile/demo-dist',charge/'app-preview')
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(site)))
        threading.Thread(target=server.serve_forever,daemon=True).start()
        try:asyncio.run(main('http://127.0.0.1:'+str(server.server_port)))
        finally:server.shutdown()
