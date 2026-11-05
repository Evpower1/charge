"""Header/footer editing must survive a theme template with no post-content block."""
import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright, expect
from runtime import wp

BASE = 'http://localhost:8094'
TEMP = Path('/tmp/evpower-wordpress-test')
CREDENTIALS = json.loads((TEMP / 'credentials.json').read_text())
FIXTURES = json.loads((TEMP / 'elementor-fixtures.json').read_text())

async def main():
    assert wp('option', 'get', 'home') == BASE, 'Disposable local WordPress required.'
    assert wp('post', 'list', '--post_type=wp_template', '--name=single-elementor_library', '--format=count') == '0', 'An existing library template must not be overwritten.'
    template_id = wp('post', 'create', '--post_type=wp_template', '--post_name=single-elementor_library', '--post_title=Local missing-content regression fixture', '--post_content=<!-- wp:paragraph --><p>LOCAL_TEMPLATE_WITHOUT_POST_CONTENT</p><!-- /wp:paragraph -->', '--post_status=publish', '--porcelain')
    try:
        wp('post', 'term', 'set', template_id, 'wp_theme', 'evpower')
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
                if os.environ.get('EVPOWER_EXPECT_MISSING_CONTENT'):
                    await expect(page.get_by_text('Sorry, the content area was not found in your page.', exact=True)).to_be_visible(timeout=30000)
                    print('REPRODUCED: ' + area + ' shows Elementor’s missing-content-area error')
                    continue
                frame = page.frame_locator('iframe#elementor-preview-iframe')
                await expect(frame.locator('.elementor-edit-area-active[data-elementor-id="' + str(FIXTURES['layouts'][area]) + '"]')).to_be_visible(timeout=30000)
                await expect(page.get_by_text('Sorry, the content area was not found in your page.', exact=True)).to_have_count(0)
                await expect(frame.locator('main')).to_have_count(1)
                await expect(frame.get_by_text('LOCAL_TEMPLATE_WITHOUT_POST_CONTENT')).to_have_count(0)
                selector = '.elementor-widget-evpower-identity' if area == 'header' else '.elementor-widget-heading'
                widget = frame.locator(selector).first
                await expect(widget).to_be_visible()
                await page.screenshot(path=str(TEMP / ('elementor-' + area + '-preview-fixed.png')))
                print('PASS: ' + area + ' opens with a real Elementor editing area despite a missing-content theme template')
            # Anonymous requests never receive an authenticated editing canvas.
            public = await browser.new_page()
            response = await public.goto(BASE + '/?post_type=elementor_library&p=' + str(FIXTURES['layouts']['header']) + '&elementor-preview=' + str(FIXTURES['layouts']['header']), wait_until='domcontentloaded')
            assert response.status in [200,404]
            await expect(public.locator('.ep-elementor-layout-preview')).to_have_count(0)
            print('PASS: anonymous visitors cannot activate the dedicated editing preview')
            await browser.close()
    finally:
        wp('post', 'delete', template_id, '--force')

if __name__ == '__main__':
    asyncio.run(main())
