"""Match an authorized active preview with no editing wrapper, then edit/save it."""
import asyncio
import json
import os
import re
from pathlib import Path
from playwright.async_api import async_playwright, expect
from runtime import docker, wp

BASE = 'http://localhost:8094'
TEMP = Path('/tmp/evpower-wordpress-test')
CREDENTIALS = json.loads((TEMP / 'credentials.json').read_text())
FIXTURES = json.loads((TEMP / 'elementor-fixtures.json').read_text())

async def main():
    assert wp('option','get','home') == BASE, 'Disposable local WordPress required.'
    fixture = '/var/www/html/wp-content/mu-plugins/evpower-preview-content-test.php'
    docker('exec','evpower-wp-test','cp','/test-scripts/mu-preview-content.php',fixture)
    docker('exec','evpower-wp-test','chmod','644',fixture)
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            context = await browser.new_context(viewport={'width':1600,'height':1100},permissions=['clipboard-read','clipboard-write'])
            page = await context.new_page()
            await page.goto(BASE+'/wp-login.php',wait_until='domcontentloaded')
            await page.locator('#user_login').fill(CREDENTIALS['username'])
            await page.locator('#user_pass').fill(CREDENTIALS['password'])
            await page.locator('#wp-submit').click()
            await page.wait_for_url('**/wp-admin/**')
            for area,mode in [('header','context'),('footer','blank')]:
                wp('option','update','evpower_test_preview_content_mode',mode)
                await page.goto(BASE+'/wp-admin/admin.php?page=evpower-elementor',wait_until='domcontentloaded')
                await page.get_by_role('link',name='Check '+area+' preview',exact=True).click()
                await expect(page.locator('#evpower-preview-report')).to_have_value(re.compile(r'Native preview state: active'),timeout=30000)
                report = await page.locator('#evpower-preview-report').input_value()
                assert 'HTTP status: 200' in report and 'WordPress preview authorization: authorized' in report
                if os.environ.get('EVPOWER_EXPECT_MISSING_WRAPPER'):
                    assert 'Delivered document IDs: none' in report and 'Requested editing area: missing' in report
                    print('REPRODUCED: '+area+' is authorized and active but has no editing area after content filters')
                    continue
                await expect(page.locator('#evpower-preview-status')).to_contain_text('Preview ready')
                assert 'Editing wrapper source: direct' in report and 'Requested editing area: found' in report
                if mode == 'context': assert 'Post after content filters: '+str(FIXTURES['pages']['home']) in report
                await page.get_by_role('link',name='Open editor with diagnostics',exact=True).click()
                frame = page.frame_locator('#elementor-preview-iframe')
                doc_id = FIXTURES['layouts'][area]
                root = frame.locator('.elementor-edit-area-active[data-elementor-id="'+str(doc_id)+'"]')
                await expect(root).to_be_visible(timeout=30000)
                await expect(frame.locator('.elementor[data-elementor-id="'+str(doc_id)+'"]')).to_have_count(1)
                widget = root.locator('.elementor-widget-evpower-identity' if area == 'header' else '.elementor-widget-heading').first
                await widget.hover(); await widget.locator('.elementor-editor-element-edit').first.click()
                field = page.locator('.elementor-control-title input' if area == 'header' else '.elementor-control-title textarea')
                original = await field.input_value(); marker = 'Evpower content recovery '+area
                async def save(value,restore=False):
                    await field.fill(value); await field.press('End'); await field.dispatch_event('change')
                    await page.get_by_role('button',name='Publish',exact=True).click()
                    for _ in range(20):
                        data = wp('post','meta','get',str(doc_id),'_elementor_data')
                        persisted = marker not in data if restore else marker in data
                        if persisted: return
                        await page.wait_for_timeout(300)
                    raise AssertionError('The recovered editing area did not save changes')
                try:
                    await save(marker)
                    print('PASS: '+area+' has one editable wrapper and saves changes despite content removal/context changes')
                finally: await save(original,restore=True)
            await browser.close()
    finally:
        wp('eval','delete_option("evpower_test_preview_content_mode");')
        docker('exec','evpower-wp-test','rm','-f',fixture)

if __name__ == '__main__': asyncio.run(main())
