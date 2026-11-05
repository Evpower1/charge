"""The real preparation button must handle a dependency error and allow retry."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright, expect
from runtime import docker, wp

BASE = 'http://localhost:8094'
TEMP = Path('/tmp/evpower-wordpress-test')
CREDENTIALS = json.loads((TEMP / 'credentials.json').read_text())

async def main():
    assert wp('option', 'get', 'home') == BASE, 'Disposable local WordPress required.'
    original_pages = json.loads(wp('option','get','evpower_pages','--format=json'))
    original_mode = wp('option','get','evpower_header_footer_mode')
    content = '<!-- wp:paragraph --><p>Original preparation-button fixture content.</p><!-- /wp:paragraph -->'
    page_id = wp('post','create','--post_type=page','--post_status=draft','--post_title=Local preparation-button fixture','--post_content='+content,'--porcelain')
    fixture = '/var/www/html/wp-content/mu-plugins/evpower-prepare-failure-test.php'
    try:
        pages = dict(original_pages); pages['about'] = int(page_id)
        wp('option','update','evpower_pages',json.dumps(pages),'--format=json')
        wp('option','update','evpower_header_footer_mode','wordpress')
        wp('option','update','evpower_test_prepare_failure',page_id)
        docker('exec','evpower-wp-test','cp','/test-scripts/mu-prepare-failure.php',fixture)
        docker('exec','evpower-wp-test','chmod','644',fixture)
        async with async_playwright() as p:
            browser = await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
            page = await browser.new_page(viewport={'width':1440,'height':1000})
            await page.goto(BASE+'/wp-login.php',wait_until='domcontentloaded')
            await page.locator('#user_login').fill(CREDENTIALS['username'])
            await page.locator('#user_pass').fill(CREDENTIALS['password'])
            await page.locator('#wp-submit').click()
            await page.wait_for_url('**/wp-admin/**')
            await page.goto(BASE+'/wp-admin/admin.php?page=evpower-elementor',wait_until='domcontentloaded')
            await expect(page.get_by_text('Evpower Core 1.1.4',exact=False)).to_be_visible()
            await page.get_by_role('button',name='Prepare Elementor editing',exact=True).click()
            await expect(page.get_by_text('Elementor preparation stopped:',exact=False)).to_be_visible()
            await expect(page.get_by_text('LOCAL_PREPARATION_BUTTON_FAILURE',exact=False)).to_be_visible()
            await expect(page.get_by_text('There has been a critical error on this website.',exact=False)).to_have_count(0)
            assert wp('post','get',page_id,'--field=post_content') == content
            assert wp('option','get','evpower_header_footer_mode') == 'wordpress'
            print('PASS: the real Prepare button reports a dependency failure while preserving content and active layouts')
            wp('option','delete','evpower_test_prepare_failure')
            await page.get_by_role('link',name='Return to Evpower editing',exact=True).click()
            await page.get_by_role('button',name='Prepare Elementor editing',exact=True).click()
            await expect(page.get_by_text('Settings saved.',exact=False)).to_be_visible()
            assert wp('post','meta','get',page_id,'_elementor_edit_mode') == 'builder'
            assert wp('option','get','evpower_header_footer_mode') == 'elementor'
            print('PASS: preparation can be retried through the dashboard and switches layouts only after success')
            await browser.close()
    finally:
        wp('option','update','evpower_pages',json.dumps(original_pages),'--format=json')
        wp('option','update','evpower_header_footer_mode',original_mode)
        wp('eval','delete_option("evpower_test_prepare_failure");')
        wp('post','delete',page_id,'--force')
        docker('exec','evpower-wp-test','rm','-f',fixture)

if __name__ == '__main__':
    asyncio.run(main())
