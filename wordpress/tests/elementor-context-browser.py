"""An editable header/footer must survive a different WordPress preview page."""
import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright, expect
from runtime import docker, wp

BASE = 'http://localhost:8094'
TEMP = Path('/tmp/evpower-wordpress-test')
CREDENTIALS = json.loads((TEMP / 'credentials.json').read_text())
FIXTURES = json.loads((TEMP / 'elementor-fixtures.json').read_text())

async def main():
    assert wp('option', 'get', 'home') == BASE, 'Disposable local WordPress required.'
    original_mode = wp('option', 'get', 'evpower_header_footer_mode')
    fixture = '/var/www/html/wp-content/mu-plugins/evpower-page-context-test.php'
    docker('exec', 'evpower-wp-test', 'cp', '/test-scripts/mu-layout-page-context.php', fixture)
    docker('exec', 'evpower-wp-test', 'chmod', '644', fixture)
    wp('option', 'update', 'evpower_header_footer_mode', 'wordpress')
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
            context = await browser.new_context(viewport={'width':1600,'height':1100})
            page = await context.new_page()
            await page.goto(BASE + '/wp-login.php', wait_until='domcontentloaded')
            await page.locator('#user_login').fill(CREDENTIALS['username'])
            await page.locator('#user_pass').fill(CREDENTIALS['password'])
            await page.locator('#wp-submit').click()
            await page.wait_for_url('**/wp-admin/**')
            for area in ['header','footer']:
                await page.goto(FIXTURES[area + '_editor'], wait_until='domcontentloaded')
                frame = page.frame_locator('#elementor-preview-iframe')
                if os.environ.get('EVPOWER_EXPECT_MISSING_CONTENT'):
                    await expect(frame.locator('.ep-hero')).to_be_visible(timeout=30000)
                    await expect(frame.locator('.elementor-edit-area-active[data-elementor-id="' + str(FIXTURES['layouts'][area]) + '"]')).to_have_count(0)
                    print('REPRODUCED: ' + area + ' has no editable layout area when the preview queries a normal page')
                    continue
                await expect(frame.locator('.elementor-edit-area-active[data-elementor-id="' + str(FIXTURES['layouts'][area]) + '"]')).to_be_visible(timeout=30000)
                await expect(page.get_by_text('Sorry, the content area was not found in your page.', exact=True)).to_have_count(0)
                await expect(frame.locator('main')).to_have_count(1)
                await expect(frame.locator('.ep-hero')).to_have_count(0)
                selector = '.elementor-widget-evpower-identity' if area == 'header' else '.elementor-widget-heading'
                widget = frame.locator(selector).first
                await expect(widget).to_be_visible()
                await widget.hover()
                await widget.locator('.elementor-editor-element-edit').first.click()
                field = page.locator('.elementor-control-title input' if area == 'header' else '.elementor-control-title textarea')
                await expect(field).to_be_visible()
                original = await field.input_value()
                marker = 'Evpower context verified ' + area
                async def save(value, restoring=False):
                    await field.fill(value)
                    await field.press('End')
                    await field.dispatch_event('change')
                    await page.get_by_role('button', name='Publish', exact=True).click()
                    for _ in range(20):
                        saved = wp('post', 'meta', 'get', str(FIXTURES['layouts'][area]), '_elementor_data')
                        persisted = marker not in saved if restoring else marker in saved
                        if persisted:
                            return
                        await page.wait_for_timeout(300)
                    raise AssertionError('The edited layout did not persist through Elementor')
                try:
                    await save(marker)
                    print('PASS: ' + area + ' opens, edits and saves when previewed against a different page')
                finally:
                    await save(original, restoring=True)
            await browser.close()
    finally:
        wp('option', 'update', 'evpower_header_footer_mode', original_mode)
        docker('exec', 'evpower-wp-test', 'rm', fixture)

if __name__ == '__main__':
    asyncio.run(main())
