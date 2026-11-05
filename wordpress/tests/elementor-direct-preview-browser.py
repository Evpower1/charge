"""Real editor/checks with early dispatch, an external preview URL, and nonce gating."""
import asyncio
import json
import re
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from playwright.async_api import async_playwright, expect
from runtime import docker, wp

BASE = 'http://localhost:8094'
TEMP = Path('/tmp/evpower-wordpress-test')
CREDENTIALS = json.loads((TEMP / 'credentials.json').read_text())
FIXTURES = json.loads((TEMP / 'elementor-fixtures.json').read_text())

async def main():
    assert wp('option','get','home') == BASE, 'Disposable local WordPress required.'
    fixture = '/var/www/html/wp-content/mu-plugins/evpower-early-preview-test.php'
    docker('exec','evpower-wp-test','cp','/test-scripts/mu-early-preview.php',fixture)
    docker('exec','evpower-wp-test','chmod','644',fixture)
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            context = await browser.new_context(viewport={'width':1600,'height':1100},permissions=['clipboard-read','clipboard-write'])
            external_requests = []
            async def block_external(route):
                external_requests.append(True)
                await route.abort()
            await context.route('https://preview-target.invalid/**',block_external)
            page = await context.new_page()
            await page.goto(BASE+'/wp-login.php',wait_until='domcontentloaded')
            await page.locator('#user_login').fill(CREDENTIALS['username'])
            await page.locator('#user_pass').fill(CREDENTIALS['password'])
            await page.locator('#wp-submit').click()
            await page.wait_for_url('**/wp-admin/**')
            header_id = FIXTURES['layouts']['header']
            old = await context.request.get(BASE+'/?post_type=elementor_library&p='+str(header_id)+'&elementor-preview='+str(header_id))
            old_html = await old.text()
            title = re.search(r'<title>(.*?)</title>',old_html,re.S)
            assert 'LOCAL_EARLY_PREVIEW_DISPATCH' in old_html, 'Legacy status '+str(old.status)+'; title '+(title.group(1) if title else 'none')+'; login form '+str('id="user_login"' in old_html)
            print('REPRODUCED: a template dispatcher can end the legacy preview before template_include runs')
            for area in ['header','footer']:
                await page.goto(BASE+'/wp-admin/admin.php?page=evpower-elementor',wait_until='domcontentloaded')
                await page.get_by_role('link',name='Check '+area+' preview',exact=True).click()
                await expect(page.locator('#evpower-preview-status')).to_contain_text('Preview ready',timeout=30000)
                report = await page.locator('#evpower-preview-report').input_value()
                assert 'HTTP status: 200' in report and 'Requested editing area: found' in report
                assert 'WordPress preview authorization: authorized' in report
                assert 'ep_preview_nonce' not in report and 'preview_nonce' not in report and '_wpnonce' not in report
                await page.get_by_role('button',name='Copy report',exact=True).click()
                await expect(page.get_by_role('button',name='Report copied',exact=True)).to_be_visible()
                assert await page.evaluate('navigator.clipboard.readText()') == report
                await page.get_by_role('link',name='Open editor with diagnostics',exact=True).click()
                frame = page.frame_locator('#elementor-preview-iframe')
                target_id = FIXTURES['layouts'][area]
                await expect(frame.locator('.elementor-edit-area-active[data-elementor-id="'+str(target_id)+'"]')).to_be_visible(timeout=30000)
                src = await page.locator('#elementor-preview-iframe').get_attribute('src')
                parsed = urlparse(src); args = parse_qs(parsed.query)
                assert parsed.scheme+'://'+parsed.netloc == BASE and parsed.path == '/index.php'
                assert args['evpower-layout-preview'] == [str(target_id)]
                await expect(frame.get_by_text('LOCAL_EARLY_PREVIEW_DISPATCH')).to_have_count(0)
                await page.get_by_role('button',name='Copy Evpower editor report',exact=True).click()
                editor_report = await page.evaluate('navigator.clipboard.readText()')
                assert 'Requested editing area: found' in editor_report and 'Native preview state: active' in editor_report
                assert 'ep_preview_nonce' not in editor_report and 'preview_nonce' not in editor_report
                close = page.get_by_role('dialog').get_by_role('button',name='Close',exact=True)
                if await close.count(): await close.first.click()
                widget = frame.locator('.elementor-widget-evpower-identity' if area == 'header' else '.elementor-widget-heading').first
                await widget.hover(); await widget.locator('.elementor-editor-element-edit').first.click()
                field = page.locator('.elementor-control-title input' if area == 'header' else '.elementor-control-title textarea')
                original = await field.input_value(); marker = 'Evpower direct preview verified '+area
                async def save(value,restoring=False):
                    await field.fill(value); await field.press('End'); await field.dispatch_event('change')
                    await page.get_by_role('button',name='Publish',exact=True).click()
                    for _ in range(20):
                        data = wp('post','meta','get',str(target_id),'_elementor_data')
                        persisted = marker not in data if restoring else marker in data
                        if persisted: return
                        await page.wait_for_timeout(300)
                    raise AssertionError('The direct preview edit was not saved')
                try:
                    await save(marker)
                    print('PASS: '+area+' preview, diagnostics, editing and saving work before the competing dispatcher')
                finally:
                    await save(original,restoring=True)
                guest = await browser.new_context()
                response = await guest.request.get(src)
                assert response.status == 403 and 'evpower-layout-preview' not in await response.text()
                await guest.close()
                for key in ['ep_preview_nonce','document_mismatch']:
                    bad = dict(args)
                    if key == 'ep_preview_nonce': bad.pop(key)
                    else: bad['evpower-layout-preview'] = [str(FIXTURES['pages']['home'])]
                    response = await context.request.get(urlunparse(parsed._replace(query=urlencode(bad,doseq=True))))
                    assert response.status == 403
                print('PASS: '+area+' preview rejects guests, missing nonces and non-layout document IDs')
            assert not external_requests, 'The external preview domain must never be requested'
            print('PASS: preview requests stay on the WordPress admin origin and copied reports exclude nonce values')
            await browser.close()
    finally:
        docker('exec','evpower-wp-test','rm','-f',fixture)

if __name__ == '__main__': asyncio.run(main())
